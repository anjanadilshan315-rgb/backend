import { Router } from 'express';
import { authenticateStaff } from '../../common/middlewares/authenticate.js';
import { authLimiter } from '../../common/middlewares/rate-limit.js';
import { validate } from '../../common/middlewares/validate.js';
import { updateOwnProfileSchema } from '../staff/staff.validation.js';
import { changePasswordSchema, loginSchema, refreshTokenSchema } from './auth.validation.js';
import { staffAuthController } from './staff-auth.controller.js';

/** Mounted at /admin/auth — sales team dashboard authentication. */
export const staffAuthRouter = Router();

staffAuthRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  staffAuthController.login,
);
staffAuthRouter.post(
  '/refresh',
  authLimiter,
  validate({ body: refreshTokenSchema }),
  staffAuthController.refresh,
);
staffAuthRouter.post('/logout', validate({ body: refreshTokenSchema }), staffAuthController.logout);

staffAuthRouter.get('/me', authenticateStaff, staffAuthController.me);
staffAuthRouter.patch(
  '/me',
  authenticateStaff,
  validate({ body: updateOwnProfileSchema }),
  staffAuthController.updateMe,
);
staffAuthRouter.patch(
  '/me/password',
  authenticateStaff,
  validate({ body: changePasswordSchema }),
  staffAuthController.changePassword,
);
