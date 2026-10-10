import { Router } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { uploadSpreadsheet } from '../../common/middlewares/upload.js';
import { validate } from '../../common/middlewares/validate.js';
import {
  loadAnyInvitation,
  loadCustomerInvitation,
  requirePaidInvitation,
} from '../invitations/invitation.middleware.js';
import { invitationIdParamsSchema } from '../invitations/invitation.validation.js';
import { guestController } from './guest.controller.js';
import {
  bulkDeleteGuestsSchema,
  createGuestSchema,
  guestParamsSchema,
  importGuestsBodySchema,
  listGuestsQuerySchema,
  updateGuestSchema,
} from './guest.validation.js';

/** Mounted at /customer/invitations/:invitationId/guests */
export const customerGuestRouter = Router({ mergeParams: true });

customerGuestRouter.use(validate({ params: invitationIdParamsSchema }), loadCustomerInvitation);

customerGuestRouter.get('/', validate({ query: listGuestsQuerySchema }), guestController.list);
customerGuestRouter.get('/stats', guestController.stats);
customerGuestRouter.post(
  '/',
  requirePaidInvitation,
  validate({ body: createGuestSchema }),
  guestController.create,
);
customerGuestRouter.post(
  '/import',
  requirePaidInvitation,
  uploadSpreadsheet,
  validate({ body: importGuestsBodySchema }),
  guestController.importExcel,
);
customerGuestRouter.post(
  '/bulk-delete',
  requirePaidInvitation,
  validate({ body: bulkDeleteGuestsSchema }),
  guestController.bulkRemove,
);
customerGuestRouter.patch(
  '/:guestId',
  requirePaidInvitation,
  validate({ params: guestParamsSchema, body: updateGuestSchema }),
  guestController.update,
);
customerGuestRouter.delete(
  '/:guestId',
  requirePaidInvitation,
  validate({ params: guestParamsSchema }),
  guestController.remove,
);

/** Mounted at /admin/invitations/:invitationId/guests (read-only for the sales team). */
export const adminGuestRouter = Router({ mergeParams: true });

adminGuestRouter.use(
  requirePermission(PERMISSIONS.INVITATIONS_VIEW),
  validate({ params: invitationIdParamsSchema }),
  loadAnyInvitation,
);
adminGuestRouter.get('/', validate({ query: listGuestsQuerySchema }), guestController.list);
adminGuestRouter.get('/stats', guestController.stats);

/** Mounted at /public/samples */
export const sampleFilesRouter = Router();
sampleFilesRouter.get('/guest-list.xlsx', guestController.downloadSample);
