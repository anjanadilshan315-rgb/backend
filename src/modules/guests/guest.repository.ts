import { execute, findMany, findOne, pool } from '../../config/database.js';
import type { DbExecutor } from '../../config/database.js';
import type { GuestEmailStatus, RsvpStatus } from '../../common/constants/statuses.js';
import { likePattern } from '../../common/utils/pagination.js';
import { buildSetClause, inPlaceholders } from '../../common/utils/sql.js';

export interface GuestRow {
  id: number;
  invitation_id: number;
  name: string;
  email: string | null;
  phone: string | null;
  invite_code: string;
  email_status: GuestEmailStatus;
  email_error: string | null;
  email_sent_at: Date | null;
  last_email_batch_id: number | null;
  rsvp_status: RsvpStatus;
  head_count: number;
  responded_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface NewGuest {
  name: string;
  email: string | null;
  phone: string | null;
  inviteCode: string;
}

export interface GuestListFilters {
  search?: string;
  emailStatus?: GuestEmailStatus;
  rsvpStatus?: RsvpStatus;
  limit: number;
  offset: number;
}

export type RecipientMode = 'unsent' | 'all' | 'selected';

const COLUMNS = `id, invitation_id, name, email, phone, invite_code, email_status, email_error,
                 email_sent_at, last_email_batch_id, rsvp_status, head_count, responded_at,
                 created_at, updated_at`;

const INSERT_CHUNK = 500;

export const guestRepository = {
  async stats(invitationId: number) {
    const row = await findOne<Record<string, number | null>>(
      `SELECT COUNT(*) AS total,
              SUM(email IS NOT NULL) AS withEmail,
              SUM(email_status = 'not_sent') AS notSent,
              SUM(email_status = 'queued') AS queued,
              SUM(email_status = 'sent') AS sent,
              SUM(email_status = 'failed') AS failed,
              SUM(rsvp_status = 'pending') AS rsvpPending,
              SUM(rsvp_status = 'attending') AS attending,
              SUM(rsvp_status = 'declined') AS declined,
              SUM(CASE WHEN rsvp_status = 'attending' THEN head_count ELSE 0 END) AS attendingHeadCount
         FROM guests WHERE invitation_id = ?`,
      [invitationId],
    );
    const n = (key: string) => Number(row?.[key] ?? 0);
    return {
      total: n('total'),
      withEmail: n('withEmail'),
      email: { notSent: n('notSent'), queued: n('queued'), sent: n('sent'), failed: n('failed') },
      rsvp: {
        pending: n('rsvpPending'),
        attending: n('attending'),
        declined: n('declined'),
        attendingHeadCount: n('attendingHeadCount'),
      },
    };
  },

  async list(
    invitationId: number,
    filters: GuestListFilters,
  ): Promise<{ rows: GuestRow[]; total: number }> {
    const where = ['invitation_id = ?'];
    const params: unknown[] = [invitationId];
    if (filters.search) {
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const pattern = likePattern(filters.search);
      params.push(pattern, pattern, pattern);
    }
    if (filters.emailStatus) {
      where.push('email_status = ?');
      params.push(filters.emailStatus);
    }
    if (filters.rsvpStatus) {
      where.push('rsvp_status = ?');
      params.push(filters.rsvpStatus);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows, count] = await Promise.all([
      findMany<GuestRow>(
        `SELECT ${COLUMNS} FROM guests ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset],
      ),
      findOne<{ total: number }>(`SELECT COUNT(*) AS total FROM guests ${whereSql}`, params),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  findById(invitationId: number, guestId: number) {
    return findOne<GuestRow>(`SELECT ${COLUMNS} FROM guests WHERE id = ? AND invitation_id = ?`, [
      guestId,
      invitationId,
    ]);
  },

  findByCode(invitationId: number, inviteCode: string) {
    return findOne<GuestRow>(
      `SELECT ${COLUMNS} FROM guests WHERE invitation_id = ? AND invite_code = ?`,
      [invitationId, inviteCode],
    );
  },

  async findByEmail(invitationId: number, email: string) {
    return findOne<GuestRow>(
      `SELECT ${COLUMNS} FROM guests WHERE invitation_id = ? AND email = ?`,
      [invitationId, email],
    );
  },

  async existingEmails(invitationId: number): Promise<Set<string>> {
    const rows = await findMany<{ email: string }>(
      'SELECT email FROM guests WHERE invitation_id = ? AND email IS NOT NULL',
      [invitationId],
    );
    return new Set(rows.map((row) => row.email.toLowerCase()));
  },

  async insert(invitationId: number, guest: NewGuest): Promise<number> {
    const result = await execute(
      'INSERT INTO guests (invitation_id, name, email, phone, invite_code) VALUES (?, ?, ?, ?, ?)',
      [invitationId, guest.name, guest.email, guest.phone, guest.inviteCode],
    );
    return result.insertId;
  },

  async insertMany(invitationId: number, guests: NewGuest[], db: DbExecutor = pool): Promise<void> {
    for (let i = 0; i < guests.length; i += INSERT_CHUNK) {
      const chunk = guests.slice(i, i + INSERT_CHUNK);
      await execute(
        'INSERT INTO guests (invitation_id, name, email, phone, invite_code) VALUES ?',
        [chunk.map((g) => [invitationId, g.name, g.email, g.phone, g.inviteCode])],
        db,
      );
    }
  },

  async update(
    guestId: number,
    fields: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      email_status: GuestEmailStatus;
      email_error: string | null;
    }>,
  ): Promise<void> {
    const { sql, values } = buildSetClause(fields);
    if (!sql) return;
    await execute(`UPDATE guests SET ${sql} WHERE id = ?`, [...values, guestId]);
  },

  async delete(guestId: number): Promise<void> {
    await execute('DELETE FROM guests WHERE id = ?', [guestId]);
  },

  async deleteMany(invitationId: number, guestIds: number[]): Promise<number> {
    const result = await execute(
      `DELETE FROM guests WHERE invitation_id = ? AND id IN ${inPlaceholders(guestIds.length)}`,
      [invitationId, ...guestIds],
    );
    return result.affectedRows;
  },

  /** Flags the recipients of a new e-mail batch. Returns how many were queued. */
  async queueForBatch(
    invitationId: number,
    batchId: number,
    mode: RecipientMode,
    guestIds: number[] = [],
    db: DbExecutor = pool,
  ): Promise<number> {
    const where = ['invitation_id = ?', 'email IS NOT NULL', `email_status <> 'queued'`];
    const params: unknown[] = [invitationId];
    if (mode === 'unsent') where.push(`email_status IN ('not_sent', 'failed')`);
    if (mode === 'selected') {
      if (guestIds.length === 0) return 0;
      where.push(`id IN ${inPlaceholders(guestIds.length)}`);
      params.push(...guestIds);
    }
    const result = await execute(
      `UPDATE guests SET email_status = 'queued', email_error = NULL, last_email_batch_id = ?
        WHERE ${where.join(' AND ')}`,
      [batchId, ...params],
      db,
    );
    return result.affectedRows;
  },

  listQueuedForBatch(batchId: number, limit: number) {
    return findMany<GuestRow>(
      `SELECT ${COLUMNS} FROM guests WHERE last_email_batch_id = ? AND email_status = 'queued'
        ORDER BY id LIMIT ?`,
      [batchId, limit],
    );
  },

  async markSent(guestId: number): Promise<void> {
    await execute(
      `UPDATE guests SET email_status = 'sent', email_error = NULL, email_sent_at = UTC_TIMESTAMP() WHERE id = ?`,
      [guestId],
    );
  },

  async markFailed(guestId: number, error: string): Promise<void> {
    await execute(`UPDATE guests SET email_status = 'failed', email_error = ? WHERE id = ?`, [
      error.slice(0, 500),
      guestId,
    ]);
  },

  async recordRsvp(guestId: number, status: RsvpStatus, headCount: number): Promise<void> {
    await execute(
      'UPDATE guests SET rsvp_status = ?, head_count = ?, responded_at = UTC_TIMESTAMP() WHERE id = ?',
      [status, headCount, guestId],
    );
  },
};
