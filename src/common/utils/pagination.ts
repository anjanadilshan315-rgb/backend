import { z } from 'zod';
import type { PaginationMeta } from './api-response.js';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

export function toLimitOffset({ page, limit }: PaginationInput): [number, number] {
  return [limit, (page - 1) * limit];
}

export function buildPaginationMeta(
  { page, limit }: PaginationInput,
  total: number,
): PaginationMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

/** Escapes LIKE wildcards so user search text is matched literally. */
export function likePattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}
