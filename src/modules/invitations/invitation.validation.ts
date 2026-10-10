import { z } from 'zod';
import { INVITATION_STATUSES, PHOTO_CATEGORIES } from '../../common/constants/statuses.js';
import { paginationSchema, sortOrderSchema } from '../../common/utils/pagination.js';
import {
  booleanQuery,
  idParam,
  isoDate,
  nullablePhone,
  nullableText,
} from '../../common/utils/validators.js';
import { INVITATION_SORT_COLUMNS } from './invitation.repository.js';

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the 24h format HH:mm');

const nullableDate = isoDate.nullable().optional();

const eventItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  time: z.string().trim().max(50),
  venue: z.string().trim().max(255).optional(),
  description: z.string().trim().max(500).optional(),
});

const extraDetailsSchema = z
  .record(z.string().max(50), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 30, 'At most 30 extra fields are allowed');

/** Every step-form field. All optional so each step can save only its own part. */
const contentShape = {
  templateId: idParam.optional(),
  currentStep: z.coerce.number().int().min(1).max(20).optional(),
  groomName: nullableText(150),
  brideName: nullableText(150),
  groomPhone: nullablePhone,
  bridePhone: nullablePhone,
  groomParents: nullableText(255),
  brideParents: nullableText(255),
  weddingDate: nullableDate,
  weddingTime: timeOfDay.nullable().optional(),
  rsvpDeadline: nullableDate,
  venueName: nullableText(255),
  venueAddress: nullableText(500),
  mapUrl: z
    .url()
    .max(1000)
    .or(z.literal(''))
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  greetingMessage: nullableText(2000),
  eventsSchedule: z.array(eventItemSchema).max(20).nullable().optional(),
  extraDetails: extraDetailsSchema.nullable().optional(),
};

const atLeastOneField = (data: Record<string, unknown>) =>
  Object.values(data).some((value) => value !== undefined);

export const invitationContentSchema = z.object(contentShape);

export const createInvitationSchema = z.object({ ...contentShape, templateId: idParam });

export const updateInvitationSchema = invitationContentSchema.refine(atLeastOneField, {
  message: 'Provide at least one field to update',
});

export const adminUpdateInvitationSchema = z
  .object({ ...contentShape, staffNotes: nullableText(5000) })
  .refine(atLeastOneField, { message: 'Provide at least one field to update' });

export const updateStatusSchema = z.object({
  status: z.enum(['pending', 'paid', 'cancelled']),
  paymentAmount: z.coerce.number().min(0).max(99_999_999).optional(),
  paymentReference: nullableText(100),
  note: nullableText(500),
});

export const adminListInvitationsQuerySchema = paginationSchema.extend({
  status: z.enum(INVITATION_STATUSES).optional(),
  includeDrafts: booleanQuery.default(false),
  search: z.string().trim().max(100).optional(),
  templateId: idParam.optional(),
  customerId: idParam.optional(),
  submittedFrom: isoDate.optional(),
  submittedTo: isoDate.optional(),
  sortBy: z
    .enum(Object.keys(INVITATION_SORT_COLUMNS) as [keyof typeof INVITATION_SORT_COLUMNS])
    .default('createdAt'),
  sortOrder: sortOrderSchema,
});

export const invitationIdParamsSchema = z.object({ invitationId: idParam });

export const photoParamsSchema = z.object({ invitationId: idParam, photoId: idParam });

export const uploadPhotosBodySchema = z.object({
  category: z.enum(PHOTO_CATEGORIES).default('gallery'),
});

export const reorderPhotosSchema = z.object({
  photoIds: z.array(idParam).min(1).max(50),
});

export const slugParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120),
});

export type InvitationContentInput = z.infer<typeof invitationContentSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type AdminUpdateInvitationInput = z.infer<typeof adminUpdateInvitationSchema>;
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
export type AdminListInvitationsQuery = z.infer<typeof adminListInvitationsQuerySchema>;
