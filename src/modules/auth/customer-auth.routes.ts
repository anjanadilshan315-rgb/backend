import { Router } from 'express';
import { authLimiter } from '../../common/middlewares/rate-limit.js';
import { validate } from '../../common/middlewares/validate.js';
import { registerCustomerSchema } from '../customers/customer.validation.js';
import { loginSchema, refreshTokenSchema } from './auth.validation.js';
import { customerAuthController } from './customer-auth.controller.js';

/** Mounted at /auth — website customer authentication. */
export const customerAuthRouter = Router();

customerAuthRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerCustomerSchema }),
  customerAuthController.register,
);
customerAuthRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  customerAuthController.login,
);
customerAuthRouter.post(
  '/refresh',
  authLimiter,
  validate({ body: refreshTokenSchema }),
  customerAuthController.refresh,
);
customerAuthRouter.post(
  '/logout',
  validate({ body: refreshTokenSchema }),
  customerAuthController.logout,
);
