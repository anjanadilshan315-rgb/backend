import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { validate } from '../../common/middlewares/validate.js';
import { AppError } from '../../common/errors/app-error.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/api-response.js';
import {
  buildPaginationMeta,
  paginationSchema,
  toLimitOffset,
} from '../../common/utils/pagination.js';
import {
  booleanQuery,
  emailSchema,
  idParamsSchema,
  nameSchema,
  nullablePhone,
  nullableText,
} from '../../common/utils/validators.js';
import { messageRepository } from './message.repository.js';
import type { MessageRow } from './message.repository.js';

export const contactMessageSchema = z.object({
  name: nameSchema(150),
  email: emailSchema,
  phone: nullablePhone,
  subject: nullableText(255),
  message: z.string().trim().min(1).max(5000),
});

const listQuerySchema = paginationSchema.extend({
  isRead: booleanQuery.optional(),
  search: z.string().trim().max(100).optional(),
});

function toMessageDto(row: MessageRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
  };
}

async function getOrThrow(id: number) {
  const row = await messageRepository.findById(id);
  if (!row) throw AppError.notFound('Message not found');
  return row;
}

/** POST /public/contact */
export async function createContactMessage(req: Request, res: Response) {
  const input = req.body as z.infer<typeof contactMessageSchema>;
  await messageRepository.create({
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    subject: input.subject ?? null,
    message: input.message,
  });
  sendCreated(res, null, 'Thank you! We will get back to you soon.');
}

/** Mounted at /admin/messages */
export const adminMessageRouter = Router();

adminMessageRouter.get(
  '/',
  requirePermission(PERMISSIONS.MESSAGES_VIEW),
  validate({ query: listQuerySchema }),
  async (req: Request, res: Response) => {
    const query = req.query as unknown as z.infer<typeof listQuerySchema>;
    const [limit, offset] = toLimitOffset(query);
    const { rows, total } = await messageRepository.list({
      isRead: query.isRead,
      search: query.search,
      limit,
      offset,
    });
    sendSuccess(res, rows.map(toMessageDto), {
      meta: { ...buildPaginationMeta(query, total), unread: await messageRepository.unreadCount() },
    });
  },
);

adminMessageRouter.get(
  '/:id',
  requirePermission(PERMISSIONS.MESSAGES_VIEW),
  validate({ params: idParamsSchema }),
  async (req: Request, res: Response) => {
    sendSuccess(res, toMessageDto(await getOrThrow(Number(req.params.id))));
  },
);

adminMessageRouter.patch(
  '/:id',
  requirePermission(PERMISSIONS.MESSAGES_MANAGE),
  validate({ params: idParamsSchema, body: z.object({ isRead: z.boolean() }) }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await getOrThrow(id);
    await messageRepository.setRead(id, req.body.isRead);
    sendSuccess(res, toMessageDto(await getOrThrow(id)));
  },
);

adminMessageRouter.delete(
  '/:id',
  requirePermission(PERMISSIONS.MESSAGES_MANAGE),
  validate({ params: idParamsSchema }),
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    await getOrThrow(id);
    await messageRepository.delete(id);
    sendNoContent(res);
  },
);
