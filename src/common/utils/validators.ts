import { z } from 'zod';

/** Reusable zod building blocks shared by the module validation files. */

export const idParam = z.coerce.number().int().positive();

export const idParamsSchema = z.object({ id: idParam });

export const emailSchema = z.email('Invalid e-mail address').trim().toLowerCase().max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,19}$/, 'Invalid phone number');

export const nameSchema = (max = 100) => z.string().trim().min(1, 'Required').max(max);

/** Optional text that turns "" into null, so clearing a form field clears the column. */
export const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

export const nullablePhone = phoneSchema
  .or(z.literal(''))
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const isoDate = z.iso.date('Use the format YYYY-MM-DD');

export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
