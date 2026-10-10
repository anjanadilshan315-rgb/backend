import { execute, findMany, findOne } from '../../config/database.js';

export interface WishRow {
  id: number;
  invitation_id: number;
  guest_id: number | null;
  name: string;
  message: string;
  is_visible: number;
  created_at: Date;
}

const COLUMNS = 'id, invitation_id, guest_id, name, message, is_visible, created_at';

export const wishRepository = {
  async list(
    invitationId: number,
    options: { onlyVisible: boolean; limit: number; offset: number },
  ): Promise<{ rows: WishRow[]; total: number }> {
    const where = `WHERE invitation_id = ?${options.onlyVisible ? ' AND is_visible = 1' : ''}`;
    const [rows, count] = await Promise.all([
      findMany<WishRow>(
        `SELECT ${COLUMNS} FROM wishes ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [invitationId, options.limit, options.offset],
      ),
      findOne<{ total: number }>(`SELECT COUNT(*) AS total FROM wishes ${where}`, [invitationId]),
    ]);
    return { rows, total: Number(count?.total ?? 0) };
  },

  findById(invitationId: number, wishId: number) {
    return findOne<WishRow>(`SELECT ${COLUMNS} FROM wishes WHERE id = ? AND invitation_id = ?`, [
      wishId,
      invitationId,
    ]);
  },

  async create(wish: {
    invitationId: number;
    guestId: number | null;
    name: string;
    message: string;
  }) {
    const result = await execute(
      'INSERT INTO wishes (invitation_id, guest_id, name, message) VALUES (?, ?, ?, ?)',
      [wish.invitationId, wish.guestId, wish.name, wish.message],
    );
    return result.insertId;
  },

  async setVisible(wishId: number, visible: boolean): Promise<void> {
    await execute('UPDATE wishes SET is_visible = ? WHERE id = ?', [visible ? 1 : 0, wishId]);
  },

  async delete(wishId: number): Promise<void> {
    await execute('DELETE FROM wishes WHERE id = ?', [wishId]);
  },
};
