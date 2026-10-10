import { z } from 'zod';
import { paginationSchema, sortOrderSchema } from '../../common/utils/pagination.js';
import {
  booleanQuery,
  emailSchema,
  nameSchema,
  passwordSchema,
  phoneSchema,
} from '../../common/utils/validators.js';
import { CUSTOMER_SORT_COLUMNS } from './customer.repository.js';

export const registerCustomerSchema = z.object({
  firstName: nameSchema(100),
  lastName: nameSchema(100),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    firstName: nameSchema(100).optional(),
    lastName: nameSchema(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const listCustomersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  isActive: booleanQuery.optional(),
  sortBy: z
    .enum(Object.keys(CUSTOMER_SORT_COLUMNS) as [keyof typeof CUSTOMER_SORT_COLUMNS])
    .default('createdAt'),
  sortOrder: sortOrderSchema,
});

export const adminUpdateCustomerSchema = z
  .object({
    firstName: nameSchema(100).optional(),
    lastName: nameSchema(100).optional(),
    email: emailSchema.optional(),
    phone: phoneSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: 'Provide at least one field to update',
  });

export const adminResetPasswordSchema = z.object({ newPassword: passwordSchema });

export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type AdminUpdateCustomerInput = z.infer<typeof adminUpdateCustomerSchema>;
