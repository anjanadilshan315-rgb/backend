import { execute, findOne } from '../../config/database.js';
import type { SubjectType } from '../../common/types/auth.js';

export interface RefreshTokenRow {
  id: number;
  subject_type: SubjectType;
  subject_id: number;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
}

export const refreshTokenRepository = {
  async insert(token: {
    subjectType: SubjectType;
    subjectId: number;
    tokenHash: string;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await execute(
      `INSERT INTO refresh_tokens (subject_type, subject_id, token_hash, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        token.subjectType,
        token.subjectId,
        token.tokenHash,
        token.expiresAt,
        token.ipAddress?.slice(0, 45) ?? null,
        token.userAgent?.slice(0, 255) ?? null,
      ],
    );
  },

  findByHash(tokenHash: string) {
    return findOne<RefreshTokenRow>(
      `SELECT id, subject_type, subject_id, token_hash, expires_at, revoked_at
         FROM refresh_tokens WHERE token_hash = ?`,
      [tokenHash],
    );
  },

  /** Returns true only for the request that actually revoked it (guards against races). */
  async revokeById(id: number): Promise<boolean> {
    const result = await execute(
      'UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL',
      [id],
    );
    return result.affectedRows === 1;
  },

  async revokeAllForSubject(subjectType: SubjectType, subjectId: number): Promise<void> {
    await execute(
      `UPDATE refresh_tokens SET revoked_at = UTC_TIMESTAMP()
        WHERE subject_type = ? AND subject_id = ? AND revoked_at IS NULL`,
      [subjectType, subjectId],
    );
  },

  async deleteStaleForSubject(subjectType: SubjectType, subjectId: number): Promise<void> {
    await execute(
      `DELETE FROM refresh_tokens
        WHERE subject_type = ? AND subject_id = ?
          AND (expires_at < UTC_TIMESTAMP() OR revoked_at < UTC_TIMESTAMP() - INTERVAL 1 DAY)`,
      [subjectType, subjectId],
    );
  },

  async deleteAllForSubject(subjectType: SubjectType, subjectId: number): Promise<void> {
    await execute('DELETE FROM refresh_tokens WHERE subject_type = ? AND subject_id = ?', [
      subjectType,
      subjectId,
    ]);
  },
};
