import { z } from 'zod';
import { GUEST_EMAIL_STATUSES, RSVP_STATUSES } from '../../common/constants/statuses.js';
import { paginationSchema } from '../../common/utils/pagination.js';
import {
  booleanQuery,
  emailSchema,
  idParam,
  nameSchema,
  nullablePhone,
} from '../../common/utils/validators.js';

export const guestParamsSchema = z.object({ invitationId: idParam, guestId: idParam });

export const listGuestsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  emailStatus: z.enum(GUEST_EMAIL_STATUSES).optional(),
  rsvpStatus: z.enum(RSVP_STATUSES).optional(),
});

export const createGuestSchema = z.object({
  name: nameSchema(150),
  email: emailSchema,
  phone: nullablePhone,
});

export const updateGuestSchema = z
  .object({
    name: nameSchema(150).optional(),
    email: emailSchema.optional(),
    phone: nullablePhone,
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const bulkDeleteGuestsSchema = z.object({
  guestIds: z.array(idParam).min(1).max(1000),
});

/** multipart text fields sent with the Excel file */
export const importGuestsBodySchema = z.object({
  sendEmails: booleanQuery.default(false),
});

export const rsvpSchema = z
  .object({
    code: z.string().trim().min(6).max(32).optional(),
    name: nameSchema(150).optional(),
    attending: z.boolean(),
    headCount: z.coerce.number().int().min(1).max(20).default(1),
  })
  .refine((data) => data.code || data.name, {
    message: 'Either the invite code or your name is required',
    path: ['name'],
  });

export type ListGuestsQuery = z.infer<typeof listGuestsQuerySchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
