import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { logger } from '../../config/logger.js';
import { AppError } from '../errors/app-error.js';

const MULTER_MESSAGES: Partial<Record<multer.ErrorCode, string>> = {
  LIMIT_FILE_SIZE: 'File is too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
};

function hasStringProp<K extends string>(value: unknown, key: K): value is Record<K, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<K, unknown>)[key] === 'string'
  );
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;

  if (err instanceof multer.MulterError) {
    const message = MULTER_MESSAGES[err.code] ?? err.message;
    const field = err.field ? ` (${err.field})` : '';
    return err.code === 'LIMIT_FILE_SIZE'
      ? new AppError(413, message, 'FILE_TOO_LARGE')
      : AppError.badRequest(`${message}${field}`, 'UPLOAD_ERROR');
  }

  // body-parser errors
  if (hasStringProp(err, 'type')) {
    if (err.type === 'entity.parse.failed')
      return AppError.badRequest('Malformed JSON body', 'INVALID_JSON');
    if (err.type === 'entity.too.large')
      return new AppError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  }

  // Unique-constraint race conditions that slipped past the service checks.
  if (hasStringProp(err, 'code') && err.code === 'ER_DUP_ENTRY') {
    return AppError.conflict('A record with the same value already exists', 'DUPLICATE_ENTRY');
  }

  return null;
}

export const notFoundHandler: RequestHandler = (req) => {
  throw AppError.notFound(`Route ${req.method} ${req.path} not found`, 'ROUTE_NOT_FOUND');
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);
  const log = req.log ?? logger;

  if (!appError) {
    log.error({ err }, 'Unhandled error');
  } else if (appError.statusCode >= 500) {
    log.error({ err: appError }, appError.message);
  }

  const error = appError ?? new AppError(500, 'Internal server error', 'INTERNAL_ERROR');
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details !== undefined ? { details: error.details } : {}),
    requestId: req.id,
  });
};
