import { z } from 'zod';
import { ALL_PERMISSIONS } from '../../common/constants/permissions.js';
import { STAFF_ROLES } from '../../common/constants/statuses.js';
import { paginationSchema } from '../../common/utils/pagination.js';
import {
  booleanQuery,
  emailSchema,
  nameSchema,
  nullablePhone,
  passwordSchema,
} from '../../common/utils/validators.js';

const permissionsSchema = z
  .array(z.enum(ALL_PERMISSIONS))
  .max(ALL_PERMISSIONS.length)
  .transform((list) => [...new Set(list)]);

export const listStaffQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  role: z.enum(STAFF_ROLES).optional(),
  isActive: booleanQuery.optional(),
});

export const createStaffSchema = z.object({
  name: nameSchema(150),
  email: emailSchema,
  phone: nullablePhone,
  password: passwordSchema,
  role: z.enum(STAFF_ROLES).default('user'),
  permissions: permissionsSchema.default([]),
});

export const updateStaffSchema = z
  .object({
    name: nameSchema(150).optional(),
    email: emailSchema.optional(),
    phone: nullablePhone,
    role: z.enum(STAFF_ROLES).optional(),
    isActive: z.boolean().optional(),
    permissions: permissionsSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const setPermissionsSchema = z.object({ permissions: permissionsSchema });

export const resetPasswordSchema = z.object({ newPassword: passwordSchema });

export const updateOwnProfileSchema = z
  .object({ name: nameSchema(150).optional(), phone: nullablePhone })
  .refine((data) => data.name !== undefined || data.phone !== undefined, {
    message: 'Provide at least one field to update',
  });

export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>;
export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type UpdateOwnProfileInput = z.infer<typeof updateOwnProfileSchema>;
