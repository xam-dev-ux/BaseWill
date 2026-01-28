import dotenv from 'dotenv';
import express from 'express';
import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { logger } from './logger.js';
import { BASE_WILL_ABI, CONTRACT_ADDRESS } from './config.js';

dotenv.config();

// Configuration
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY as `0x${string}`;
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const CHAIN = process.env.NETWORK === 'testnet' ? baseSepolia : base;
const MIN_PROFIT_MARGIN = parseEther(process.env.MIN_PROFIT_MARGIN || '0.0001'); // Minimum profit to execute
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL || '300000'); // 5 minutes
const PORT = parseInt(process.env.PORT || '3002');

// Validate configuration
if (!PRIVATE_KEY) {
  logger.error('KEEPER_PRIVATE_KEY not set');
  process.exit(1);
}

if (!CONTRACT_ADDRESS) {
  logger.error('CONTRACT_ADDRESS not set');
  process.exit(1);
}

// Create clients
const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(RPC_URL),
});

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({
  account,
  chain: CHAIN,
  transport: http(RPC_URL),
});

logger.info(`Keeper started with address: ${account.address}`);
logger.info(`Using contract: ${CONTRACT_ADDRESS}`);
logger.info(`Network: ${CHAIN.name}`);

// Webhook server for backend notifications
const app = express();
app.use(express.json());

app.post('/webhook', async (req, res) => {
  logger.info('Received webhook:', req.body);

  const { willsToTrigger, willsToExecute } = req.body;

  // Process immediately
  if (willsToTrigger?.length > 0) {
    for (const willId of willsToTrigger) {
      await tryTriggerWill(BigInt(willId));
    }
  }

  if (willsToExecute?.length > 0) {
    for (const willId of willsToExecute) {
      await tryExecuteWill(BigInt(willId));
    }
  }

  res.json({ success: true });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    address: account.address,
    timestamp: new Date().toISOString(),
  });
});

app.get('/stats', async (req, res) => {
  const balance = await publicClient.getBalance({ address: account.address });
  res.json({
    address: account.address,
    balance: formatEther(balance),
    network: CHAIN.name,
  });
});

// Core keeper functions

async function tryTriggerWill(willId: bigint): Promise<boolean> {
  logger.info(`Attempting to trigger will ${willId}`);

  try {
    // Check if will can be triggered
    const canTrigger = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'canTriggerWill',
      args: [willId],
    });

    if (!canTrigger) {
      logger.info(`Will ${willId} cannot be triggered`);
      return false;
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'triggerWill',
      args: [willId],
      account: account.address,
    });

    // Get gas price
    const gasPrice = await publicClient.getGasPrice();
    const gasCost = gasEstimate * gasPrice;

    // Check executor reward
    const executorReward = await getExecutorReward(willId);

    logger.info(`Will ${willId}: Gas cost ${formatEther(gasCost)} ETH, Reward ${formatEther(executorReward)} ETH`);

    // Check profitability
    if (executorReward < gasCost + MIN_PROFIT_MARGIN) {
      logger.info(`Will ${willId} not profitable to trigger`);
      return false;
    }

    // Execute trigger
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'triggerWill',
      args: [willId],
    });

    logger.info(`Will ${willId} triggered, tx: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      logger.info(`Will ${willId} trigger confirmed`);
      return true;
    } else {
      logger.error(`Will ${willId} trigger failed`);
      return false;
    }
  } catch (error) {
    logger.error(`Error triggering will ${willId}:`, error);
    return false;
  }
}

async function tryExecuteWill(willId: bigint): Promise<boolean> {
  logger.info(`Attempting to execute will ${willId}`);

  try {
    // Check if will can be executed
    const canExecute = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'canExecuteWill',
      args: [willId],
    });

    if (!canExecute) {
      logger.info(`Will ${willId} cannot be executed`);
      return false;
    }

    // Estimate gas
    const gasEstimate = await publicClient.estimateContractGas({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'executeWill',
      args: [willId],
      account: account.address,
    });

    // Get gas price
    const gasPrice = await publicClient.getGasPrice();
    const gasCost = gasEstimate * gasPrice;

    // Check executor reward
    const executorReward = await getExecutorReward(willId);

    logger.info(`Will ${willId}: Gas cost ${formatEther(gasCost)} ETH, Reward ${formatEther(executorReward)} ETH`);

    // Check profitability
    if (executorReward < gasCost + MIN_PROFIT_MARGIN) {
      logger.info(`Will ${willId} not profitable to execute`);
      return false;
    }

    // Execute will
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'executeWill',
      args: [willId],
    });

    logger.info(`Will ${willId} execution tx: ${hash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === 'success') {
      logger.info(`Will ${willId} executed successfully`);
      return true;
    } else {
      logger.error(`Will ${willId} execution failed`);
      return false;
    }
  } catch (error) {
    logger.error(`Error executing will ${willId}:`, error);
    return false;
  }
}

async function getExecutorReward(willId: bigint): Promise<bigint> {
  try {
    const [totalValue, executorRewardBps] = await Promise.all([
      publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: BASE_WILL_ABI,
        functionName: 'getWillTotalValue',
        args: [willId],
      }) as Promise<bigint>,
      publicClient.readContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: BASE_WILL_ABI,
        functionName: 'executorRewardPercent',
      }) as Promise<bigint>,
    ]);

    return (totalValue * executorRewardBps) / BigInt(10000);
  } catch (error) {
    logger.error(`Error getting executor reward for will ${willId}:`, error);
    return BigInt(0);
  }
}

async function scanForWills() {
  logger.info('Scanning for triggerable/executable wills...');

  try {
    // Get total will count
    const willCount = await publicClient.readContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: BASE_WILL_ABI,
      functionName: 'willCounter',
    }) as bigint;

    logger.info(`Total wills: ${willCount}`);

    let triggered = 0;
    let executed = 0;

    // Check each will (in production, use events or backend API for efficiency)
    for (let i = BigInt(1); i <= willCount; i++) {
      try {
        const willStatus = await publicClient.readContract({
          address: CONTRACT_ADDRESS as `0x${string}`,
          abi: BASE_WILL_ABI,
          functionName: 'getWillStatus',
          args: [i],
        }) as number;

        // Status 1 = ACTIVE, check for triggering
        if (willStatus === 1) {
          const canTrigger = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: BASE_WILL_ABI,
            functionName: 'canTriggerWill',
            args: [i],
          });

          if (canTrigger) {
            const success = await tryTriggerWill(i);
            if (success) triggered++;
          }
        }

        // Status 3 = IN_GRACE_PERIOD, check for execution
        if (willStatus === 3) {
          const canExecute = await publicClient.readContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: BASE_WILL_ABI,
            functionName: 'canExecuteWill',
            args: [i],
          });

          if (canExecute) {
            const success = await tryExecuteWill(i);
            if (success) executed++;
          }
        }
      } catch (error) {
        // Skip individual will errors
        continue;
      }
    }

    logger.info(`Scan complete: ${triggered} triggered, ${executed} executed`);
  } catch (error) {
    logger.error('Error scanning wills:', error);
  }
}

// Main loop
async function main() {
  // Start webhook server
  app.listen(PORT, () => {
    logger.info(`Webhook server listening on port ${PORT}`);
  });

  // Check balance
  const balance = await publicClient.getBalance({ address: account.address });
  logger.info(`Keeper balance: ${formatEther(balance)} ETH`);

  if (balance < parseEther('0.01')) {
    logger.warn('Low keeper balance! Please fund the keeper wallet.');
  }

  // Initial scan
  await scanForWills();

  // Periodic scanning
  setInterval(async () => {
    await scanForWills();
  }, CHECK_INTERVAL);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
