import { execute, findMany, findOne } from '../../config/database.js';
import { likePattern } from '../../common/utils/pagination.js';

export interface MessageRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: number;
  created_at: Date;
}

const COLUMNS = 'id, name, email, phone, subject, message, is_read, created_at';

export const messageRepository = {
  async list(filters: { isRead?: boolean; search?: string; limit: number; offset: number }) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filters.isRead !== undefined) {
      where.push('is_read = ?');
      params.push(filters.isRead ? 1 : 0);
    }
    if (filters.search) {
      where.push('(name LIKE ? OR email LIKE ? OR subject LIKE ?)');
      const pattern = likePattern(filters.search);
      params.push(pattern, pattern, pattern);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows, count] = await Promise.all([
      findMany<MessageRow>(
        `SELECT ${COLUMNS} FROM contact_messages ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, filters.offset],
      ),
      findOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM contact_messages ${whereSql}`,
        params,
      ),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  findById(id: number) {
    return findOne<MessageRow>(`SELECT ${COLUMNS} FROM contact_messages WHERE id = ?`, [id]);
  },

  async create(message: {
    name: string;
    email: string;
    phone: string | null;
    subject: string | null;
    message: string;
  }) {
    const result = await execute(
      'INSERT INTO contact_messages (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)',
      [message.name, message.email, message.phone, message.subject, message.message],
    );
    return result.insertId;
  },

  async setRead(id: number, isRead: boolean): Promise<void> {
    await execute('UPDATE contact_messages SET is_read = ? WHERE id = ?', [isRead ? 1 : 0, id]);
  },

  async delete(id: number): Promise<void> {
    await execute('DELETE FROM contact_messages WHERE id = ?', [id]);
  },

  async unreadCount(): Promise<number> {
    const row = await findOne<{ total: number }>(
      'SELECT COUNT(*) AS total FROM contact_messages WHERE is_read = 0',
    );
    return Number(row?.total ?? 0);
  },
};
