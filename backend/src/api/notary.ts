import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const notaryRouter = Router();

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// GET /api/notary/:address - Get notary information
notaryRouter.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const notary = await prisma.notary.findUnique({
      where: { address: address.toLowerCase() },
      include: {
        assignments: {
          include: {
            will: true,
          },
        },
        verifications: {
          orderBy: { submittedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!notary) {
      return res.json({ isNotary: false, notary: null });
    }

    res.json({
      isNotary: true,
      notary: {
        ...notary,
        assignments: notary.assignments.map(a => ({
          ...a,
          will: {
            ...a.will,
            onchainId: a.will.onchainId.toString(),
            inactivityThreshold: a.will.inactivityThreshold.toString(),
            gracePeriod: a.will.gracePeriod.toString(),
          },
        })),
      },
    });
  } catch (error) {
    logger.error('Error fetching notary info:', error);
    res.status(500).json({ error: 'Failed to fetch notary info' });
  }
});

// GET /api/notary/:address/pending - Get pending verification requests
notaryRouter.get('/:address/pending', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const pendingAssignments = await prisma.notaryAssignment.findMany({
      where: {
        notaryAddr: address.toLowerCase(),
        will: {
          status: {
            in: ['TRIGGERED', 'IN_GRACE_PERIOD', 'PENDING_EXECUTION'],
          },
        },
      },
      include: {
        will: {
          include: {
            beneficiaries: true,
            assets: true,
          },
        },
      },
    });

    // Filter out already verified
    const existingVerifications = await prisma.notaryVerification.findMany({
      where: {
        notaryAddr: address.toLowerCase(),
        willId: {
          in: pendingAssignments.map(a => a.willId),
        },
      },
    });

    const verifiedWillIds = new Set(existingVerifications.map(v => v.willId));

    const pending = pendingAssignments.filter(a => !verifiedWillIds.has(a.willId));

    res.json({
      pending: pending.map(a => ({
        ...a,
        will: {
          ...a.will,
          onchainId: a.will.onchainId.toString(),
          inactivityThreshold: a.will.inactivityThreshold.toString(),
          gracePeriod: a.will.gracePeriod.toString(),
          assets: a.will.assets.map(asset => ({
            ...asset,
            tokenId: asset.tokenId?.toString(),
          })),
          beneficiaries: a.will.beneficiaries.map(b => ({
            ...b,
            vestingDuration: b.vestingDuration?.toString(),
            cliffDuration: b.cliffDuration?.toString(),
          })),
        },
      })),
    });
  } catch (error) {
    logger.error('Error fetching pending verifications:', error);
    res.status(500).json({ error: 'Failed to fetch pending verifications' });
  }
});

// GET /api/notary/leaderboard - Get top notaries
notaryRouter.get('/leaderboard/top', async (req: Request, res: Response) => {
  try {
    const { limit = '20' } = req.query;

    const notaries = await prisma.notary.findMany({
      where: { isActive: true },
      orderBy: [
        { reputation: 'desc' },
        { totalVerifications: 'desc' },
      ],
      take: parseInt(limit as string),
    });

    res.json({ leaderboard: notaries });
  } catch (error) {
    logger.error('Error fetching notary leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/notary/all - Get all active notaries
notaryRouter.get('/list/all', async (req: Request, res: Response) => {
  try {
    const notaries = await prisma.notary.findMany({
      where: { isActive: true },
      orderBy: { reputation: 'desc' },
    });

    res.json({ notaries });
  } catch (error) {
    logger.error('Error fetching notaries:', error);
    res.status(500).json({ error: 'Failed to fetch notaries' });
  }
});
