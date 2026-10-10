import { Router } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { idParamsSchema } from '../../common/utils/validators.js';
import { changePasswordSchema } from '../auth/auth.validation.js';
import { customerAdminController, customerProfileController } from './customer.controller.js';
import {
  adminResetPasswordSchema,
  adminUpdateCustomerSchema,
  listCustomersQuerySchema,
  registerCustomerSchema,
  updateProfileSchema,
} from './customer.validation.js';

/** Mounted at /customer/me (authenticated customer). */
export const customerProfileRouter = Router();

customerProfileRouter.get('/', customerProfileController.get);
customerProfileRouter.patch(
  '/',
  validate({ body: updateProfileSchema }),
  customerProfileController.update,
);
customerProfileRouter.patch(
  '/password',
  validate({ body: changePasswordSchema }),
  customerProfileController.changePassword,
);

/** Mounted at /admin/customers (authenticated staff). */
export const customerAdminRouter = Router();

customerAdminRouter.get(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ query: listCustomersQuerySchema }),
  customerAdminController.list,
);
customerAdminRouter.post(
  '/',
  requirePermission(PERMISSIONS.CUSTOMERS_CREATE),
  validate({ body: registerCustomerSchema }),
  customerAdminController.create,
);
customerAdminRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_VIEW),
  validate({ params: idParamsSchema }),
  customerAdminController.get,
);
customerAdminRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  validate({ params: idParamsSchema, body: adminUpdateCustomerSchema }),
  customerAdminController.update,
);
customerAdminRouter.patch(
  '/:id/password',
  requirePermission(PERMISSIONS.CUSTOMERS_UPDATE),
  validate({ params: idParamsSchema, body: adminResetPasswordSchema }),
  customerAdminController.resetPassword,
);
customerAdminRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.CUSTOMERS_DELETE),
  validate({ params: idParamsSchema }),
  customerAdminController.remove,
);
