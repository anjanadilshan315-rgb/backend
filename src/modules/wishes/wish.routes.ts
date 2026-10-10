import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import { paginationSchema } from '../../common/utils/pagination.js';
import type { PaginationInput } from '../../common/utils/pagination.js';
import { idParam } from '../../common/utils/validators.js';
import {
  loadAnyInvitation,
  loadCustomerInvitation,
  loadedInvitation,
} from '../invitations/invitation.middleware.js';
import { invitationIdParamsSchema } from '../invitations/invitation.validation.js';
import { wishService } from './wish.service.js';

export const createWishSchema = z.object({
  name: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(1000),
  code: z.string().trim().max(32).optional(),
});

const wishParamsSchema = z.object({ invitationId: idParam, wishId: idParam });
const visibilitySchema = z.object({ isVisible: z.boolean() });

const handlers = {
  async list(req: Request, res: Response) {
    const { items, meta } = await wishService.list(
      loadedInvitation(res).id,
      req.query as unknown as PaginationInput,
      false,
    );
    sendSuccess(res, items, { meta });
  },
  async setVisible(req: Request, res: Response) {
    const wish = await wishService.setVisible(
      loadedInvitation(res).id,
      Number(req.params.wishId),
      req.body.isVisible,
    );
    sendSuccess(res, wish, { message: wish.isVisible ? 'Wish is visible' : 'Wish hidden' });
  },
  async remove(req: Request, res: Response) {
    await wishService.remove(loadedInvitation(res).id, Number(req.params.wishId));
    sendNoContent(res);
  },
};

function mountModerationRoutes(router: Router) {
  router.get('/', validate({ query: paginationSchema }), handlers.list);
  router.patch(
    '/:wishId',
    validate({ params: wishParamsSchema, body: visibilitySchema }),
    handlers.setVisible,
  );
  router.delete('/:wishId', validate({ params: wishParamsSchema }), handlers.remove);
}

/** Mounted at /customer/invitations/:invitationId/wishes — the couple moderates their guest book. */
export const customerWishRouter = Router({ mergeParams: true });
customerWishRouter.use(validate({ params: invitationIdParamsSchema }), loadCustomerInvitation);
mountModerationRoutes(customerWishRouter);

/** Mounted at /admin/invitations/:invitationId/wishes */
export const adminWishRouter = Router({ mergeParams: true });
adminWishRouter.use(
  requirePermission(PERMISSIONS.INVITATIONS_UPDATE),
  validate({ params: invitationIdParamsSchema }),
  loadAnyInvitation,
);
mountModerationRoutes(adminWishRouter);
