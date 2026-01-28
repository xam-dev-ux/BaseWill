import { Router } from 'express';
import { willsRouter } from './wills.js';
import { beneficiaryRouter } from './beneficiary.js';
import { notaryRouter } from './notary.js';
import { statsRouter } from './stats.js';
import { notificationsRouter } from './notifications.js';
import { usersRouter } from './users.js';

export const apiRouter = Router();

// Mount routes
apiRouter.use('/wills', willsRouter);
apiRouter.use('/beneficiary', beneficiaryRouter);
apiRouter.use('/notary', notaryRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/users', usersRouter);

// API info
apiRouter.get('/', (req, res) => {
  res.json({
    name: 'BaseWill API',
    version: '1.0.0',
    endpoints: [
      'GET /api/wills/:address - Get testator wills',
      'GET /api/wills/detail/:id - Get will details',
      'GET /api/wills/:id/activity - Get will activity',
      'GET /api/beneficiary/:address - Get wills as beneficiary',
      'GET /api/notary/:address - Get notary info',
      'GET /api/stats - Platform statistics',
      'POST /api/notifications/subscribe - Subscribe to notifications',
      'DELETE /api/notifications/unsubscribe - Unsubscribe',
      'GET /api/users/:address - Get user profile',
      'PUT /api/users/:address - Update user profile',
    ],
  });
});
