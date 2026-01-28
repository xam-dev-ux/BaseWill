import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { PrismaClient, NotificationType } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { getEmailTemplate } from './templates.js';

const prisma = new PrismaClient();

// Configure web push
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:support@basewill.xyz',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface NotificationPayload {
  type: NotificationType | string;
  address: string;
  willId?: string;
  data?: Record<string, any>;
}

export async function sendNotification(payload: NotificationPayload) {
  const { type, address, willId, data } = payload;

  try {
    // Get user
    const user = await prisma.user.findUnique({
      where: { address: address.toLowerCase() },
    });

    if (!user) {
      logger.info(`No user found for address ${address}, skipping notification`);
      return;
    }

    // Check user preferences
    if (!shouldSendNotification(user, type)) {
      logger.info(`User ${address} has disabled ${type} notifications`);
      return;
    }

    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        userId: user.id,
        willId,
        type: type as NotificationType,
        title: getNotificationTitle(type),
        message: getNotificationMessage(type, data),
      },
    });

    // Send email if configured
    if (user.email) {
      await sendEmail(user.email, type, willId, data);
    }

    // Send push notification if configured
    if (user.pushSubscription) {
      await sendPushNotification(
        user.pushSubscription as webpush.PushSubscription,
        type,
        data
      );
    }

    // Mark notification as sent
    await prisma.notification.update({
      where: { id: notification.id },
      data: { sent: true, sentAt: new Date() },
    });

    logger.info(`Notification sent to ${address}: ${type}`);
  } catch (error) {
    logger.error('Error sending notification:', error);
  }
}

function shouldSendNotification(user: any, type: string): boolean {
  switch (type) {
    case 'CHECK_IN_REMINDER_30D':
    case 'CHECK_IN_REMINDER_7D':
    case 'CHECK_IN_REMINDER_24H':
      return user.notifyCheckInReminders;
    case 'WILL_TRIGGERED':
    case 'GRACE_PERIOD_ENDING':
      return user.notifyWillTriggered;
    case 'WILL_EXECUTED':
    case 'ASSET_DISTRIBUTED':
    case 'ASSET_CLAIMED':
      return user.notifyAssetDistributed;
    case 'PLATFORM_UPDATE':
      return user.notifyPlatformUpdates;
    default:
      return true;
  }
}

function getNotificationTitle(type: string): string {
  const titles: Record<string, string> = {
    CHECK_IN_REMINDER_30D: 'Check-in Reminder: 30 Days Left',
    CHECK_IN_REMINDER_7D: 'Check-in Reminder: 7 Days Left',
    CHECK_IN_REMINDER_24H: 'Urgent: Check-in Required Within 24 Hours',
    WILL_TRIGGERED: 'Your Will Has Been Triggered',
    GRACE_PERIOD_ENDING: 'Grace Period Ending Soon',
    WILL_EXECUTED: 'Will Executed - Assets Distributed',
    ASSET_DISTRIBUTED: 'You Have Received Assets',
    BENEFICIARY_DESIGNATED: 'You\'ve Been Named as a Beneficiary',
    BENEFICIARY_ACCEPTED: 'Beneficiary Accepted Designation',
    NOTARY_VERIFICATION_REQUESTED: 'Verification Request',
    NOTARY_VERIFICATION_RECEIVED: 'Notary Verification Received',
    DISPUTE_FILED: 'Dispute Filed Against Will',
    DISPUTE_RESOLVED: 'Dispute Resolved',
    PLATFORM_UPDATE: 'BaseWill Platform Update',
  };
  return titles[type] || 'BaseWill Notification';
}

function getNotificationMessage(type: string, data?: Record<string, any>): string {
  const messages: Record<string, string> = {
    CHECK_IN_REMINDER_30D: 'Your will\'s inactivity threshold is approaching. Check in to confirm you\'re still active.',
    CHECK_IN_REMINDER_7D: 'Only 7 days until your will\'s inactivity threshold. Please check in soon.',
    CHECK_IN_REMINDER_24H: 'Your will will be triggered in 24 hours if you don\'t check in. Take action now.',
    WILL_TRIGGERED: 'Your will has been triggered due to inactivity. You have a grace period to cancel.',
    GRACE_PERIOD_ENDING: 'Your grace period is ending soon. Check in to cancel the trigger.',
    WILL_EXECUTED: 'A will has been executed and assets have been distributed.',
    ASSET_DISTRIBUTED: 'Assets have been distributed to you from a will.',
    BENEFICIARY_DESIGNATED: 'Someone has named you as a beneficiary in their will.',
    BENEFICIARY_ACCEPTED: 'A beneficiary has accepted their designation in your will.',
    NOTARY_VERIFICATION_REQUESTED: 'You have been assigned to verify a will.',
    NOTARY_VERIFICATION_RECEIVED: 'A notary has submitted verification for your will.',
    DISPUTE_FILED: 'A dispute has been filed against a will you\'re involved in.',
    DISPUTE_RESOLVED: 'A dispute has been resolved.',
    PLATFORM_UPDATE: 'There\'s a new update from BaseWill.',
  };
  return messages[type] || 'You have a new notification from BaseWill.';
}

async function sendEmail(
  to: string,
  type: string,
  willId?: string,
  data?: Record<string, any>
) {
  if (!process.env.SMTP_USER) {
    logger.warn('Email not configured, skipping email notification');
    return;
  }

  try {
    const { subject, html } = getEmailTemplate(type, willId, data);

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'BaseWill <noreply@basewill.xyz>',
      to,
      subject,
      html,
    });

    logger.info(`Email sent to ${to}: ${type}`);
  } catch (error) {
    logger.error('Error sending email:', error);
  }
}

async function sendPushNotification(
  subscription: webpush.PushSubscription,
  type: string,
  data?: Record<string, any>
) {
  if (!process.env.VAPID_PUBLIC_KEY) {
    logger.warn('Web push not configured, skipping push notification');
    return;
  }

  try {
    const payload = JSON.stringify({
      title: getNotificationTitle(type),
      body: getNotificationMessage(type, data),
      icon: '/logo.png',
      badge: '/badge.png',
      data: { type, ...data },
    });

    await webpush.sendNotification(subscription, payload);
    logger.info('Push notification sent');
  } catch (error) {
    logger.error('Error sending push notification:', error);
  }
}

// Bulk notification for deadline reminders
export async function sendDeadlineReminders() {
  const now = new Date();

  // Find wills approaching their threshold
  const activeWills = await prisma.will.findMany({
    where: { status: 'ACTIVE' },
    include: { testator: true },
  });

  for (const will of activeWills) {
    const thresholdMs = Number(will.inactivityThreshold) * 1000;
    const triggerTime = new Date(will.lastActivityTime.getTime() + thresholdMs);
    const timeUntilTrigger = triggerTime.getTime() - now.getTime();

    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;
    const thirtyDaysMs = 30 * oneDayMs;

    // Check which reminder to send
    if (timeUntilTrigger <= oneDayMs && timeUntilTrigger > 0) {
      // Check if we already sent this reminder
      const existingNotification = await prisma.notification.findFirst({
        where: {
          willId: will.id,
          type: 'CHECK_IN_REMINDER_24H',
          createdAt: { gte: new Date(now.getTime() - oneDayMs) },
        },
      });

      if (!existingNotification) {
        await sendNotification({
          type: 'CHECK_IN_REMINDER_24H',
          address: will.testatorAddress,
          willId: will.id,
        });
      }
    } else if (timeUntilTrigger <= sevenDaysMs && timeUntilTrigger > oneDayMs) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          willId: will.id,
          type: 'CHECK_IN_REMINDER_7D',
          createdAt: { gte: new Date(now.getTime() - sevenDaysMs) },
        },
      });

      if (!existingNotification) {
        await sendNotification({
          type: 'CHECK_IN_REMINDER_7D',
          address: will.testatorAddress,
          willId: will.id,
        });
      }
    } else if (timeUntilTrigger <= thirtyDaysMs && timeUntilTrigger > sevenDaysMs) {
      const existingNotification = await prisma.notification.findFirst({
        where: {
          willId: will.id,
          type: 'CHECK_IN_REMINDER_30D',
          createdAt: { gte: new Date(now.getTime() - thirtyDaysMs) },
        },
      });

      if (!existingNotification) {
        await sendNotification({
          type: 'CHECK_IN_REMINDER_30D',
          address: will.testatorAddress,
          willId: will.id,
        });
      }
    }
  }

  // Check grace periods ending
  const triggeredWills = await prisma.will.findMany({
    where: { status: 'IN_GRACE_PERIOD' },
    include: { testator: true },
  });

  for (const will of triggeredWills) {
    if (will.triggeredAt) {
      const gracePeriodMs = Number(will.gracePeriod) * 1000;
      const graceEnd = new Date(will.triggeredAt.getTime() + gracePeriodMs);
      const timeUntilEnd = graceEnd.getTime() - now.getTime();

      if (timeUntilEnd <= 24 * 60 * 60 * 1000 && timeUntilEnd > 0) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            willId: will.id,
            type: 'GRACE_PERIOD_ENDING',
            createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          },
        });

        if (!existingNotification) {
          await sendNotification({
            type: 'GRACE_PERIOD_ENDING',
            address: will.testatorAddress,
            willId: will.id,
          });
        }
      }
    }
  }
}
