import { execute, findMany, findOne, pool } from '../../config/database.js';
import type { DbExecutor } from '../../config/database.js';
import type { InvitationStatus } from '../../common/constants/statuses.js';
import { likePattern } from '../../common/utils/pagination.js';
import { buildSetClause } from '../../common/utils/sql.js';

export interface InvitationRow {
  id: number;
  reference_no: string | null;
  customer_id: number;
  template_id: number;
  slug: string | null;
  status: InvitationStatus;
  current_step: number;
  groom_name: string | null;
  bride_name: string | null;
  groom_phone: string | null;
  bride_phone: string | null;
  groom_parents: string | null;
  bride_parents: string | null;
  wedding_date: string | null;
  wedding_time: string | null;
  rsvp_deadline: string | null;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  greeting_message: string | null;
  events_schedule: unknown;
  extra_details: unknown;
  submitted_at: Date | null;
  paid_at: Date | null;
  payment_amount: number | null;
  payment_reference: string | null;
  paid_marked_by: number | null;
  staff_notes: string | null;
  created_at: Date;
  updated_at: Date;
  // joined
  template_code: string;
  template_name: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  paid_marked_by_name: string | null;
}

export interface StatusHistoryRow {
  id: number;
  from_status: InvitationStatus | null;
  to_status: InvitationStatus;
  changed_by_type: 'customer' | 'staff' | 'system';
  changed_by_id: number | null;
  changed_by_name: string | null;
  note: string | null;
  created_at: Date;
}

/** Columns written by the step form / the sales team edit form. */
export type InvitationContentColumns = Partial<{
  template_id: number;
  current_step: number;
  groom_name: string | null;
  bride_name: string | null;
  groom_phone: string | null;
  bride_phone: string | null;
  groom_parents: string | null;
  bride_parents: string | null;
  wedding_date: string | null;
  wedding_time: string | null;
  rsvp_deadline: string | null;
  venue_name: string | null;
  venue_address: string | null;
  map_url: string | null;
  greeting_message: string | null;
  events_schedule: string | null;
  extra_details: string | null;
  staff_notes: string | null;
}>;

export type InvitationStatusColumns = Partial<{
  status: InvitationStatus;
  slug: string;
  submitted_at: Date;
  paid_at: Date | null;
  payment_amount: number | null;
  payment_reference: string | null;
  paid_marked_by: number | null;
}>;

export const INVITATION_SORT_COLUMNS = {
  createdAt: 'i.created_at',
  updatedAt: 'i.updated_at',
  submittedAt: 'i.submitted_at',
  weddingDate: 'i.wedding_date',
  paidAt: 'i.paid_at',
} as const;

export interface InvitationListFilters {
  status?: InvitationStatus;
  includeDrafts: boolean;
  search?: string;
  templateId?: number;
  customerId?: number;
  submittedFrom?: string;
  submittedTo?: string;
  sortBy: keyof typeof INVITATION_SORT_COLUMNS;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

const SELECT = `
  SELECT i.*,
         t.code AS template_code, t.name AS template_name,
         c.first_name AS customer_first_name, c.last_name AS customer_last_name,
         c.email AS customer_email, c.phone AS customer_phone,
         s.name AS paid_marked_by_name
    FROM invitations i
    JOIN templates t ON t.id = i.template_id
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN staff_users s ON s.id = i.paid_marked_by`;

export const invitationRepository = {
  findById(id: number, db: DbExecutor = pool) {
    return findOne<InvitationRow>(`${SELECT} WHERE i.id = ?`, [id], db);
  },

  findByIdForCustomer(id: number, customerId: number) {
    return findOne<InvitationRow>(`${SELECT} WHERE i.id = ? AND i.customer_id = ?`, [
      id,
      customerId,
    ]);
  },

  findBySlug(slug: string) {
    return findOne<InvitationRow>(`${SELECT} WHERE i.slug = ?`, [slug]);
  },

  async slugExists(slug: string): Promise<boolean> {
    return (await findOne('SELECT id FROM invitations WHERE slug = ?', [slug])) !== null;
  },

  listForCustomer(customerId: number) {
    return findMany<InvitationRow>(`${SELECT} WHERE i.customer_id = ? ORDER BY i.created_at DESC`, [
      customerId,
    ]);
  },

  async list(filters: InvitationListFilters): Promise<{ rows: InvitationRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.status) {
      where.push('i.status = ?');
      params.push(filters.status);
    } else if (!filters.includeDrafts) {
      where.push(`i.status <> 'draft'`);
    }
    if (filters.search) {
      where.push(`(i.reference_no LIKE ? OR i.groom_name LIKE ? OR i.bride_name LIKE ?
                   OR CONCAT(c.first_name, ' ', c.last_name) LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`);
      const pattern = likePattern(filters.search);
      params.push(pattern, pattern, pattern, pattern, pattern, pattern);
    }
    if (filters.templateId) {
      where.push('i.template_id = ?');
      params.push(filters.templateId);
    }
    if (filters.customerId) {
      where.push('i.customer_id = ?');
      params.push(filters.customerId);
    }
    if (filters.submittedFrom) {
      where.push('i.submitted_at >= ?');
      params.push(`${filters.submittedFrom} 00:00:00`);
    }
    if (filters.submittedTo) {
      where.push('i.submitted_at < ? + INTERVAL 1 DAY');
      params.push(filters.submittedTo);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = `${INVITATION_SORT_COLUMNS[filters.sortBy]} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    const [rows, count] = await Promise.all([
      findMany<InvitationRow>(
        `${SELECT} ${whereSql} ORDER BY ${orderBy}, i.id DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset],
      ),
      findOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM invitations i JOIN customers c ON c.id = i.customer_id ${whereSql}`,
        params,
      ),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  async create(customerId: number, templateId: number): Promise<number> {
    const result = await execute(
      'INSERT INTO invitations (customer_id, template_id) VALUES (?, ?)',
      [customerId, templateId],
    );
    const id = result.insertId;
    await execute(
      `UPDATE invitations SET reference_no = CONCAT('INV-', LPAD(id, 6, '0')) WHERE id = ?`,
      [id],
    );
    return id;
  },

  async updateContent(id: number, columns: InvitationContentColumns): Promise<void> {
    const { sql, values } = buildSetClause(columns);
    if (!sql) return;
    await execute(`UPDATE invitations SET ${sql} WHERE id = ?`, [...values, id]);
  },

  async updateStatus(
    id: number,
    columns: InvitationStatusColumns,
    db: DbExecutor = pool,
  ): Promise<void> {
    const { sql, values } = buildSetClause(columns);
    if (!sql) return;
    await execute(`UPDATE invitations SET ${sql} WHERE id = ?`, [...values, id], db);
  },

  async addHistory(
    entry: {
      invitationId: number;
      fromStatus: InvitationStatus | null;
      toStatus: InvitationStatus;
      changedByType: 'customer' | 'staff' | 'system';
      changedById: number | null;
      note?: string | null;
    },
    db: DbExecutor = pool,
  ): Promise<void> {
    await execute(
      `INSERT INTO invitation_status_history
         (invitation_id, from_status, to_status, changed_by_type, changed_by_id, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.invitationId,
        entry.fromStatus,
        entry.toStatus,
        entry.changedByType,
        entry.changedById,
        entry.note ?? null,
      ],
      db,
    );
  },

  listHistory(invitationId: number) {
    return findMany<StatusHistoryRow>(
      `SELECT h.id, h.from_status, h.to_status, h.changed_by_type, h.changed_by_id, h.note, h.created_at,
              CASE h.changed_by_type
                WHEN 'staff' THEN s.name
                WHEN 'customer' THEN CONCAT(c.first_name, ' ', c.last_name)
              END AS changed_by_name
         FROM invitation_status_history h
         LEFT JOIN staff_users s ON h.changed_by_type = 'staff' AND s.id = h.changed_by_id
         LEFT JOIN customers c ON h.changed_by_type = 'customer' AND c.id = h.changed_by_id
        WHERE h.invitation_id = ?
        ORDER BY h.created_at DESC, h.id DESC`,
      [invitationId],
    );
  },

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM invitations WHERE id = ?', [id]);
  },

  statusCounts() {
    return findMany<{ status: InvitationStatus; count: number }>(
      'SELECT status, COUNT(*) AS count FROM invitations GROUP BY status',
    );
  },
};
