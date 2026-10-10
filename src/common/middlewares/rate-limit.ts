import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';
import { isTest } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';

const MINUTE = 60 * 1000;

const rejectWith429: RequestHandler = (_req, _res, next) => {
  next(new AppError(429, 'Too many requests, please try again later', 'RATE_LIMITED'));
};

const baseOptions = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
  handler: rejectWith429,
  skip: () => isTest,
};

/** Applied to the whole API. */
export const apiLimiter = rateLimit({ ...baseOptions, windowMs: 15 * MINUTE, limit: 1000 });

/** Login / register / refresh — only failed attempts count. */
export const authLimiter = rateLimit({
  ...baseOptions,
  windowMs: 15 * MINUTE,
  limit: 20,
  skipSuccessfulRequests: true,
});

/** Anonymous writes: contact form, wishes, RSVP. */
export const publicWriteLimiter = rateLimit({ ...baseOptions, windowMs: 10 * MINUTE, limit: 30 });
