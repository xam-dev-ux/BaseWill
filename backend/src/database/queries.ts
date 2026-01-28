import { PrismaClient, WillStatus } from '@prisma/client';

const prisma = new PrismaClient();

// Get wills ready to be triggered (inactivity threshold passed)
export async function getWillsReadyToTrigger() {
  const now = new Date();

  const activeWills = await prisma.will.findMany({
    where: { status: WillStatus.ACTIVE },
    include: {
      beneficiaries: true,
      notaryAssignments: true,
    },
  });

  return activeWills.filter(will => {
    const thresholdMs = Number(will.inactivityThreshold) * 1000;
    const triggerTime = new Date(will.lastActivityTime.getTime() + thresholdMs);
    return triggerTime <= now;
  });
}

// Get wills ready to be executed (grace period passed)
export async function getWillsReadyToExecute() {
  const now = new Date();

  const triggeredWills = await prisma.will.findMany({
    where: { status: WillStatus.IN_GRACE_PERIOD },
    include: {
      beneficiaries: true,
      assets: true,
      notaryAssignments: {
        include: { notary: true },
      },
    },
  });

  return triggeredWills.filter(will => {
    if (!will.triggeredAt) return false;
    const gracePeriodMs = Number(will.gracePeriod) * 1000;
    const executeTime = new Date(will.triggeredAt.getTime() + gracePeriodMs);
    return executeTime <= now;
  });
}

// Get will by onchain ID
export async function getWillByOnchainId(onchainId: bigint) {
  return prisma.will.findUnique({
    where: { onchainId },
    include: {
      beneficiaries: true,
      assets: true,
      activities: {
        orderBy: { timestamp: 'desc' },
        take: 10,
      },
    },
  });
}

// Get testator's active will count
export async function getTestatorActiveWillCount(address: string) {
  return prisma.will.count({
    where: {
      testatorAddress: address.toLowerCase(),
      status: WillStatus.ACTIVE,
    },
  });
}

// Get beneficiary's pending claims
export async function getBeneficiaryPendingClaims(address: string) {
  return prisma.willBeneficiary.findMany({
    where: {
      beneficiaryAddress: address.toLowerCase(),
      hasClaimed: false,
      will: {
        status: WillStatus.EXECUTED,
      },
    },
    include: {
      will: {
        include: { assets: true },
      },
    },
  });
}

// Get notary's pending verifications
export async function getNotaryPendingVerifications(address: string) {
  const assignments = await prisma.notaryAssignment.findMany({
    where: {
      notaryAddr: address.toLowerCase(),
      will: {
        status: {
          in: [WillStatus.TRIGGERED, WillStatus.IN_GRACE_PERIOD, WillStatus.PENDING_EXECUTION],
        },
      },
    },
    include: {
      will: true,
    },
  });

  // Filter out already verified
  const verifications = await prisma.notaryVerification.findMany({
    where: {
      notaryAddr: address.toLowerCase(),
    },
    select: { willId: true },
  });

  const verifiedWillIds = new Set(verifications.map(v => v.willId));

  return assignments.filter(a => !verifiedWillIds.has(a.willId));
}

// Record a new activity
export async function recordActivity(
  willId: string,
  type: string,
  txHash?: string,
  details?: any
) {
  return prisma.activity.create({
    data: {
      willId,
      type: type as any,
      timestamp: new Date(),
      txHash,
      details,
    },
  });
}

// Get recent platform activity for dashboard
export async function getRecentActivity(limit: number = 20) {
  return prisma.activity.findMany({
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      will: {
        select: {
          id: true,
          testatorAddress: true,
          status: true,
        },
      },
    },
  });
}

// Search wills by testator or beneficiary
export async function searchWills(query: string) {
  const address = query.toLowerCase();

  const [asTestator, asBeneficiary] = await Promise.all([
    prisma.will.findMany({
      where: { testatorAddress: address },
      include: { beneficiaries: true },
    }),
    prisma.willBeneficiary.findMany({
      where: { beneficiaryAddress: address },
      include: { will: true },
    }),
  ]);

  return {
    asTestator,
    asBeneficiary,
  };
}
