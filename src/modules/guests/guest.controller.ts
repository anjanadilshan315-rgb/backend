import type { Request, Response } from 'express';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import { emailService } from '../emails/email.service.js';
import { loadedInvitation } from '../invitations/invitation.middleware.js';
import { buildSampleGuestWorkbook } from './guest-excel.service.js';
import { guestService } from './guest.service.js';
import type { CreateGuestInput, ListGuestsQuery, UpdateGuestInput } from './guest.validation.js';

const guestIdOf = (req: Request) => Number(req.params.guestId);

export const guestController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await guestService.list(
      loadedInvitation(res),
      req.query as unknown as ListGuestsQuery,
    );
    sendSuccess(res, items, { meta });
  },

  async stats(_req: Request, res: Response) {
    sendSuccess(res, await guestService.stats(loadedInvitation(res).id));
  },

  async create(req: Request, res: Response) {
    const guest = await guestService.add(loadedInvitation(res), req.body as CreateGuestInput);
    sendCreated(res, guest, 'Guest added');
  },

  async update(req: Request, res: Response) {
    const guest = await guestService.update(
      loadedInvitation(res),
      guestIdOf(req),
      req.body as UpdateGuestInput,
    );
    sendSuccess(res, guest, { message: 'Guest updated' });
  },

  async remove(req: Request, res: Response) {
    await guestService.remove(loadedInvitation(res).id, guestIdOf(req));
    sendNoContent(res);
  },

  async bulkRemove(req: Request, res: Response) {
    const result = await guestService.bulkRemove(loadedInvitation(res).id, req.body.guestIds);
    sendSuccess(res, result, { message: `${result.deleted} guest(s) deleted` });
  },

  /** multipart: file=<.xlsx>, sendEmails=true|false */
  async importExcel(req: Request, res: Response) {
    const invitation = loadedInvitation(res);
    const result = await guestService.importExcel(invitation, req.file);

    const emailBatch =
      req.body.sendEmails && result.imported > 0
        ? await emailService.queueInvitations(
            invitation,
            { type: 'customer', id: invitation.customer_id },
            {
              mode: 'unsent',
            },
          )
        : null;

    sendSuccess(
      res,
      { ...result, emailBatch },
      {
        message: `${result.imported} guest(s) imported, ${result.skipped} skipped`,
      },
    );
  },

  async downloadSample(_req: Request, res: Response) {
    const buffer = await buildSampleGuestWorkbook();
    res
      .status(200)
      .type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .attachment('guest-list-sample.xlsx')
      .send(buffer);
  },
};
