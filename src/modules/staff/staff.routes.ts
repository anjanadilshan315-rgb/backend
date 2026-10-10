import { Router } from 'express';
import { requireAdmin } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { idParamsSchema } from '../../common/utils/validators.js';
import { staffController } from './staff.controller.js';
import {
  createStaffSchema,
  listStaffQuerySchema,
  resetPasswordSchema,
  setPermissionsSchema,
  updateStaffSchema,
} from './staff.validation.js';

/** Mounted at /admin/staff — admin only. */
export const staffRouter = Router();

staffRouter.use(requireAdmin);

staffRouter.get('/', validate({ query: listStaffQuerySchema }), staffController.list);
staffRouter.post('/', validate({ body: createStaffSchema }), staffController.create);
staffRouter.get('/:id', validate({ params: idParamsSchema }), staffController.get);
staffRouter.patch(
  '/:id',
  validate({ params: idParamsSchema, body: updateStaffSchema }),
  staffController.update,
);
staffRouter.put(
  '/:id/permissions',
  validate({ params: idParamsSchema, body: setPermissionsSchema }),
  staffController.setPermissions,
);
staffRouter.patch(
  '/:id/password',
  validate({ params: idParamsSchema, body: resetPasswordSchema }),
  staffController.resetPassword,
);
staffRouter.delete('/:id', validate({ params: idParamsSchema }), staffController.remove);

/** Mounted at /admin/permissions — the catalog used by the "assign permissions" UI. */
export const permissionsRouter = Router();
permissionsRouter.get('/', requireAdmin, staffController.listPermissions);
