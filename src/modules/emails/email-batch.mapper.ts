import type { EmailBatchRow } from './email-batch.repository.js';

export function toEmailBatchDto(row: EmailBatchRow) {
  const processed = row.sent_count + row.failed_count;
  return {
    id: row.id,
    invitationId: row.invitation_id,
    status: row.status,
    requestedBy: { type: row.requested_by_type, id: row.requested_by_id },
    totalCount: row.total_count,
    sentCount: row.sent_count,
    failedCount: row.failed_count,
    progress: row.total_count > 0 ? Math.round((processed / row.total_count) * 100) : 100,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}
