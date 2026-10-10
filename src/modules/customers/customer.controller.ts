import type { Request, Response } from 'express';
import { currentCustomer, currentStaff } from '../../common/middlewares/authorize.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import type { ChangePasswordInput } from '../auth/auth.validation.js';
import { clientMeta } from '../auth/client-meta.js';
import { customerService } from './customer.service.js';
import type {
  AdminUpdateCustomerInput,
  ListCustomersQuery,
  RegisterCustomerInput,
  UpdateProfileInput,
} from './customer.validation.js';

const idOf = (req: Request) => Number(req.params.id);

/** /customer/me — the logged-in website customer. */
export const customerProfileController = {
  async get(req: Request, res: Response) {
    sendSuccess(res, await customerService.getProfile(currentCustomer(req).id));
  },

  async update(req: Request, res: Response) {
    const profile = await customerService.updateProfile(
      currentCustomer(req).id,
      req.body as UpdateProfileInput,
    );
    sendSuccess(res, profile, { message: 'Profile updated' });
  },

  async changePassword(req: Request, res: Response) {
    const result = await customerService.changePassword(
      currentCustomer(req).id,
      req.body as ChangePasswordInput,
      clientMeta(req),
    );
    sendSuccess(res, result, { message: 'Password changed. Other sessions have been signed out.' });
  },
};

/** /admin/customers — sales team. */
export const customerAdminController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await customerService.list(req.query as unknown as ListCustomersQuery);
    sendSuccess(res, items, { meta });
  },

  async get(req: Request, res: Response) {
    sendSuccess(res, await customerService.getWithInvitations(idOf(req)));
  },

  async create(req: Request, res: Response) {
    const customer = await customerService.adminCreate(
      req.body as RegisterCustomerInput,
      currentStaff(req).id,
    );
    sendCreated(res, customer, 'Customer registered');
  },

  async update(req: Request, res: Response) {
    const customer = await customerService.adminUpdate(
      idOf(req),
      req.body as AdminUpdateCustomerInput,
    );
    sendSuccess(res, customer, { message: 'Customer updated' });
  },

  async resetPassword(req: Request, res: Response) {
    await customerService.adminResetPassword(idOf(req), req.body.newPassword);
    sendSuccess(res, null, { message: 'Password reset. The customer has been signed out.' });
  },

  async remove(req: Request, res: Response) {
    await customerService.adminDelete(idOf(req));
    sendNoContent(res);
  },
};
