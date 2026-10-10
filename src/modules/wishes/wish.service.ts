import { AppError } from '../../common/errors/app-error.js';
import { buildPaginationMeta, toLimitOffset } from '../../common/utils/pagination.js';
import type { PaginationInput } from '../../common/utils/pagination.js';
import { guestRepository } from '../guests/guest.repository.js';
import { wishRepository } from './wish.repository.js';
import type { WishRow } from './wish.repository.js';

function toWishDto(row: WishRow) {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    isVisible: Boolean(row.is_visible),
    fromInvitedGuest: row.guest_id !== null,
    createdAt: row.created_at,
  };
}

function toPublicWishDto(row: WishRow) {
  return { id: row.id, name: row.name, message: row.message, createdAt: row.created_at };
}

export const wishService = {
  async list(invitationId: number, pagination: PaginationInput, onlyVisible: boolean) {
    const [limit, offset] = toLimitOffset(pagination);
    const { rows, total } = await wishRepository.list(invitationId, { onlyVisible, limit, offset });
    return {
      items: rows.map(onlyVisible ? toPublicWishDto : toWishDto),
      meta: buildPaginationMeta(pagination, total),
    };
  },

  async create(invitationId: number, input: { name: string; message: string; code?: string }) {
    const guest = input.code ? await guestRepository.findByCode(invitationId, input.code) : null;
    const id = await wishRepository.create({
      invitationId,
      guestId: guest?.id ?? null,
      name: input.name,
      message: input.message,
    });
    return toPublicWishDto((await wishRepository.findById(invitationId, id))!);
  },

  async setVisible(invitationId: number, wishId: number, visible: boolean) {
    if (!(await wishRepository.findById(invitationId, wishId)))
      throw AppError.notFound('Wish not found');
    await wishRepository.setVisible(wishId, visible);
    return toWishDto((await wishRepository.findById(invitationId, wishId))!);
  },

  async remove(invitationId: number, wishId: number) {
    if (!(await wishRepository.findById(invitationId, wishId)))
      throw AppError.notFound('Wish not found');
    await wishRepository.delete(wishId);
  },
};
