import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { sendDeadlineReminders } from '../notifications/service.js';
import { checkExecutableWills } from './deadlines.js';
import { updatePlatformStats } from './stats.js';

const prisma = new PrismaClient();

export function startCronJobs() {
  logger.info('Starting cron jobs...');

  // Check for deadline reminders every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running deadline reminder check...');
    try {
      await sendDeadlineReminders();
      logger.info('Deadline reminder check completed');
    } catch (error) {
      logger.error('Error in deadline reminder check:', error);
    }
  });

  // Check for executable wills every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Checking for executable wills...');
    try {
      await checkExecutableWills();
      logger.info('Executable wills check completed');
    } catch (error) {
      logger.error('Error checking executable wills:', error);
    }
  });

  // Update platform stats every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    logger.info('Updating platform stats...');
    try {
      await updatePlatformStats();
      logger.info('Platform stats updated');
    } catch (error) {
      logger.error('Error updating platform stats:', error);
    }
  });

  // Daily cleanup at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running daily cleanup...');
    try {
      await dailyCleanup();
      logger.info('Daily cleanup completed');
    } catch (error) {
      logger.error('Error in daily cleanup:', error);
    }
  });

  logger.info('Cron jobs started');
}

async function dailyCleanup() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Clean up old read notifications
  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      readAt: { lt: thirtyDaysAgo },
    },
  });

  logger.info(`Cleaned up ${deletedNotifications.count} old notifications`);

  // Archive old activities (keep last 6 months)
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  // Note: In production, you'd want to archive to cold storage instead of deleting
  // For now, we'll just log what would be cleaned
  const oldActivities = await prisma.activity.count({
    where: {
      timestamp: { lt: sixMonthsAgo },
    },
  });

  logger.info(`Found ${oldActivities} activities older than 6 months (not deleted)`);
}
