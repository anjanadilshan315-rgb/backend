import type { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface SuccessOptions {
  status?: number;
  message?: string;
  meta?: PaginationMeta | Record<string, unknown>;
}

/** Every successful response has the shape { success: true, message?, data, meta? }. */
export function sendSuccess<T>(res: Response, data: T, options: SuccessOptions = {}): void {
  const { status = 200, message, meta } = options;
  res.status(status).json({
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
  });
}

export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, { status: 201, message });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
