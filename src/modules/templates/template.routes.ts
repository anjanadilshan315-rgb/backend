import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { templateService } from './template.service.js';

const idOrCodeParams = z.object({ idOrCode: z.string().trim().min(1).max(50) });

/** Mounted at /public/templates. */
export const publicTemplateRouter = Router();

publicTemplateRouter.get('/', async (_req: Request, res: Response) => {
  sendSuccess(res, await templateService.list(true));
});

publicTemplateRouter.get(
  '/:idOrCode',
  validate({ params: idOrCodeParams }),
  async (req: Request, res: Response) => {
    sendSuccess(res, await templateService.getPublic(String(req.params.idOrCode)));
  },
);

/** Mounted at /admin/templates. Template builder endpoints will be added here later. */
export const adminTemplateRouter = Router();

adminTemplateRouter.get(
  '/',
  requirePermission(PERMISSIONS.TEMPLATES_VIEW),
  async (_req: Request, res: Response) => {
    sendSuccess(res, await templateService.list(false));
  },
);
