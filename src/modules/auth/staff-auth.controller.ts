import type { Request, Response } from 'express';
import { currentStaff } from '../../common/middlewares/authorize.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { staffService } from '../staff/staff.service.js';
import type { UpdateOwnProfileInput } from '../staff/staff.validation.js';
import type { ChangePasswordInput, LoginInput } from './auth.validation.js';
import { clientMeta } from './client-meta.js';
import { staffAuthService } from './staff-auth.service.js';

export const staffAuthController = {
  async login(req: Request, res: Response) {
    const result = await staffAuthService.login(req.body as LoginInput, clientMeta(req));
    sendSuccess(res, result, { message: 'Logged in successfully' });
  },

  async refresh(req: Request, res: Response) {
    sendSuccess(res, await staffAuthService.refresh(req.body.refreshToken, clientMeta(req)));
  },

  async logout(req: Request, res: Response) {
    await staffAuthService.logout(req.body.refreshToken);
    sendSuccess(res, null, { message: 'Logged out' });
  },

  async me(req: Request, res: Response) {
    sendSuccess(res, await staffService.getById(currentStaff(req).id));
  },

  async updateMe(req: Request, res: Response) {
    const user = await staffService.updateOwnProfile(
      currentStaff(req).id,
      req.body as UpdateOwnProfileInput,
    );
    sendSuccess(res, user, { message: 'Profile updated' });
  },

  async changePassword(req: Request, res: Response) {
    const result = await staffAuthService.changePassword(
      currentStaff(req).id,
      req.body as ChangePasswordInput,
      clientMeta(req),
    );
    sendSuccess(res, result, { message: 'Password changed. Other sessions have been signed out.' });
  },
};
