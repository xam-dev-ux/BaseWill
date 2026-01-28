import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

export async function updatePlatformStats() {
  try {
    // Count wills by status
    const [totalCreated, active, executed, cancelled, disputed] = await Promise.all([
      prisma.will.count(),
      prisma.will.count({ where: { status: 'ACTIVE' } }),
      prisma.will.count({ where: { status: 'EXECUTED' } }),
      prisma.will.count({ where: { status: 'CANCELLED' } }),
      prisma.will.count({ where: { status: 'DISPUTED' } }),
    ]);

    // Count notaries
    const notaries = await prisma.notary.count({ where: { isActive: true } });

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
      (sum, w) => sum + BigInt(w.totalValue || '0'),
      BigInt(0)
    );

    const totalDistributed = executedWills.reduce(
      (sum, w) => sum + BigInt(w.totalValue || '0'),
      BigInt(0)
    );

    // Update stats
    await prisma.platformStats.upsert({
      where: { id: 'singleton' },
      update: {
        totalWillsCreated: totalCreated,
        activeWills: active,
        executedWills: executed,
        cancelledWills: cancelled,
        registeredNotaries: notaries,
        totalValueSecured: totalValueSecured.toString(),
        totalDistributed: totalDistributed.toString(),
      },
      create: {
        id: 'singleton',
        totalWillsCreated: totalCreated,
        activeWills: active,
        executedWills: executed,
        cancelledWills: cancelled,
        registeredNotaries: notaries,
        totalValueSecured: totalValueSecured.toString(),
        totalDistributed: totalDistributed.toString(),
      },
    });

    logger.info(`Platform stats updated: ${totalCreated} wills, ${active} active, ${totalValueSecured} secured`);
  } catch (error) {
    logger.error('Error updating platform stats:', error);
    throw error;
  }
}

// Calculate additional metrics for analytics
export async function getDetailedStats() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Wills created in time periods
  const [willsLast7Days, willsLast30Days] = await Promise.all([
    prisma.will.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.will.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  // Average will value
  const allWills = await prisma.will.findMany({
    select: { totalValue: true },
  });

  let totalValue = BigInt(0);
  for (const will of allWills) {
    totalValue += BigInt(will.totalValue || '0');
  }
  const avgValue = allWills.length > 0 ? totalValue / BigInt(allWills.length) : BigInt(0);

  // Beneficiary stats
  const totalBeneficiaries = await prisma.willBeneficiary.count();
  const uniqueBeneficiaries = await prisma.willBeneficiary.groupBy({
    by: ['beneficiaryAddress'],
  });

  // Activity stats
  const [checkInsLast7Days, checkInsLast30Days] = await Promise.all([
    prisma.activity.count({
      where: {
        type: 'CHECK_IN',
        timestamp: { gte: sevenDaysAgo },
      },
    }),
    prisma.activity.count({
      where: {
        type: 'CHECK_IN',
        timestamp: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // Execution rate
  const executedCount = await prisma.will.count({ where: { status: 'EXECUTED' } });
  const cancelledCount = await prisma.will.count({ where: { status: 'CANCELLED' } });
  const completedWills = executedCount + cancelledCount;
  const executionRate = completedWills > 0 ? (executedCount / completedWills) * 100 : 0;

  // Notary stats
  const notaryStats = await prisma.notary.aggregate({
    _avg: { reputation: true },
    _sum: { totalVerifications: true },
  });

  return {
    willsCreated: {
      last7Days: willsLast7Days,
      last30Days: willsLast30Days,
    },
    averageWillValue: avgValue.toString(),
    beneficiaries: {
      total: totalBeneficiaries,
      unique: uniqueBeneficiaries.length,
    },
    checkIns: {
      last7Days: checkInsLast7Days,
      last30Days: checkInsLast30Days,
    },
    executionRate: executionRate.toFixed(2),
    notaries: {
      averageReputation: notaryStats._avg.reputation || 0,
      totalVerifications: notaryStats._sum.totalVerifications || 0,
    },
  };
}
