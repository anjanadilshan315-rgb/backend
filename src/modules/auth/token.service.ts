import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { AppError } from '../../common/errors/app-error.js';
import { signAccessToken } from '../../common/utils/jwt.js';
import type { SubjectType } from '../../common/types/auth.js';
import { refreshTokenRepository } from './refresh-token.repository.js';

export interface TokenPair {
  tokenType: 'Bearer';
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export interface ClientMeta {
  ipAddress?: string;
  userAgent?: string;
}

const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export const tokenService = {
  async issue(
    subjectType: SubjectType,
    subjectId: number,
    meta: ClientMeta = {},
  ): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await refreshTokenRepository.deleteStaleForSubject(subjectType, subjectId);
    await refreshTokenRepository.insert({
      subjectType,
      subjectId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
      ...meta,
    });

    return {
      tokenType: 'Bearer',
      accessToken: signAccessToken(subjectType, subjectId),
      expiresIn: env.ACCESS_TOKEN_TTL_MINUTES * 60,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  },

  /**
   * Validates and revokes a refresh token (rotation) and returns its subject id.
   * Re-using an already revoked token revokes every session of that subject,
   * because it means the token was probably stolen.
   */
  async consume(subjectType: SubjectType, rawToken: string): Promise<number> {
    const invalid = AppError.unauthorized(
      'Invalid or expired refresh token',
      'INVALID_REFRESH_TOKEN',
    );
    const token = await refreshTokenRepository.findByHash(hashToken(rawToken));
    if (!token || token.subject_type !== subjectType) throw invalid;

    if (token.revoked_at) {
      logger.warn(
        { subjectType, subjectId: token.subject_id },
        'Refresh token reuse detected — revoking all sessions',
      );
      await refreshTokenRepository.revokeAllForSubject(subjectType, token.subject_id);
      throw invalid;
    }
    if (new Date(token.expires_at).getTime() <= Date.now()) throw invalid;

    const revokedNow = await refreshTokenRepository.revokeById(token.id);
    if (!revokedNow) throw invalid;
    return token.subject_id;
  },

  async revoke(rawToken: string): Promise<void> {
    const token = await refreshTokenRepository.findByHash(hashToken(rawToken));
    if (token && !token.revoked_at) await refreshTokenRepository.revokeById(token.id);
  },

  revokeAll(subjectType: SubjectType, subjectId: number): Promise<void> {
    return refreshTokenRepository.revokeAllForSubject(subjectType, subjectId);
  },

  deleteAll(subjectType: SubjectType, subjectId: number): Promise<void> {
    return refreshTokenRepository.deleteAllForSubject(subjectType, subjectId);
  },
};
