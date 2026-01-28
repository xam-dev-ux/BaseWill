import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const willsRouter = Router();

// Validation schemas
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// GET /api/wills/:address - Get all wills for a testator
willsRouter.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Validate address
    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const wills = await prisma.will.findMany({
      where: { testatorAddress: address.toLowerCase() },
      include: {
        beneficiaries: true,
        assets: true,
        notaryAssignments: {
          include: { notary: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform BigInt to string for JSON serialization
    const transformedWills = wills.map(will => ({
      ...will,
      onchainId: will.onchainId.toString(),
      inactivityThreshold: will.inactivityThreshold.toString(),
      gracePeriod: will.gracePeriod.toString(),
      beneficiaries: will.beneficiaries.map(b => ({
        ...b,
        vestingDuration: b.vestingDuration?.toString(),
        cliffDuration: b.cliffDuration?.toString(),
      })),
      assets: will.assets.map(a => ({
        ...a,
        tokenId: a.tokenId?.toString(),
      })),
    }));

    res.json({ wills: transformedWills });
  } catch (error) {
    logger.error('Error fetching testator wills:', error);
    res.status(500).json({ error: 'Failed to fetch wills' });
  }
});

// GET /api/wills/detail/:id - Get detailed will information
willsRouter.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const will = await prisma.will.findUnique({
      where: { id },
      include: {
        beneficiaries: true,
        assets: true,
        activities: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
        notaryAssignments: {
          include: { notary: true }
        },
        disputes: true,
      },
    });

    if (!will) {
      return res.status(404).json({ error: 'Will not found' });
    }

    // Transform for JSON
    const transformedWill = {
      ...will,
      onchainId: will.onchainId.toString(),
      inactivityThreshold: will.inactivityThreshold.toString(),
      gracePeriod: will.gracePeriod.toString(),
      beneficiaries: will.beneficiaries.map(b => ({
        ...b,
        vestingDuration: b.vestingDuration?.toString(),
        cliffDuration: b.cliffDuration?.toString(),
      })),
      assets: will.assets.map(a => ({
        ...a,
        tokenId: a.tokenId?.toString(),
      })),
    };

    res.json({ will: transformedWill });
  } catch (error) {
    logger.error('Error fetching will details:', error);
    res.status(500).json({ error: 'Failed to fetch will' });
  }
});

// GET /api/wills/:id/activity - Get activity timeline for a will
willsRouter.get('/:id/activity', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const activities = await prisma.activity.findMany({
      where: { willId: id },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.activity.count({
      where: { willId: id },
    });

    res.json({
      activities,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    logger.error('Error fetching will activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/wills/approaching-threshold - Get wills approaching inactivity threshold
willsRouter.get('/status/approaching-threshold', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const wills = await prisma.will.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        testator: true,
      },
    });

    // Filter wills approaching threshold
    const approachingWills = wills.filter(will => {
      const thresholdMs = Number(will.inactivityThreshold) * 1000;
      const triggerTime = new Date(will.lastActivityTime.getTime() + thresholdMs);
      return triggerTime <= thirtyDaysFromNow;
    });

    const transformedWills = approachingWills.map(will => ({
      ...will,
      onchainId: will.onchainId.toString(),
      inactivityThreshold: will.inactivityThreshold.toString(),
      gracePeriod: will.gracePeriod.toString(),
      triggerTime: new Date(
        will.lastActivityTime.getTime() + Number(will.inactivityThreshold) * 1000
      ),
    }));

    res.json({ wills: transformedWills });
  } catch (error) {
    logger.error('Error fetching approaching wills:', error);
    res.status(500).json({ error: 'Failed to fetch wills' });
  }
});
