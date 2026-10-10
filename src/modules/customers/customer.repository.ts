import { execute, findMany, findOne } from '../../config/database.js';
import { likePattern } from '../../common/utils/pagination.js';
import { buildSetClause } from '../../common/utils/sql.js';

export interface CustomerRow {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password_hash: string;
  is_active: number;
  last_login_at: Date | null;
  created_by_staff_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerListRow extends CustomerRow {
  invitation_count: number;
  pending_count: number;
  paid_count: number;
}

export const CUSTOMER_SORT_COLUMNS = {
  createdAt: 'c.created_at',
  name: 'c.first_name',
  email: 'c.email',
  lastLoginAt: 'c.last_login_at',
} as const;

export interface CustomerListFilters {
  search?: string;
  isActive?: boolean;
  sortBy: keyof typeof CUSTOMER_SORT_COLUMNS;
  sortOrder: 'asc' | 'desc';
  limit: number;
  offset: number;
}

const COLUMNS = `c.id, c.first_name, c.last_name, c.email, c.phone, c.password_hash, c.is_active,
                 c.last_login_at, c.created_by_staff_id, c.created_at, c.updated_at`;

export const customerRepository = {
  findById(id: number) {
    return findOne<CustomerRow>(`SELECT ${COLUMNS} FROM customers c WHERE c.id = ?`, [id]);
  },

  findByEmail(email: string) {
    return findOne<CustomerRow>(`SELECT ${COLUMNS} FROM customers c WHERE c.email = ?`, [email]);
  },

  async list(filters: CustomerListFilters): Promise<{ rows: CustomerListRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.search) {
      where.push(
        `(CONCAT(c.first_name, ' ', c.last_name) LIKE ? OR c.email LIKE ? OR c.phone LIKE ?)`,
      );
      const pattern = likePattern(filters.search);
      params.push(pattern, pattern, pattern);
    }
    if (filters.isActive !== undefined) {
      where.push('c.is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderBy = `${CUSTOMER_SORT_COLUMNS[filters.sortBy]} ${filters.sortOrder === 'asc' ? 'ASC' : 'DESC'}`;

    const [rows, count] = await Promise.all([
      findMany<CustomerListRow>(
        `SELECT ${COLUMNS},
                COUNT(i.id) AS invitation_count,
                COALESCE(SUM(i.status = 'pending'), 0) AS pending_count,
                COALESCE(SUM(i.status = 'paid'), 0) AS paid_count
           FROM customers c
           LEFT JOIN invitations i ON i.customer_id = c.id
           ${whereSql}
          GROUP BY c.id
          ORDER BY ${orderBy}, c.id DESC
          LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset],
      ),
      findOne<{ total: number }>(`SELECT COUNT(*) AS total FROM customers c ${whereSql}`, params),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  async create(data: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    passwordHash: string;
    createdByStaffId?: number | null;
  }): Promise<number> {
    const result = await execute(
      `INSERT INTO customers (first_name, last_name, email, phone, password_hash, created_by_staff_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.firstName,
        data.lastName,
        data.email,
        data.phone,
        data.passwordHash,
        data.createdByStaffId ?? null,
      ],
    );
    return result.insertId;
  },

  async update(
    id: number,
    fields: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
      is_active?: number;
    },
  ): Promise<void> {
    const { sql, values } = buildSetClause(fields);
    if (!sql) return;
    await execute(`UPDATE customers SET ${sql} WHERE id = ?`, [...values, id]);
  },

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await execute('UPDATE customers SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async touchLastLogin(id: number): Promise<void> {
    await execute('UPDATE customers SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
  },

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM customers WHERE id = ?', [id]);
  },
};
