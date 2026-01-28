import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient();
export const notificationsRouter = Router();

// Validation schemas
const subscribeSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  email: z.string().email().optional(),
  telegram: z.string().optional(),
  pushSubscription: z.object({
    endpoint: z.string(),
    keys: z.object({
      p256dh: z.string(),
      auth: z.string(),
    }),
  }).optional(),
  preferences: z.object({
    checkInReminders: z.boolean().optional(),
    willTriggered: z.boolean().optional(),
    assetDistributed: z.boolean().optional(),
    platformUpdates: z.boolean().optional(),
  }).optional(),
});

// POST /api/notifications/subscribe - Subscribe to notifications
notificationsRouter.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const result = subscribeSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid request body', details: result.error });
    }

    const { address, email, telegram, pushSubscription, preferences } = result.data;

    const user = await prisma.user.upsert({
      where: { address: address.toLowerCase() },
      update: {
        email,
        telegram,
        pushSubscription: pushSubscription as any,
        ...(preferences && {
          notifyCheckInReminders: preferences.checkInReminders ?? true,
          notifyWillTriggered: preferences.willTriggered ?? true,
          notifyAssetDistributed: preferences.assetDistributed ?? true,
          notifyPlatformUpdates: preferences.platformUpdates ?? false,
        }),
      },
      create: {
        address: address.toLowerCase(),
        email,
        telegram,
        pushSubscription: pushSubscription as any,
        notifyCheckInReminders: preferences?.checkInReminders ?? true,
        notifyWillTriggered: preferences?.willTriggered ?? true,
        notifyAssetDistributed: preferences?.assetDistributed ?? true,
        notifyPlatformUpdates: preferences?.platformUpdates ?? false,
      },
    });

    res.json({ success: true, user: { address: user.address, email: user.email } });
  } catch (error) {
    logger.error('Error subscribing to notifications:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// DELETE /api/notifications/unsubscribe - Unsubscribe from notifications
notificationsRouter.delete('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { address } = req.body;

    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    await prisma.user.update({
      where: { address: address.toLowerCase() },
      data: {
        email: null,
        telegram: null,
        pushSubscription: null,
        notifyCheckInReminders: false,
        notifyWillTriggered: false,
        notifyAssetDistributed: false,
        notifyPlatformUpdates: false,
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// GET /api/notifications/:address - Get user notifications
notificationsRouter.get('/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { limit = '50', unreadOnly = 'false' } = req.query;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      return res.json({ notifications: [] });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly === 'true' && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ notifications });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/:address/read - Mark notifications as read
notificationsRouter.post('/:address/read', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { notificationIds } = req.body;

    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (notificationIds && Array.isArray(notificationIds)) {
      await prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId: user.id,
        },
        data: { readAt: new Date() },
      });
    } else {
      // Mark all as read
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Error marking notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// PUT /api/notifications/:address/preferences - Update notification preferences
notificationsRouter.put('/:address/preferences', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const { preferences } = req.body;

    await prisma.user.update({
      where: { address: address.toLowerCase() },
      data: {
        notifyCheckInReminders: preferences.checkInReminders,
        notifyWillTriggered: preferences.willTriggered,
        notifyAssetDistributed: preferences.assetDistributed,
        notifyPlatformUpdates: preferences.platformUpdates,
      },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error updating preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});
