import { createPublicClient, http, parseAbiItem, Log } from 'viem';
import { base } from 'viem/chains';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { processEvent } from './eventProcessor.js';
import { CONTRACT_ADDRESS, BASE_WILL_ABI } from './config.js';

const prisma = new PrismaClient();

// Create client for Base Mainnet
const client = createPublicClient({
  chain: base,
  transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
});

// Events to index
const EVENTS = [
  'WillCreated(uint256 indexed willId, address indexed testator, uint256 inactivityThreshold)',
  'WillUpdated(uint256 indexed willId)',
  'WillCancelled(uint256 indexed willId)',
  'BeneficiaryAdded(uint256 indexed willId, address indexed beneficiary, uint256 allocationBps)',
  'BeneficiaryRemoved(uint256 indexed willId, address indexed beneficiary)',
  'BeneficiaryUpdated(uint256 indexed willId, address indexed beneficiary, uint256 newAllocationBps)',
  'ActivityRecorded(uint256 indexed willId, uint256 timestamp)',
  'CheckIn(uint256 indexed willId, address indexed by)',
  'WillTriggered(uint256 indexed willId, uint256 gracePeriodEnd)',
  'TriggerCancelled(uint256 indexed willId)',
  'WillExecuted(uint256 indexed willId, uint256 totalDistributed)',
  'AssetDistributed(uint256 indexed willId, address indexed beneficiary, uint256 amount)',
  'AssetClaimed(uint256 indexed willId, address indexed beneficiary, uint256 amount)',
  'NotaryAssigned(uint256 indexed willId, address indexed notary)',
  'NotaryVerificationSubmitted(uint256 indexed willId, address indexed notary, bool verified)',
  'EmergencyWithdrawalInitiated(uint256 indexed willId, uint256 cooldownEnd)',
  'EmergencyWithdrawalCompleted(uint256 indexed willId)',
  'DisputeFiled(uint256 indexed willId, address indexed filer, string reason)',
  'DisputeResolved(uint256 indexed willId, bool inFavor)',
  'NotaryRegistered(address indexed notary, uint256 stake)',
  'NotarySlashed(address indexed notary, uint256 slashedAmount)',
];

const POLLING_INTERVAL = 12000; // 12 seconds (Base block time)
const BLOCKS_PER_BATCH = 1000;

export async function startIndexer() {
  logger.info('Starting event indexer...');

  try {
    // Get last processed block
    const state = await prisma.indexerState.findUnique({
      where: { id: 'singleton' },
    });

    let lastBlock = state?.lastBlockNumber ?? BigInt(0);

    // If starting fresh, start from contract deployment block
    if (lastBlock === BigInt(0)) {
      const deploymentBlock = BigInt(process.env.CONTRACT_DEPLOYMENT_BLOCK || '0');
      lastBlock = deploymentBlock;
      logger.info(`Starting indexer from deployment block ${lastBlock}`);
    }

    // Start polling loop
    indexLoop(lastBlock);
  } catch (error) {
    logger.error('Failed to start indexer:', error);
    throw error;
  }
}

async function indexLoop(startBlock: bigint) {
  let currentBlock = startBlock;

  while (true) {
    try {
      // Get latest block
      const latestBlock = await client.getBlockNumber();

      if (currentBlock >= latestBlock) {
        // Up to date, wait for new blocks
        await sleep(POLLING_INTERVAL);
        continue;
      }

      // Calculate end block for this batch
      const endBlock = currentBlock + BigInt(BLOCKS_PER_BATCH) < latestBlock
        ? currentBlock + BigInt(BLOCKS_PER_BATCH)
        : latestBlock;

      logger.info(`Indexing blocks ${currentBlock} to ${endBlock}`);

      // Fetch and process logs
      await indexBlockRange(currentBlock, endBlock);

      // Update state
      await prisma.indexerState.update({
        where: { id: 'singleton' },
        data: { lastBlockNumber: endBlock },
      });

      currentBlock = endBlock + BigInt(1);
    } catch (error) {
      logger.error('Indexer error:', error);
      await sleep(POLLING_INTERVAL * 2); // Wait longer on error
    }
  }
}

async function indexBlockRange(fromBlock: bigint, toBlock: bigint) {
  if (!CONTRACT_ADDRESS) {
    logger.warn('Contract address not configured, skipping indexing');
    return;
  }

  // Fetch logs for each event type
  for (const eventSig of EVENTS) {
    try {
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS as `0x${string}`,
        event: parseAbiItem(`event ${eventSig}`) as any,
        fromBlock,
        toBlock,
      });

      for (const log of logs) {
        await processEvent(log, eventSig.split('(')[0]);
      }
    } catch (error) {
      logger.error(`Error fetching logs for ${eventSig}:`, error);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
