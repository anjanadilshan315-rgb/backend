import type { Request, Response } from 'express';
import { currentCustomer, currentStaff } from '../../common/middlewares/authorize.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import { invitationService } from './invitation.service.js';
import type {
  AdminListInvitationsQuery,
  AdminUpdateInvitationInput,
  CreateInvitationInput,
  InvitationContentInput,
  UpdateStatusInput,
} from './invitation.validation.js';
import { photoService } from './photo.service.js';

const invitationIdOf = (req: Request) => Number(req.params.invitationId);
const photoIdOf = (req: Request) => Number(req.params.photoId);
const uploadedFiles = (req: Request) => (Array.isArray(req.files) ? req.files : []);

/** /customer/invitations — the website step form and customer dashboard. */
export const customerInvitationController = {
  async list(req: Request, res: Response) {
    sendSuccess(res, await invitationService.listForCustomer(currentCustomer(req).id));
  },

  async create(req: Request, res: Response) {
    const invitation = await invitationService.create(
      currentCustomer(req).id,
      req.body as CreateInvitationInput,
    );
    sendCreated(res, invitation, 'Invitation draft created');
  },

  async get(req: Request, res: Response) {
    sendSuccess(
      res,
      await invitationService.getForCustomer(currentCustomer(req).id, invitationIdOf(req)),
    );
  },

  async update(req: Request, res: Response) {
    const invitation = await invitationService.updateForCustomer(
      currentCustomer(req).id,
      invitationIdOf(req),
      req.body as InvitationContentInput,
    );
    sendSuccess(res, invitation, { message: 'Saved' });
  },

  async submit(req: Request, res: Response) {
    const invitation = await invitationService.submit(currentCustomer(req).id, invitationIdOf(req));
    sendSuccess(res, invitation, {
      message: 'Submitted! Our team will contact you to complete the payment.',
    });
  },

  async remove(req: Request, res: Response) {
    await invitationService.deleteForCustomer(currentCustomer(req).id, invitationIdOf(req));
    sendNoContent(res);
  },

  async listPhotos(req: Request, res: Response) {
    await invitationService.getOwnedOrThrow(currentCustomer(req).id, invitationIdOf(req));
    sendSuccess(res, await photoService.list(invitationIdOf(req)));
  },

  async uploadPhotos(req: Request, res: Response) {
    await invitationService.assertCustomerCanEditPhotos(
      currentCustomer(req).id,
      invitationIdOf(req),
    );
    const photos = await photoService.upload(
      invitationIdOf(req),
      req.body.category,
      uploadedFiles(req),
    );
    sendCreated(res, photos, 'Photos uploaded');
  },

  async reorderPhotos(req: Request, res: Response) {
    await invitationService.assertCustomerCanEditPhotos(
      currentCustomer(req).id,
      invitationIdOf(req),
    );
    sendSuccess(res, await photoService.reorderGallery(invitationIdOf(req), req.body.photoIds));
  },

  async deletePhoto(req: Request, res: Response) {
    await invitationService.assertCustomerCanEditPhotos(
      currentCustomer(req).id,
      invitationIdOf(req),
    );
    sendSuccess(res, await photoService.remove(invitationIdOf(req), photoIdOf(req)), {
      message: 'Photo deleted',
    });
  },
};

/** /admin/invitations — customer submissions for the sales team. */
export const adminInvitationController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await invitationService.adminList(
      req.query as unknown as AdminListInvitationsQuery,
    );
    sendSuccess(res, items, { meta });
  },

  async get(req: Request, res: Response) {
    sendSuccess(res, await invitationService.adminGet(invitationIdOf(req)));
  },

  async update(req: Request, res: Response) {
    const invitation = await invitationService.adminUpdate(
      invitationIdOf(req),
      req.body as AdminUpdateInvitationInput,
    );
    sendSuccess(res, invitation, { message: 'Invitation updated' });
  },

  async changeStatus(req: Request, res: Response) {
    const input = req.body as UpdateStatusInput;
    const invitation = await invitationService.changeStatus(
      invitationIdOf(req),
      input,
      currentStaff(req),
    );
    sendSuccess(res, invitation, { message: `Status changed to ${input.status}` });
  },

  async remove(req: Request, res: Response) {
    await invitationService.adminDelete(invitationIdOf(req));
    sendNoContent(res);
  },

  async uploadPhotos(req: Request, res: Response) {
    await invitationService.assertExists(invitationIdOf(req));
    const photos = await photoService.upload(
      invitationIdOf(req),
      req.body.category,
      uploadedFiles(req),
    );
    sendCreated(res, photos, 'Photos uploaded');
  },

  async reorderPhotos(req: Request, res: Response) {
    sendSuccess(res, await photoService.reorderGallery(invitationIdOf(req), req.body.photoIds));
  },

  async deletePhoto(req: Request, res: Response) {
    sendSuccess(res, await photoService.remove(invitationIdOf(req), photoIdOf(req)), {
      message: 'Photo deleted',
    });
  },
};

/** /public/invitations/:slug — the page guests open from their e-mail. */
export const publicInvitationController = {
  async get(req: Request, res: Response) {
    const code = typeof req.query.code === 'string' ? req.query.code : undefined;
    sendSuccess(res, await invitationService.getPublic(String(req.params.slug), code));
  },
};
