import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const usersRouter = Router();

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// GET /api/users/:address - Get user profile
usersRouter.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        testatorWills: {
          select: {
            id: true,
            status: true,
            totalValue: true,
          },
        },
        notaryInfo: true,
      },
    });

    if (!user) {
      // Return default profile for unregistered users
      return res.json({
        address: address.toLowerCase(),
        isRegistered: false,
        stats: {
          totalWills: 0,
          activeWills: 0,
          totalValueSecured: '0',
          isNotary: false,
        },
      });
    }

    // Calculate stats
    const activeWills = user.testatorWills.filter(w => w.status === 'ACTIVE').length;
    const totalValue = user.testatorWills.reduce(
      (sum, w) => sum + BigInt(w.totalValue),
      BigInt(0)
    );

    res.json({
      address: user.address,
      email: user.email,
      telegram: user.telegram,
      isRegistered: true,
      createdAt: user.createdAt,
      preferences: {
        checkInReminders: user.notifyCheckInReminders,
        willTriggered: user.notifyWillTriggered,
        assetDistributed: user.notifyAssetDistributed,
        platformUpdates: user.notifyPlatformUpdates,
      },
      stats: {
        totalWills: user.testatorWills.length,
        activeWills,
        totalValueSecured: totalValue.toString(),
        isNotary: !!user.notaryInfo,
      },
    });
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// PUT /api/users/:address - Update user profile
usersRouter.put('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { email, telegram } = req.body;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const user = await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {
        email,
        telegram,
      },
      create: {
        address: address.toLowerCase(),
        email,
        telegram,
      },
    });

    res.json({
      success: true,
      user: {
        address: user.address,
        email: user.email,
        telegram: user.telegram,
      },
    });
  } catch (error) {
    logger.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// GET /api/users/:address/activity - Get user activity
usersRouter.get('/:address/activity', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { limit = '50' } = req.query;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    // Get wills owned by user
    const wills = await prisma.will.findMany({
      where: { testatorAddress: address.toLowerCase() },
      select: { id: true },
    });

    const willIds = wills.map(w => w.id);

    const activities = await prisma.activity.findMany({
      where: {
        willId: { in: willIds },
      },
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
      include: {
        will: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    res.json({ activities });
  } catch (error) {
    logger.error('Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});
