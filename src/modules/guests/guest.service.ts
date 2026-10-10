import { AppError } from '../../common/errors/app-error.js';
import { buildPaginationMeta, toLimitOffset } from '../../common/utils/pagination.js';
import { randomToken } from '../../common/utils/strings.js';
import { buildInviteUrl } from '../invitations/invitation.mapper.js';
import type { InvitationRow } from '../invitations/invitation.repository.js';
import { parseGuestWorkbook } from './guest-excel.service.js';
import { guestRepository } from './guest.repository.js';
import type { GuestRow } from './guest.repository.js';
import type {
  CreateGuestInput,
  ListGuestsQuery,
  RsvpInput,
  UpdateGuestInput,
} from './guest.validation.js';

export function toGuestDto(row: GuestRow, slug: string | null) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    inviteCode: row.invite_code,
    inviteUrl: slug ? buildInviteUrl(slug, { name: row.name, inviteCode: row.invite_code }) : null,
    emailStatus: row.email_status,
    emailError: row.email_error,
    emailSentAt: row.email_sent_at,
    rsvpStatus: row.rsvp_status,
    headCount: row.head_count,
    respondedAt: row.responded_at,
    createdAt: row.created_at,
  };
}

async function getOrThrow(invitationId: number, guestId: number): Promise<GuestRow> {
  const guest = await guestRepository.findById(invitationId, guestId);
  if (!guest) throw AppError.notFound('Guest not found');
  return guest;
}

async function assertEmailFree(invitationId: number, email: string, exceptGuestId?: number) {
  const existing = await guestRepository.findByEmail(invitationId, email);
  if (existing && existing.id !== exceptGuestId) {
    throw AppError.conflict('A guest with this e-mail is already on the list', 'GUEST_EXISTS');
  }
}

export const guestService = {
  async list(invitation: InvitationRow, query: ListGuestsQuery) {
    const [limit, offset] = toLimitOffset(query);
    const { rows, total } = await guestRepository.list(invitation.id, {
      search: query.search,
      emailStatus: query.emailStatus,
      rsvpStatus: query.rsvpStatus,
      limit,
      offset,
    });
    return {
      items: rows.map((row) => toGuestDto(row, invitation.slug)),
      meta: buildPaginationMeta(query, total),
    };
  },

  stats(invitationId: number) {
    return guestRepository.stats(invitationId);
  },

  async add(invitation: InvitationRow, input: CreateGuestInput) {
    await assertEmailFree(invitation.id, input.email);
    const id = await guestRepository.insert(invitation.id, {
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      inviteCode: randomToken(),
    });
    return toGuestDto(await getOrThrow(invitation.id, id), invitation.slug);
  },

  async update(invitation: InvitationRow, guestId: number, input: UpdateGuestInput) {
    const guest = await getOrThrow(invitation.id, guestId);
    const emailChanged = input.email !== undefined && input.email !== guest.email;
    if (emailChanged) await assertEmailFree(invitation.id, input.email!, guestId);

    await guestRepository.update(guestId, {
      name: input.name,
      email: input.email,
      phone: input.phone,
      // A new address has not received the invitation yet.
      ...(emailChanged && guest.email_status !== 'queued'
        ? { email_status: 'not_sent' as const, email_error: null }
        : {}),
    });
    return toGuestDto(await getOrThrow(invitation.id, guestId), invitation.slug);
  },

  async remove(invitationId: number, guestId: number) {
    await getOrThrow(invitationId, guestId);
    await guestRepository.delete(guestId);
  },

  async bulkRemove(invitationId: number, guestIds: number[]) {
    return { deleted: await guestRepository.deleteMany(invitationId, guestIds) };
  },

  /** Imports an .xlsx guest list. Invalid rows and duplicates are reported, not fatal. */
  async importExcel(invitation: InvitationRow, file: Express.Multer.File | undefined) {
    if (!file) throw AppError.badRequest('Attach the Excel file in the "file" field', 'NO_FILE');

    const { guests, errors, totalRows } = await parseGuestWorkbook(file.buffer);
    const existing = await guestRepository.existingEmails(invitation.id);

    const fresh = guests.filter((guest) => !existing.has(guest.email));
    const alreadyListed = guests
      .filter((guest) => existing.has(guest.email))
      .map((guest) => ({ row: guest.row, reason: `Already on the guest list (${guest.email})` }));

    await guestRepository.insertMany(
      invitation.id,
      fresh.map((guest) => ({
        name: guest.name,
        email: guest.email,
        phone: guest.phone,
        inviteCode: randomToken(),
      })),
    );

    return {
      totalRows,
      imported: fresh.length,
      skipped: errors.length + alreadyListed.length,
      errors: [...errors, ...alreadyListed].sort((a, b) => a.row - b.row),
    };
  },

  /**
   * RSVP from the public invitation page. With an invite code the matching guest
   * is updated; without one (e.g. a link shared on WhatsApp) a guest is created.
   */
  async rsvp(invitation: InvitationRow, input: RsvpInput) {
    let guest: GuestRow;
    if (input.code) {
      const found = await guestRepository.findByCode(invitation.id, input.code);
      if (!found) throw AppError.notFound('Invite code not recognised', 'INVALID_INVITE_CODE');
      guest = found;
    } else {
      const id = await guestRepository.insert(invitation.id, {
        name: input.name!,
        email: null,
        phone: null,
        inviteCode: randomToken(),
      });
      guest = await getOrThrow(invitation.id, id);
    }

    const status = input.attending ? 'attending' : 'declined';
    const headCount = input.attending ? input.headCount : 0;
    await guestRepository.recordRsvp(guest.id, status, headCount);
    return { name: guest.name, rsvpStatus: status, headCount, inviteCode: guest.invite_code };
  },
};
