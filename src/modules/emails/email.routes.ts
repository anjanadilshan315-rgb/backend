import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../../common/middlewares/validate.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { idParam } from '../../common/utils/validators.js';
import {
  loadCustomerInvitation,
  loadedInvitation,
  requirePaidInvitation,
} from '../invitations/invitation.middleware.js';
import { invitationIdParamsSchema } from '../invitations/invitation.validation.js';
import { emailService } from './email.service.js';

const sendSchema = z
  .object({
    mode: z.enum(['unsent', 'all', 'selected']).default('unsent'),
    guestIds: z.array(idParam).max(5000).optional(),
  })
  .refine((data) => data.mode !== 'selected' || (data.guestIds?.length ?? 0) > 0, {
    message: 'guestIds is required when mode is "selected"',
    path: ['guestIds'],
  });

const batchParamsSchema = z.object({ invitationId: idParam, batchId: idParam });

/** Mounted at /customer/invitations/:invitationId/email-batches */
export const customerEmailRouter = Router({ mergeParams: true });

customerEmailRouter.use(validate({ params: invitationIdParamsSchema }), loadCustomerInvitation);

customerEmailRouter.post(
  '/',
  requirePaidInvitation,
  validate({ body: sendSchema }),
  async (req: Request, res: Response) => {
    const invitation = loadedInvitation(res);
    const batch = await emailService.queueInvitations(
      invitation,
      { type: 'customer', id: invitation.customer_id },
      req.body,
    );
    sendSuccess(res, batch, {
      status: 202,
      message: `Sending invitations to ${batch.totalCount} guest(s)`,
    });
  },
);

customerEmailRouter.get('/', async (_req: Request, res: Response) => {
  sendSuccess(res, await emailService.listBatches(loadedInvitation(res).id));
});

customerEmailRouter.get(
  '/:batchId',
  validate({ params: batchParamsSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(
      res,
      await emailService.getBatch(loadedInvitation(res).id, Number(req.params.batchId)),
    );
  },
);
