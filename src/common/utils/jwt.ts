import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../errors/app-error.js';
import type { SubjectType } from '../types/auth.js';

const ISSUER = 'wedding-invitation-api';

/** Short-lived access token. The audience separates staff tokens from customer tokens. */
export function signAccessToken(type: SubjectType, id: number): string {
  return jwt.sign({ typ: type }, env.JWT_ACCESS_SECRET, {
    subject: String(id),
    audience: type,
    issuer: ISSUER,
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
  });
}

/** Returns the subject id, or throws 401. */
export function verifyAccessToken(token: string, type: SubjectType): number {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      audience: type,
      issuer: ISSUER,
      algorithms: ['HS256'],
    });
    const id = typeof payload === 'string' ? NaN : Number(payload.sub);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid subject');
    return id;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
    }
    throw AppError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }
}
