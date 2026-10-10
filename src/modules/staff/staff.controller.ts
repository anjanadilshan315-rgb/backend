import type { Request, Response } from 'express';
import { PERMISSION_CATALOG } from '../../common/constants/permissions.js';
import { currentStaff } from '../../common/middlewares/authorize.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import { staffService } from './staff.service.js';
import type { CreateStaffInput, ListStaffQuery, UpdateStaffInput } from './staff.validation.js';

const idOf = (req: Request) => Number(req.params.id);

export const staffController = {
  async list(req: Request, res: Response) {
    const { items, meta } = await staffService.list(req.query as unknown as ListStaffQuery);
    sendSuccess(res, items, { meta });
  },

  async get(req: Request, res: Response) {
    sendSuccess(res, await staffService.getById(idOf(req)));
  },

  async create(req: Request, res: Response) {
    const staff = await staffService.create(req.body as CreateStaffInput, currentStaff(req));
    sendCreated(res, staff, 'Staff user created');
  },

  async update(req: Request, res: Response) {
    const staff = await staffService.update(
      idOf(req),
      req.body as UpdateStaffInput,
      currentStaff(req),
    );
    sendSuccess(res, staff, { message: 'Staff user updated' });
  },

  async setPermissions(req: Request, res: Response) {
    const staff = await staffService.setPermissions(idOf(req), req.body.permissions);
    sendSuccess(res, staff, { message: 'Permissions updated' });
  },

  async resetPassword(req: Request, res: Response) {
    await staffService.resetPassword(idOf(req), req.body.newPassword);
    sendSuccess(res, null, {
      message: 'Password reset. The user has been signed out of all sessions.',
    });
  },

  async remove(req: Request, res: Response) {
    await staffService.delete(idOf(req), currentStaff(req));
    sendNoContent(res);
  },

  listPermissions(_req: Request, res: Response) {
    sendSuccess(res, PERMISSION_CATALOG);
  },
};
