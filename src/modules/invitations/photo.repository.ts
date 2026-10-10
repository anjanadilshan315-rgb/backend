import { execute, findMany, findOne } from '../../config/database.js';
import type { PhotoCategory } from '../../common/constants/statuses.js';

export interface PhotoRow {
  id: number;
  invitation_id: number;
  category: PhotoCategory;
  url: string;
  public_id: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  sort_order: number;
  created_at: Date;
}

export interface NewPhoto {
  invitationId: number;
  category: PhotoCategory;
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  bytes: number | null;
  sortOrder: number;
}

const COLUMNS =
  'id, invitation_id, category, url, public_id, width, height, bytes, sort_order, created_at';

export const photoRepository = {
  listForInvitation(invitationId: number) {
    return findMany<PhotoRow>(
      `SELECT ${COLUMNS} FROM invitation_photos WHERE invitation_id = ? ORDER BY category, sort_order, id`,
      [invitationId],
    );
  },

  listByCategory(invitationId: number, category: PhotoCategory) {
    return findMany<PhotoRow>(
      `SELECT ${COLUMNS} FROM invitation_photos WHERE invitation_id = ? AND category = ? ORDER BY sort_order, id`,
      [invitationId, category],
    );
  },

  findById(invitationId: number, photoId: number) {
    return findOne<PhotoRow>(
      `SELECT ${COLUMNS} FROM invitation_photos WHERE id = ? AND invitation_id = ?`,
      [photoId, invitationId],
    );
  },

  async insertMany(photos: NewPhoto[]): Promise<void> {
    if (photos.length === 0) return;
    await execute(
      `INSERT INTO invitation_photos (invitation_id, category, url, public_id, width, height, bytes, sort_order)
       VALUES ?`,
      [
        photos.map((p) => [
          p.invitationId,
          p.category,
          p.url,
          p.publicId,
          p.width,
          p.height,
          p.bytes,
          p.sortOrder,
        ]),
      ],
    );
  },

  async deleteByIds(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await execute('DELETE FROM invitation_photos WHERE id IN (?)', [ids]);
  },

  async setSortOrder(invitationId: number, orderedIds: number[]): Promise<void> {
    await Promise.all(
      orderedIds.map((id, index) =>
        execute('UPDATE invitation_photos SET sort_order = ? WHERE id = ? AND invitation_id = ?', [
          index,
          id,
          invitationId,
        ]),
      ),
    );
  },

  async publicIdsForInvitation(invitationId: number): Promise<string[]> {
    const rows = await findMany<{ public_id: string }>(
      'SELECT public_id FROM invitation_photos WHERE invitation_id = ?',
      [invitationId],
    );
    return rows.map((row) => row.public_id);
  },

  async publicIdsForCustomer(customerId: number): Promise<string[]> {
    const rows = await findMany<{ public_id: string }>(
      `SELECT p.public_id FROM invitation_photos p
         JOIN invitations i ON i.id = p.invitation_id
        WHERE i.customer_id = ?`,
      [customerId],
    );
    return rows.map((row) => row.public_id);
  },
};
