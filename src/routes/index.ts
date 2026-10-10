import { Router } from 'express';
import { authenticateCustomer, authenticateStaff } from '../common/middlewares/authenticate.js';
import { publicWriteLimiter } from '../common/middlewares/rate-limit.js';
import { validate } from '../common/middlewares/validate.js';
import { customerAuthRouter } from '../modules/auth/customer-auth.routes.js';
import { staffAuthRouter } from '../modules/auth/staff-auth.routes.js';
import {
  customerAdminRouter,
  customerProfileRouter,
} from '../modules/customers/customer.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { sampleFilesRouter } from '../modules/guests/guest.routes.js';
import { healthRouter } from '../modules/health/health.routes.js';
import {
  adminInvitationRouter,
  customerInvitationRouter,
  publicInvitationRouter,
} from '../modules/invitations/invitation.routes.js';
import {
  adminMessageRouter,
  contactMessageSchema,
  createContactMessage,
} from '../modules/messages/message.routes.js';
import { permissionsRouter, staffRouter } from '../modules/staff/staff.routes.js';
import { adminTemplateRouter, publicTemplateRouter } from '../modules/templates/template.routes.js';

/**
 * API v1
 *
 *   /health                     liveness + DB check
 *   /public/...                 no login (templates, invitation page, RSVP, wishes, contact)
 *   /auth/...                   website customer register / login
 *   /customer/...               logged-in customer (profile, invitations, guests, e-mails)
 *   /admin/auth/...             sales team login
 *   /admin/...                  sales team dashboard (role + permission checks)
 */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);

// ---- Public -----------------------------------------------------------------
const publicRouter = Router();
publicRouter.use('/templates', publicTemplateRouter);
publicRouter.use('/invitations', publicInvitationRouter);
publicRouter.use('/samples', sampleFilesRouter);
publicRouter.post(
  '/contact',
  publicWriteLimiter,
  validate({ body: contactMessageSchema }),
  createContactMessage,
);
apiRouter.use('/public', publicRouter);

// ---- Website customers --------------------------------------------------------
apiRouter.use('/auth', customerAuthRouter);

const customerRouter = Router();
customerRouter.use(authenticateCustomer);
customerRouter.use('/me', customerProfileRouter);
customerRouter.use('/invitations', customerInvitationRouter);
apiRouter.use('/customer', customerRouter);

// ---- Sales team dashboard ---------------------------------------------------------
apiRouter.use('/admin/auth', staffAuthRouter);

const adminRouter = Router();
adminRouter.use(authenticateStaff);
adminRouter.use('/dashboard', dashboardRouter);
adminRouter.use('/staff', staffRouter);
adminRouter.use('/permissions', permissionsRouter);
adminRouter.use('/customers', customerAdminRouter);
adminRouter.use('/invitations', adminInvitationRouter);
adminRouter.use('/templates', adminTemplateRouter);
adminRouter.use('/messages', adminMessageRouter);
apiRouter.use('/admin', adminRouter);
