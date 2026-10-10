import type { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../common/utils/api-response.js';
import { customerService } from '../customers/customer.service.js';
import type { RegisterCustomerInput } from '../customers/customer.validation.js';
import type { LoginInput } from './auth.validation.js';
import { clientMeta } from './client-meta.js';
import { customerAuthService } from './customer-auth.service.js';

export const customerAuthController = {
  async register(req: Request, res: Response) {
    const result = await customerService.register(
      req.body as RegisterCustomerInput,
      clientMeta(req),
    );
    sendCreated(res, result, 'Account created successfully');
  },

  async login(req: Request, res: Response) {
    const result = await customerAuthService.login(req.body as LoginInput, clientMeta(req));
    sendSuccess(res, result, { message: 'Logged in successfully' });
  },

  async refresh(req: Request, res: Response) {
    sendSuccess(res, await customerAuthService.refresh(req.body.refreshToken, clientMeta(req)));
  },

  async logout(req: Request, res: Response) {
    await customerAuthService.logout(req.body.refreshToken);
    sendSuccess(res, null, { message: 'Logged out' });
  },
};
