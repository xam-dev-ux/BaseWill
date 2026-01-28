import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const beneficiaryRouter = Router();

// Validation schemas
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

// GET /api/beneficiary/:address - Get all wills where address is a beneficiary
beneficiaryRouter.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    // Validate address
    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const beneficiaryEntries = await prisma.willBeneficiary.findMany({
      where: { beneficiaryAddress: address.toLowerCase() },
      include: {
        will: {
          include: {
            assets: true,
            beneficiaries: true,
          },
        },
      },
    });

    // Calculate stats
    let potentialInheritance = BigInt(0);
    let namedInWills = beneficiaryEntries.length;
    let claimableNow = BigInt(0);

    beneficiaryEntries.forEach(entry => {
      const will = entry.will;
      const totalValue = BigInt(will.totalValue);
      const allocation = (totalValue * BigInt(entry.allocationBps)) / BigInt(10000);

      potentialInheritance += allocation;

      if (will.status === 'EXECUTED' && !entry.hasClaimed) {
        claimableNow += allocation;
      }
    });

    // Transform for JSON
    const transformedEntries = beneficiaryEntries.map(entry => ({
      ...entry,
      vestingDuration: entry.vestingDuration?.toString(),
      cliffDuration: entry.cliffDuration?.toString(),
      will: {
        ...entry.will,
        onchainId: entry.will.onchainId.toString(),
        inactivityThreshold: entry.will.inactivityThreshold.toString(),
        gracePeriod: entry.will.gracePeriod.toString(),
        assets: entry.will.assets.map(a => ({
          ...a,
          tokenId: a.tokenId?.toString(),
        })),
        beneficiaries: entry.will.beneficiaries.map(b => ({
          ...b,
          vestingDuration: b.vestingDuration?.toString(),
          cliffDuration: b.cliffDuration?.toString(),
        })),
      },
    }));

    res.json({
      beneficiaryWills: transformedEntries,
      stats: {
        potentialInheritance: potentialInheritance.toString(),
        namedInWills,
        claimableNow: claimableNow.toString(),
      },
    });
  } catch (error) {
    logger.error('Error fetching beneficiary wills:', error);
    res.status(500).json({ error: 'Failed to fetch beneficiary wills' });
  }
});

// GET /api/beneficiary/:address/claimable - Get claimable assets
beneficiaryRouter.get('/:address/claimable', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const claimableEntries = await prisma.willBeneficiary.findMany({
      where: {
        beneficiaryAddress: address.toLowerCase(),
        hasClaimed: false,
        will: {
          status: 'EXECUTED',
        },
      },
      include: {
        will: {
          include: {
            assets: true,
          },
        },
      },
    });

    const transformedEntries = claimableEntries.map(entry => ({
      willId: entry.willId,
      allocationBps: entry.allocationBps,
      vestingType: entry.vestingType,
      willStatus: entry.will.status,
      totalWillValue: entry.will.totalValue,
      assets: entry.will.assets.map(a => ({
        ...a,
        tokenId: a.tokenId?.toString(),
      })),
    }));

    res.json({ claimable: transformedEntries });
  } catch (error) {
    logger.error('Error fetching claimable assets:', error);
    res.status(500).json({ error: 'Failed to fetch claimable assets' });
  }
});

// GET /api/beneficiary/:address/history - Get claim history
beneficiaryRouter.get('/:address/history', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    const result = addressSchema.safeParse(address);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid address format' });
    }

    const claimedEntries = await prisma.willBeneficiary.findMany({
      where: {
        beneficiaryAddress: address.toLowerCase(),
        hasClaimed: true,
      },
      include: {
        will: true,
      },
    });

    res.json({
      history: claimedEntries.map(entry => ({
        willId: entry.willId,
        claimedAmount: entry.claimedAmount,
        claimedAt: entry.updatedAt,
        testator: entry.will.testatorAddress,
      })),
    });
  } catch (error) {
    logger.error('Error fetching claim history:', error);
    res.status(500).json({ error: 'Failed to fetch claim history' });
  }
});
