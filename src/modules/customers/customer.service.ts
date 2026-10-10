import { AppError } from '../../common/errors/app-error.js';
import { buildPaginationMeta, toLimitOffset } from '../../common/utils/pagination.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import type { ChangePasswordInput } from '../auth/auth.validation.js';
import type { ClientMeta } from '../auth/token.service.js';
import { tokenService } from '../auth/token.service.js';
import { invitationRepository } from '../invitations/invitation.repository.js';
import { toInvitationSummaryDto } from '../invitations/invitation.mapper.js';
import { photoService } from '../invitations/photo.service.js';
import { customerRepository } from './customer.repository.js';
import type { CustomerListRow, CustomerRow } from './customer.repository.js';
import type {
  AdminUpdateCustomerInput,
  ListCustomersQuery,
  RegisterCustomerInput,
  UpdateProfileInput,
} from './customer.validation.js';

export function toCustomerDto(row: CustomerRow) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`,
    email: row.email,
    phone: row.phone,
    isActive: Boolean(row.is_active),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCustomerListDto(row: CustomerListRow) {
  return {
    ...toCustomerDto(row),
    invitationCount: Number(row.invitation_count),
    pendingCount: Number(row.pending_count),
    paidCount: Number(row.paid_count),
  };
}

async function getRowOrThrow(id: number): Promise<CustomerRow> {
  const row = await customerRepository.findById(id);
  if (!row) throw AppError.notFound('Customer not found');
  return row;
}

async function assertEmailAvailable(email: string, exceptId?: number): Promise<void> {
  const existing = await customerRepository.findByEmail(email);
  if (existing && existing.id !== exceptId) {
    throw AppError.conflict('An account with this e-mail already exists', 'EMAIL_TAKEN');
  }
}

async function createCustomer(input: RegisterCustomerInput, createdByStaffId: number | null) {
  await assertEmailAvailable(input.email);
  const id = await customerRepository.create({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    createdByStaffId,
  });
  return getRowOrThrow(id);
}

export const customerService = {
  // ---- Website (customer self-service) ---------------------------------------

  async register(input: RegisterCustomerInput, meta: ClientMeta) {
    const row = await createCustomer(input, null);
    await customerRepository.touchLastLogin(row.id);
    return { user: toCustomerDto(row), tokens: await tokenService.issue('customer', row.id, meta) };
  },

  async getProfile(id: number) {
    return toCustomerDto(await getRowOrThrow(id));
  },

  async updateProfile(id: number, input: UpdateProfileInput) {
    if (input.email) await assertEmailAvailable(input.email, id);
    await customerRepository.update(id, {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
    });
    return this.getProfile(id);
  },

  async changePassword(id: number, input: ChangePasswordInput, meta: ClientMeta) {
    const row = await getRowOrThrow(id);
    if (!(await verifyPassword(input.currentPassword, row.password_hash))) {
      throw AppError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }
    await customerRepository.updatePassword(id, await hashPassword(input.newPassword));
    await tokenService.revokeAll('customer', id);
    return { tokens: await tokenService.issue('customer', id, meta) };
  },

  // ---- Sales team -------------------------------------------------------------

  async list(query: ListCustomersQuery) {
    const [limit, offset] = toLimitOffset(query);
    const { rows, total } = await customerRepository.list({
      search: query.search,
      isActive: query.isActive,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit,
      offset,
    });
    return { items: rows.map(toCustomerListDto), meta: buildPaginationMeta(query, total) };
  },

  async getWithInvitations(id: number) {
    const row = await getRowOrThrow(id);
    const invitations = await invitationRepository.listForCustomer(id);
    return { ...toCustomerDto(row), invitations: invitations.map(toInvitationSummaryDto) };
  },

  async adminCreate(input: RegisterCustomerInput, staffId: number) {
    return toCustomerDto(await createCustomer(input, staffId));
  },

  async adminUpdate(id: number, input: AdminUpdateCustomerInput) {
    await getRowOrThrow(id);
    if (input.email) await assertEmailAvailable(input.email, id);
    await customerRepository.update(id, {
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      is_active: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
    });
    if (input.isActive === false) await tokenService.revokeAll('customer', id);
    return this.getProfile(id);
  },

  async adminResetPassword(id: number, newPassword: string) {
    await getRowOrThrow(id);
    await customerRepository.updatePassword(id, await hashPassword(newPassword));
    await tokenService.revokeAll('customer', id);
  },

  async adminDelete(id: number) {
    await getRowOrThrow(id);
    const publicIds = await photoService.publicIdsForCustomer(id);
    await tokenService.deleteAll('customer', id);
    await customerRepository.delete(id); // cascades to invitations, photos, guests, wishes
    photoService.destroyRemoteInBackground(publicIds);
  },
};
