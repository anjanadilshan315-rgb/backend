import { Router } from 'express';
import type { Request, Response } from 'express';
import { findOne } from '../../config/database.js';
import { PERMISSIONS } from '../../common/constants/permissions.js';
import { INVITATION_STATUSES } from '../../common/constants/statuses.js';
import { requirePermission } from '../../common/middlewares/authorize.js';
import { sendSuccess } from '../../common/utils/api-response.js';
import { emailBatchRepository } from '../emails/email-batch.repository.js';
import { toAdminInvitationListDto } from '../invitations/invitation.mapper.js';
import { invitationRepository } from '../invitations/invitation.repository.js';
import { messageRepository } from '../messages/message.repository.js';

async function getStats() {
  const [customers, revenue, statusCounts, recentPending, unreadMessages, emailsSent] =
    await Promise.all([
      findOne<{ total: number; this_month: number }>(
        `SELECT COUNT(*) AS total,
              COALESCE(SUM(created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')), 0) AS this_month
         FROM customers`,
      ),
      findOne<{ total: number | null; this_month: number | null }>(
        `SELECT SUM(payment_amount) AS total,
              SUM(CASE WHEN paid_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01') THEN payment_amount END) AS this_month
         FROM invitations WHERE status = 'paid'`,
      ),
      invitationRepository.statusCounts(),
      invitationRepository.list({
        status: 'pending',
        includeDrafts: false,
        sortBy: 'submittedAt',
        sortOrder: 'desc',
        limit: 5,
        offset: 0,
      }),
      messageRepository.unreadCount(),
      emailBatchRepository.totalSent(),
    ]);

  const byStatus = Object.fromEntries(INVITATION_STATUSES.map((status) => [status, 0])) as Record<
    (typeof INVITATION_STATUSES)[number],
    number
  >;
  for (const row of statusCounts) byStatus[row.status] = Number(row.count);

  return {
    customers: {
      total: Number(customers?.total ?? 0),
      newThisMonth: Number(customers?.this_month ?? 0),
    },
    invitations: { ...byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) },
    revenue: { total: Number(revenue?.total ?? 0), thisMonth: Number(revenue?.this_month ?? 0) },
    unreadMessages,
    emailsSent,
    recentPendingSubmissions: recentPending.rows.map(toAdminInvitationListDto),
  };
}

/** Mounted at /admin/dashboard */
export const dashboardRouter = Router();

dashboardRouter.get(
  '/',
  requirePermission(PERMISSIONS.DASHBOARD_VIEW),
  async (_req: Request, res: Response) => {
    sendSuccess(res, await getStats());
  },
);
