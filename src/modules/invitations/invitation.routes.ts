import { Router } from 'express';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { publicWriteLimiter } from '../../common/middlewares/rate-limit.js';
import { uploadImages } from '../../common/middlewares/upload.js';
import { validate } from '../../common/middlewares/validate.js';
import { sendCreated, sendSuccess } from '../../common/utils/api-response.js';
import { paginationSchema } from '../../common/utils/pagination.js';
import type { PaginationInput } from '../../common/utils/pagination.js';
import { customerEmailRouter } from '../emails/email.routes.js';
import { adminGuestRouter, customerGuestRouter } from '../guests/guest.routes.js';
import { guestService } from '../guests/guest.service.js';
import { rsvpSchema } from '../guests/guest.validation.js';
import type { RsvpInput } from '../guests/guest.validation.js';
import { adminWishRouter, createWishSchema, customerWishRouter } from '../wishes/wish.routes.js';
import { wishService } from '../wishes/wish.service.js';
import {
  adminInvitationController,
  customerInvitationController,
  publicInvitationController,
} from './invitation.controller.js';
import { invitationService } from './invitation.service.js';
import {
  adminListInvitationsQuerySchema,
  adminUpdateInvitationSchema,
  createInvitationSchema,
  invitationIdParamsSchema,
  photoParamsSchema,
  reorderPhotosSchema,
  slugParamsSchema,
  updateInvitationSchema,
  updateStatusSchema,
  uploadPhotosBodySchema,
} from './invitation.validation.js';

const byId = validate({ params: invitationIdParamsSchema });

// ---------------------------------------------------------------------------
// /customer/invitations  (authenticated customer)
// ---------------------------------------------------------------------------
export const customerInvitationRouter = Router();
const customer = customerInvitationController;

customerInvitationRouter.get('/', customer.list);
customerInvitationRouter.post('/', validate({ body: createInvitationSchema }), customer.create);
customerInvitationRouter.get('/:invitationId', byId, customer.get);
customerInvitationRouter.patch(
  '/:invitationId',
  validate({ params: invitationIdParamsSchema, body: updateInvitationSchema }),
  customer.update,
);
customerInvitationRouter.post('/:invitationId/submit', byId, customer.submit);
customerInvitationRouter.delete('/:invitationId', byId, customer.remove);

customerInvitationRouter.get('/:invitationId/photos', byId, customer.listPhotos);
customerInvitationRouter.post(
  '/:invitationId/photos',
  byId,
  uploadImages,
  validate({ body: uploadPhotosBodySchema }),
  customer.uploadPhotos,
);
customerInvitationRouter.put(
  '/:invitationId/photos/order',
  validate({ params: invitationIdParamsSchema, body: reorderPhotosSchema }),
  customer.reorderPhotos,
);
customerInvitationRouter.delete(
  '/:invitationId/photos/:photoId',
  validate({ params: photoParamsSchema }),
  customer.deletePhoto,
);

customerInvitationRouter.use('/:invitationId/guests', customerGuestRouter);
customerInvitationRouter.use('/:invitationId/email-batches', customerEmailRouter);
customerInvitationRouter.use('/:invitationId/wishes', customerWishRouter);

// ---------------------------------------------------------------------------
// /admin/invitations  (sales team)
// ---------------------------------------------------------------------------
export const adminInvitationRouter = Router();
const admin = adminInvitationController;
const canView = requirePermission(PERMISSIONS.INVITATIONS_VIEW);
const canUpdate = requirePermission(PERMISSIONS.INVITATIONS_UPDATE);

adminInvitationRouter.get(
  '/',
  canView,
  validate({ query: adminListInvitationsQuerySchema }),
  admin.list,
);
adminInvitationRouter.get('/:invitationId', canView, byId, admin.get);
adminInvitationRouter.patch(
  '/:invitationId',
  canUpdate,
  validate({ params: invitationIdParamsSchema, body: adminUpdateInvitationSchema }),
  admin.update,
);
adminInvitationRouter.patch(
  '/:invitationId/status',
  requirePermission(PERMISSIONS.INVITATIONS_UPDATE_STATUS),
  validate({ params: invitationIdParamsSchema, body: updateStatusSchema }),
  admin.changeStatus,
);
adminInvitationRouter.delete(
  '/:invitationId',
  requirePermission(PERMISSIONS.INVITATIONS_DELETE),
  byId,
  admin.remove,
);

adminInvitationRouter.post(
  '/:invitationId/photos',
  canUpdate,
  byId,
  uploadImages,
  validate({ body: uploadPhotosBodySchema }),
  admin.uploadPhotos,
);
adminInvitationRouter.put(
  '/:invitationId/photos/order',
  canUpdate,
  validate({ params: invitationIdParamsSchema, body: reorderPhotosSchema }),
  admin.reorderPhotos,
);
adminInvitationRouter.delete(
  '/:invitationId/photos/:photoId',
  canUpdate,
  validate({ params: photoParamsSchema }),
  admin.deletePhoto,
);

adminInvitationRouter.use('/:invitationId/guests', adminGuestRouter);
adminInvitationRouter.use('/:invitationId/wishes', adminWishRouter);

// ---------------------------------------------------------------------------
// /public/invitations/:slug  (guests, no login)
// ---------------------------------------------------------------------------
export const publicInvitationRouter = Router();
const bySlug = validate({ params: slugParamsSchema });

publicInvitationRouter.get('/:slug', bySlug, publicInvitationController.get);

publicInvitationRouter.post(
  '/:slug/rsvp',
  publicWriteLimiter,
  validate({ params: slugParamsSchema, body: rsvpSchema }),
  async (req, res) => {
    const invitation = await invitationService.getPublicRowOrThrow(String(req.params.slug));
    const result = await guestService.rsvp(invitation, req.body as RsvpInput);
    sendSuccess(res, result, { message: 'Thank you for your RSVP!' });
  },
);

publicInvitationRouter.get(
  '/:slug/wishes',
  validate({ params: slugParamsSchema, query: paginationSchema }),
  async (req, res) => {
    const invitation = await invitationService.getPublicRowOrThrow(String(req.params.slug));
    const { items, meta } = await wishService.list(
      invitation.id,
      req.query as unknown as PaginationInput,
      true,
    );
    sendSuccess(res, items, { meta });
  },
);

publicInvitationRouter.post(
  '/:slug/wishes',
  publicWriteLimiter,
  validate({ params: slugParamsSchema, body: createWishSchema }),
  async (req, res) => {
    const invitation = await invitationService.getPublicRowOrThrow(String(req.params.slug));
    sendCreated(
      res,
      await wishService.create(invitation.id, req.body),
      'Thank you for your wishes!',
    );
  },
);
