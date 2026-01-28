import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();

// Redis or file-based queue for keeper alerts could be added here
const KEEPER_WEBHOOK_URL = process.env.KEEPER_WEBHOOK_URL;

export async function checkExecutableWills() {
  const now = new Date();

  // Find wills ready to be triggered (past inactivity threshold)
  const activeWills = await prisma.will.findMany({
    where: { status: 'ACTIVE' },
  });

  const triggerable: string[] = [];

  for (const will of activeWills) {
    const thresholdMs = Number(will.inactivityThreshold) * 1000;
    const triggerTime = new Date(will.lastActivityTime.getTime() + thresholdMs);

    if (triggerTime <= now) {
      triggerable.push(will.id);
      logger.info(`Will ${will.id} is ready to be triggered`);
    }
  }

  // Find wills ready to be executed (past grace period)
  const triggeredWills = await prisma.will.findMany({
    where: { status: 'IN_GRACE_PERIOD' },
  });

  const executable: string[] = [];

  for (const will of triggeredWills) {
    if (will.triggeredAt) {
      const gracePeriodMs = Number(will.gracePeriod) * 1000;
      const executeTime = new Date(will.triggeredAt.getTime() + gracePeriodMs);

      if (executeTime <= now) {
        executable.push(will.id);
        logger.info(`Will ${will.id} is ready to be executed`);
      }
    }
  }

  // Alert keeper bot if there are wills to process
  if ((triggerable.length > 0 || executable.length > 0) && KEEPER_WEBHOOK_URL) {
    await alertKeeper(triggerable, executable);
  }

  return { triggerable, executable };
}

async function alertKeeper(triggerable: string[], executable: string[]) {
  if (!KEEPER_WEBHOOK_URL) {
    logger.warn('Keeper webhook URL not configured');
    return;
  }

  try {
    const response = await fetch(KEEPER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        willsToTrigger: triggerable,
        willsToExecute: executable,
      }),
    });

    if (!response.ok) {
      logger.error(`Keeper webhook failed: ${response.status}`);
    } else {
      logger.info('Keeper alerted successfully');
    }
  } catch (error) {
    logger.error('Error alerting keeper:', error);
  }
}

// Get wills that will become triggerable in the next N hours
export async function getUpcomingTriggers(hoursAhead: number = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const activeWills = await prisma.will.findMany({
    where: { status: 'ACTIVE' },
    include: {
      testator: true,
      beneficiaries: true,
    },
  });

  const upcoming = [];

  for (const will of activeWills) {
    const thresholdMs = Number(will.inactivityThreshold) * 1000;
    const triggerTime = new Date(will.lastActivityTime.getTime() + thresholdMs);

    if (triggerTime > now && triggerTime <= future) {
      upcoming.push({
        willId: will.id,
        testator: will.testatorAddress,
        triggerTime,
        hoursUntilTrigger: (triggerTime.getTime() - now.getTime()) / (60 * 60 * 1000),
        totalValue: will.totalValue,
        beneficiaryCount: will.beneficiaries.length,
      });
    }
  }

  return upcoming.sort((a, b) => a.triggerTime.getTime() - b.triggerTime.getTime());
}

// Get wills that will become executable in the next N hours
export async function getUpcomingExecutions(hoursAhead: number = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const triggeredWills = await prisma.will.findMany({
    where: { status: 'IN_GRACE_PERIOD' },
    include: {
      beneficiaries: true,
    },
  });

  const upcoming = [];

  for (const will of triggeredWills) {
    if (will.triggeredAt) {
      const gracePeriodMs = Number(will.gracePeriod) * 1000;
      const executeTime = new Date(will.triggeredAt.getTime() + gracePeriodMs);

      if (executeTime > now && executeTime <= future) {
        upcoming.push({
          willId: will.id,
          testator: will.testatorAddress,
          executeTime,
          hoursUntilExecution: (executeTime.getTime() - now.getTime()) / (60 * 60 * 1000),
          totalValue: will.totalValue,
          beneficiaryCount: will.beneficiaries.length,
        });
      }
    }
  }

  return upcoming.sort((a, b) => a.executeTime.getTime() - b.executeTime.getTime());
}
