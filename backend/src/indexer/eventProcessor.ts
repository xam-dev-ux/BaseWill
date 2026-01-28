import { Log, decodeEventLog } from 'viem';
import { PrismaClient, ActivityType, WillStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { sendNotification } from '../notifications/service.js';
import { BASE_WILL_ABI } from './config.js';

const prisma = new PrismaClient();

export async function processEvent(log: Log, eventName: string) {
  const txHash = log.transactionHash || '';
  const blockNumber = log.blockNumber;

  logger.info(`Processing event: ${eventName} at block ${blockNumber}`);

  try {
    switch (eventName) {
      case 'WillCreated':
        await handleWillCreated(log, txHash);
        break;
      case 'WillUpdated':
        await handleWillUpdated(log, txHash);
        break;
      case 'WillCancelled':
        await handleWillCancelled(log, txHash);
        break;
      case 'BeneficiaryAdded':
        await handleBeneficiaryAdded(log, txHash);
        break;
      case 'BeneficiaryRemoved':
        await handleBeneficiaryRemoved(log, txHash);
        break;
      case 'BeneficiaryUpdated':
        await handleBeneficiaryUpdated(log, txHash);
        break;
      case 'ActivityRecorded':
      case 'CheckIn':
        await handleActivityRecorded(log, txHash, eventName);
        break;
      case 'WillTriggered':
        await handleWillTriggered(log, txHash);
        break;
      case 'TriggerCancelled':
        await handleTriggerCancelled(log, txHash);
        break;
      case 'WillExecuted':
        await handleWillExecuted(log, txHash);
        break;
      case 'AssetDistributed':
        await handleAssetDistributed(log, txHash);
        break;
      case 'AssetClaimed':
        await handleAssetClaimed(log, txHash);
        break;
      case 'NotaryAssigned':
        await handleNotaryAssigned(log, txHash);
        break;
      case 'NotaryVerificationSubmitted':
        await handleNotaryVerification(log, txHash);
        break;
      case 'NotaryRegistered':
        await handleNotaryRegistered(log, txHash);
        break;
      case 'NotarySlashed':
        await handleNotarySlashed(log, txHash);
        break;
      case 'DisputeFiled':
        await handleDisputeFiled(log, txHash);
        break;
      case 'DisputeResolved':
        await handleDisputeResolved(log, txHash);
        break;
      default:
        logger.warn(`Unhandled event: ${eventName}`);
    }

    // Update platform stats
    await updatePlatformStats();
  } catch (error) {
    logger.error(`Error processing ${eventName}:`, error);
  }
}

// Event handlers

async function handleWillCreated(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, testator, inactivityThreshold } = decoded.args as any;
  const willIdStr = willId.toString();

  // Ensure user exists
  await prisma.user.upsert({
    where: { address: testator.toLowerCase() },
    update: {},
    create: { address: testator.toLowerCase() },
  });

  // Create will record
  await prisma.will.create({
    data: {
      id: willIdStr,
      onchainId: BigInt(willId),
      testatorAddress: testator.toLowerCase(),
      status: WillStatus.ACTIVE,
      activationMode: 'INACTIVITY_BASED',
      inactivityThreshold: BigInt(inactivityThreshold),
      gracePeriod: BigInt(30 * 24 * 60 * 60), // Default 30 days
      lastActivityTime: new Date(),
      createdAt: new Date(),
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.WILL_CREATED,
      timestamp: new Date(),
      txHash,
    },
  });

  logger.info(`Will ${willIdStr} created by ${testator}`);
}

async function handleWillUpdated(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: {
      lastActivityTime: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.WILL_UPDATED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleWillCancelled(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: { status: WillStatus.CANCELLED },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.WILL_CANCELLED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleBeneficiaryAdded(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, beneficiary, allocationBps } = decoded.args as any;
  const willIdStr = willId.toString();

  // Ensure beneficiary user exists
  await prisma.user.upsert({
    where: { address: beneficiary.toLowerCase() },
    update: {},
    create: { address: beneficiary.toLowerCase() },
  });

  await prisma.willBeneficiary.create({
    data: {
      willId: willIdStr,
      beneficiaryAddress: beneficiary.toLowerCase(),
      allocationBps: Number(allocationBps),
      vestingType: 'IMMEDIATE',
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.BENEFICIARY_ADDED,
      timestamp: new Date(),
      txHash,
      details: { beneficiary: beneficiary.toLowerCase(), allocationBps: Number(allocationBps) },
    },
  });

  // Notify beneficiary
  await sendNotification({
    type: 'BENEFICIARY_DESIGNATED',
    address: beneficiary.toLowerCase(),
    willId: willIdStr,
  });
}

async function handleBeneficiaryRemoved(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, beneficiary } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.willBeneficiary.delete({
    where: {
      willId_beneficiaryAddress: {
        willId: willIdStr,
        beneficiaryAddress: beneficiary.toLowerCase(),
      },
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.BENEFICIARY_REMOVED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleBeneficiaryUpdated(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, beneficiary, newAllocationBps } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.willBeneficiary.update({
    where: {
      willId_beneficiaryAddress: {
        willId: willIdStr,
        beneficiaryAddress: beneficiary.toLowerCase(),
      },
    },
    data: { allocationBps: Number(newAllocationBps) },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.BENEFICIARY_UPDATED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleActivityRecorded(log: Log, txHash: string, eventName: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: { lastActivityTime: new Date() },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: eventName === 'CheckIn' ? ActivityType.CHECK_IN : ActivityType.WILL_UPDATED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleWillTriggered(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, gracePeriodEnd } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: {
      status: WillStatus.IN_GRACE_PERIOD,
      triggeredAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.WILL_TRIGGERED,
      timestamp: new Date(),
      txHash,
    },
  });

  // Notify testator
  const will = await prisma.will.findUnique({ where: { id: willIdStr } });
  if (will) {
    await sendNotification({
      type: 'WILL_TRIGGERED',
      address: will.testatorAddress,
      willId: willIdStr,
    });
  }
}

async function handleTriggerCancelled(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: {
      status: WillStatus.ACTIVE,
      triggeredAt: null,
      lastActivityTime: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.TRIGGER_CANCELLED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleWillExecuted(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, totalDistributed } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.will.update({
    where: { id: willIdStr },
    data: {
      status: WillStatus.EXECUTED,
      executedAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.WILL_EXECUTED,
      timestamp: new Date(),
      txHash,
      details: { totalDistributed: totalDistributed.toString() },
    },
  });

  // Notify all beneficiaries
  const beneficiaries = await prisma.willBeneficiary.findMany({
    where: { willId: willIdStr },
  });

  for (const beneficiary of beneficiaries) {
    await sendNotification({
      type: 'WILL_EXECUTED',
      address: beneficiary.beneficiaryAddress,
      willId: willIdStr,
    });
  }
}

async function handleAssetDistributed(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, beneficiary, amount } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.ASSET_DISTRIBUTED,
      timestamp: new Date(),
      txHash,
      details: {
        beneficiary: beneficiary.toLowerCase(),
        amount: amount.toString(),
      },
    },
  });

  await sendNotification({
    type: 'ASSET_DISTRIBUTED',
    address: beneficiary.toLowerCase(),
    willId: willIdStr,
  });
}

async function handleAssetClaimed(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, beneficiary, amount } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.willBeneficiary.update({
    where: {
      willId_beneficiaryAddress: {
        willId: willIdStr,
        beneficiaryAddress: beneficiary.toLowerCase(),
      },
    },
    data: {
      hasClaimed: true,
      claimedAmount: amount.toString(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.ASSET_CLAIMED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleNotaryAssigned(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, notary } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.notaryAssignment.create({
    data: {
      willId: willIdStr,
      notaryAddr: notary.toLowerCase(),
    },
  });
}

async function handleNotaryVerification(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, notary, verified } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.notaryVerification.create({
    data: {
      willId: willIdStr,
      notaryAddr: notary.toLowerCase(),
      verified,
      txHash,
    },
  });

  // Update notary stats
  await prisma.notary.update({
    where: { address: notary.toLowerCase() },
    data: {
      totalVerifications: { increment: 1 },
      successfulVerifications: verified ? { increment: 1 } : undefined,
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.NOTARY_VERIFICATION,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleNotaryRegistered(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { notary, stake } = decoded.args as any;

  // Ensure user exists
  await prisma.user.upsert({
    where: { address: notary.toLowerCase() },
    update: {},
    create: { address: notary.toLowerCase() },
  });

  await prisma.notary.create({
    data: {
      address: notary.toLowerCase(),
      stake: stake.toString(),
      isActive: true,
    },
  });

  logger.info(`Notary registered: ${notary} with stake ${stake}`);
}

async function handleNotarySlashed(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { notary, slashedAmount } = decoded.args as any;

  const existingNotary = await prisma.notary.findUnique({
    where: { address: notary.toLowerCase() },
  });

  if (existingNotary) {
    const newStake = BigInt(existingNotary.stake) - BigInt(slashedAmount);
    await prisma.notary.update({
      where: { address: notary.toLowerCase() },
      data: {
        stake: newStake.toString(),
        reputation: { decrement: 10 },
      },
    });
  }
}

async function handleDisputeFiled(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, filer, reason } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.dispute.create({
    data: {
      willId: willIdStr,
      filer: filer.toLowerCase(),
      reason,
      bond: '0',
    },
  });

  await prisma.will.update({
    where: { id: willIdStr },
    data: { status: WillStatus.DISPUTED },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.DISPUTE_FILED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function handleDisputeResolved(log: Log, txHash: string) {
  const decoded = decodeEventLog({
    abi: BASE_WILL_ABI,
    data: log.data,
    topics: log.topics,
  });

  const { willId, inFavor } = decoded.args as any;
  const willIdStr = willId.toString();

  await prisma.dispute.updateMany({
    where: {
      willId: willIdStr,
      status: 'PENDING',
    },
    data: {
      status: inFavor ? 'RESOLVED_IN_FAVOR' : 'RESOLVED_AGAINST',
      resolvedAt: new Date(),
    },
  });

  await prisma.activity.create({
    data: {
      willId: willIdStr,
      type: ActivityType.DISPUTE_RESOLVED,
      timestamp: new Date(),
      txHash,
    },
  });
}

async function updatePlatformStats() {
  const [totalCreated, active, executed, cancelled, notaries] = await Promise.all([
    prisma.will.count(),
    prisma.will.count({ where: { status: 'ACTIVE' } }),
    prisma.will.count({ where: { status: 'EXECUTED' } }),
    prisma.will.count({ where: { status: 'CANCELLED' } }),
    prisma.notary.count({ where: { isActive: true } }),
  ]);

  // Calculate total values
  const activeWills = await prisma.will.findMany({
    where: { status: 'ACTIVE' },
    select: { totalValue: true },
  });

  const executedWills = await prisma.will.findMany({
    where: { status: 'EXECUTED' },
    select: { totalValue: true },
  });

  const totalValueSecured = activeWills.reduce(
    (sum, w) => sum + BigInt(w.totalValue),
    BigInt(0)
  );

  const totalDistributed = executedWills.reduce(
    (sum, w) => sum + BigInt(w.totalValue),
    BigInt(0)
  );

  await prisma.platformStats.update({
    where: { id: 'singleton' },
    data: {
      totalWillsCreated: totalCreated,
      activeWills: active,
      executedWills: executed,
      cancelledWills: cancelled,
      registeredNotaries: notaries,
      totalValueSecured: totalValueSecured.toString(),
      totalDistributed: totalDistributed.toString(),
    },
  });
}
