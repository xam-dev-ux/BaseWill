import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const statsRouter = Router();

// GET /api/stats - Get platform statistics
statsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const stats = await prisma.platformStats.findUnique({
      where: { id: 'singleton' },
    });

    if (!stats) {
      return res.json({
        totalWillsCreated: 0,
        activeWills: 0,
        executedWills: 0,
        cancelledWills: 0,
        totalValueSecured: '0',
        totalDistributed: '0',
        registeredNotaries: 0,
      });
    }

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching platform stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/stats/wills-over-time - Get wills created over time
statsRouter.get('/wills-over-time', async (req: Request, res: Response) => {
  try {
    const { period = '30d' } = req.query;

    let startDate: Date;
    switch (period) {
      case '7d':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const wills = await prisma.will.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        status: true,
        totalValue: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyStats: Record<string, { created: number; value: bigint }> = {};

    wills.forEach(will => {
      const day = will.createdAt.toISOString().split('T')[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { created: 0, value: BigInt(0) };
      }
      dailyStats[day].created++;
      dailyStats[day].value += BigInt(will.totalValue);
    });

    const data = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      created: stats.created,
      value: stats.value.toString(),
    }));

    res.json({ data });
  } catch (error) {
    logger.error('Error fetching wills over time:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// GET /api/stats/value-distribution - Get value distribution stats
statsRouter.get('/value-distribution', async (req: Request, res: Response) => {
  try {
    const wills = await prisma.will.findMany({
      where: { status: 'ACTIVE' },
      select: { totalValue: true },
    });

    // Define value ranges (in ETH)
    const ranges = {
      '0-0.1': 0,
      '0.1-1': 0,
      '1-10': 0,
      '10-100': 0,
      '100+': 0,
    };

    wills.forEach(will => {
      const valueEth = Number(BigInt(will.totalValue)) / 1e18;
      if (valueEth < 0.1) ranges['0-0.1']++;
      else if (valueEth < 1) ranges['0.1-1']++;
      else if (valueEth < 10) ranges['1-10']++;
      else if (valueEth < 100) ranges['10-100']++;
      else ranges['100+']++;
    });

    const data = Object.entries(ranges).map(([range, count]) => ({
      range,
      count,
    }));

    res.json({ data });
  } catch (error) {
    logger.error('Error fetching value distribution:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// GET /api/stats/activity - Recent platform activity
statsRouter.get('/activity', async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const activities = await prisma.activity.findMany({
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
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

    res.json({ activities });
  } catch (error) {
    logger.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});
