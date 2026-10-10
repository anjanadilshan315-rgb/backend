import { execute, findMany, findOne, pool } from '../../config/database.js';
import type { DbExecutor } from '../../config/database.js';
import type { EmailBatchStatus } from '../../common/constants/statuses.js';

export interface EmailBatchRow {
  id: number;
  invitation_id: number;
  requested_by_type: 'customer' | 'staff';
  requested_by_id: number | null;
  status: EmailBatchStatus;
  total_count: number;
  sent_count: number;
  failed_count: number;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
}

const COLUMNS = `id, invitation_id, requested_by_type, requested_by_id, status, total_count,
                 sent_count, failed_count, started_at, completed_at, created_at`;

export const emailBatchRepository = {
  async create(
    invitationId: number,
    requestedBy: { type: 'customer' | 'staff'; id: number },
    db: DbExecutor = pool,
  ): Promise<number> {
    const result = await execute(
      'INSERT INTO email_batches (invitation_id, requested_by_type, requested_by_id) VALUES (?, ?, ?)',
      [invitationId, requestedBy.type, requestedBy.id],
      db,
    );
    return result.insertId;
  },

  async setTotal(id: number, total: number, db: DbExecutor = pool): Promise<void> {
    await execute('UPDATE email_batches SET total_count = ? WHERE id = ?', [total, id], db);
  },

  findById(id: number) {
    return findOne<EmailBatchRow>(`SELECT ${COLUMNS} FROM email_batches WHERE id = ?`, [id]);
  },

  findForInvitation(invitationId: number, batchId: number) {
    return findOne<EmailBatchRow>(
      `SELECT ${COLUMNS} FROM email_batches WHERE id = ? AND invitation_id = ?`,
      [batchId, invitationId],
    );
  },

  findActiveForInvitation(invitationId: number) {
    return findOne<EmailBatchRow>(
      `SELECT ${COLUMNS} FROM email_batches
        WHERE invitation_id = ? AND status IN ('queued', 'processing') ORDER BY id DESC LIMIT 1`,
      [invitationId],
    );
  },

  listForInvitation(invitationId: number, limit = 20) {
    return findMany<EmailBatchRow>(
      `SELECT ${COLUMNS} FROM email_batches WHERE invitation_id = ? ORDER BY id DESC LIMIT ?`,
      [invitationId, limit],
    );
  },

  /** Batches interrupted by a restart, resumed on boot. */
  findUnfinished() {
    return findMany<EmailBatchRow>(
      `SELECT ${COLUMNS} FROM email_batches WHERE status IN ('queued', 'processing') ORDER BY id`,
    );
  },

  async markProcessing(id: number): Promise<void> {
    await execute(
      `UPDATE email_batches SET status = 'processing', started_at = COALESCE(started_at, UTC_TIMESTAMP())
        WHERE id = ?`,
      [id],
    );
  },

  /** Recomputes the counters from the guests that belong to the batch. */
  async refreshCounts(id: number): Promise<void> {
    await execute(
      `UPDATE email_batches b
          SET sent_count = (SELECT COUNT(*) FROM guests g WHERE g.last_email_batch_id = b.id AND g.email_status = 'sent'),
              failed_count = (SELECT COUNT(*) FROM guests g WHERE g.last_email_batch_id = b.id AND g.email_status = 'failed')
        WHERE b.id = ?`,
      [id],
    );
  },

  async complete(id: number): Promise<void> {
    await execute(
      `UPDATE email_batches
          SET status = IF(failed_count > 0, 'completed_with_errors', 'completed'),
              completed_at = UTC_TIMESTAMP()
        WHERE id = ?`,
      [id],
    );
  },

  async totalSent(): Promise<number> {
    const row = await findOne<{ total: number | null }>(
      'SELECT SUM(sent_count) AS total FROM email_batches',
    );
    return Number(row?.total ?? 0);
  },
};
