import { execute, findMany, findOne, pool } from '../../config/database.js';
import type { DbExecutor } from '../../config/database.js';
import type { Permission } from '../../common/constants/permissions.js';
import type { StaffRole } from '../../common/constants/statuses.js';
import { likePattern } from '../../common/utils/pagination.js';
import { buildSetClause, inPlaceholders } from '../../common/utils/sql.js';

export interface StaffRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: StaffRole;
  is_active: number;
  last_login_at: Date | null;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface StaffListFilters {
  search?: string;
  role?: StaffRole;
  isActive?: boolean;
  limit: number;
  offset: number;
}

const COLUMNS = `id, name, email, phone, password_hash, role, is_active, last_login_at,
                 created_by, created_at, updated_at`;

export const staffRepository = {
  findById(id: number, db: DbExecutor = pool) {
    return findOne<StaffRow>(`SELECT ${COLUMNS} FROM staff_users WHERE id = ?`, [id], db);
  },

  findByEmail(email: string) {
    return findOne<StaffRow>(`SELECT ${COLUMNS} FROM staff_users WHERE email = ?`, [email]);
  },

  async findPermissions(staffId: number): Promise<Permission[]> {
    const rows = await findMany<{ permission: Permission }>(
      'SELECT permission FROM staff_permissions WHERE staff_id = ? ORDER BY permission',
      [staffId],
    );
    return rows.map((row) => row.permission);
  },

  async findPermissionsForMany(staffIds: number[]): Promise<Map<number, Permission[]>> {
    const map = new Map<number, Permission[]>();
    if (staffIds.length === 0) return map;
    const rows = await findMany<{ staff_id: number; permission: Permission }>(
      `SELECT staff_id, permission FROM staff_permissions WHERE staff_id IN ${inPlaceholders(staffIds.length)}`,
      staffIds,
    );
    for (const row of rows) {
      map.set(row.staff_id, [...(map.get(row.staff_id) ?? []), row.permission]);
    }
    return map;
  },

  async list(filters: StaffListFilters): Promise<{ rows: StaffRow[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.search) {
      where.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)');
      const pattern = likePattern(filters.search);
      params.push(pattern, pattern, pattern);
    }
    if (filters.role) {
      where.push('role = ?');
      params.push(filters.role);
    }
    if (filters.isActive !== undefined) {
      where.push('is_active = ?');
      params.push(filters.isActive ? 1 : 0);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows, count] = await Promise.all([
      findMany<StaffRow>(
        `SELECT ${COLUMNS} FROM staff_users ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset],
      ),
      findOne<{ total: number }>(`SELECT COUNT(*) AS total FROM staff_users ${whereSql}`, params),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  async create(
    data: {
      name: string;
      email: string;
      phone: string | null;
      passwordHash: string;
      role: StaffRole;
      createdBy: number | null;
    },
    db: DbExecutor = pool,
  ): Promise<number> {
    const result = await execute(
      `INSERT INTO staff_users (name, email, phone, password_hash, role, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.name, data.email, data.phone, data.passwordHash, data.role, data.createdBy],
      db,
    );
    return result.insertId;
  },

  async update(
    id: number,
    fields: {
      name?: string;
      email?: string;
      phone?: string | null;
      role?: StaffRole;
      is_active?: number;
    },
    db: DbExecutor = pool,
  ): Promise<void> {
    const { sql, values } = buildSetClause(fields);
    if (!sql) return;
    await execute(`UPDATE staff_users SET ${sql} WHERE id = ?`, [...values, id], db);
  },

  async updatePassword(id: number, passwordHash: string): Promise<void> {
    await execute('UPDATE staff_users SET password_hash = ? WHERE id = ?', [passwordHash, id]);
  },

  async touchLastLogin(id: number): Promise<void> {
    await execute('UPDATE staff_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
  },

  async replacePermissions(
    staffId: number,
    permissions: Permission[],
    db: DbExecutor = pool,
  ): Promise<void> {
    await execute('DELETE FROM staff_permissions WHERE staff_id = ?', [staffId], db);
    if (permissions.length === 0) return;
    await execute(
      'INSERT INTO staff_permissions (staff_id, permission) VALUES ?',
      [permissions.map((permission) => [staffId, permission])],
      db,
    );
  },

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM staff_users WHERE id = ?', [id]);
  },
};
