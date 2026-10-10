import { withTransaction } from '../../config/database.js';
import { ALL_PERMISSIONS } from '../../common/constants/permissions.js';
import type { Permission } from '../../common/constants/permissions.js';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthStaff } from '../../common/types/auth.js';
import { buildPaginationMeta, toLimitOffset } from '../../common/utils/pagination.js';
import { hashPassword } from '../../common/utils/password.js';
import { tokenService } from '../auth/token.service.js';
import { staffRepository } from './staff.repository.js';
import type { StaffRow } from './staff.repository.js';
import type {
  CreateStaffInput,
  ListStaffQuery,
  UpdateOwnProfileInput,
  UpdateStaffInput,
} from './staff.validation.js';

export function toStaffDto(row: StaffRow, permissions: Permission[]) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    isActive: Boolean(row.is_active),
    permissions: row.role === 'admin' ? ALL_PERMISSIONS : permissions,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type StaffDto = ReturnType<typeof toStaffDto>;

async function getRowOrThrow(id: number): Promise<StaffRow> {
  const row = await staffRepository.findById(id);
  if (!row) throw AppError.notFound('Staff user not found');
  return row;
}

async function assertEmailAvailable(email: string, exceptId?: number): Promise<void> {
  const existing = await staffRepository.findByEmail(email);
  if (existing && existing.id !== exceptId) {
    throw AppError.conflict('A staff user with this e-mail already exists', 'EMAIL_TAKEN');
  }
}

export const staffService = {
  async getById(id: number): Promise<StaffDto> {
    const row = await getRowOrThrow(id);
    return toStaffDto(row, await staffRepository.findPermissions(id));
  },

  async list(query: ListStaffQuery) {
    const [limit, offset] = toLimitOffset(query);
    const { rows, total } = await staffRepository.list({
      search: query.search,
      role: query.role,
      isActive: query.isActive,
      limit,
      offset,
    });
    const permissions = await staffRepository.findPermissionsForMany(rows.map((row) => row.id));
    return {
      items: rows.map((row) => toStaffDto(row, permissions.get(row.id) ?? [])),
      meta: buildPaginationMeta(query, total),
    };
  },

  async create(input: CreateStaffInput, actor: AuthStaff): Promise<StaffDto> {
    await assertEmailAvailable(input.email);
    const passwordHash = await hashPassword(input.password);

    const id = await withTransaction(async (conn) => {
      const newId = await staffRepository.create(
        {
          name: input.name,
          email: input.email,
          phone: input.phone ?? null,
          passwordHash,
          role: input.role,
          createdBy: actor.id,
        },
        conn,
      );
      if (input.role === 'user') {
        await staffRepository.replacePermissions(newId, input.permissions, conn);
      }
      return newId;
    });

    return this.getById(id);
  },

  async update(id: number, input: UpdateStaffInput, actor: AuthStaff): Promise<StaffDto> {
    const current = await getRowOrThrow(id);

    if (id === actor.id) {
      if (input.role !== undefined && input.role !== current.role) {
        throw AppError.badRequest('You cannot change your own role', 'SELF_MODIFICATION');
      }
      if (input.isActive === false) {
        throw AppError.badRequest('You cannot deactivate your own account', 'SELF_MODIFICATION');
      }
    }
    if (input.email && input.email !== current.email) await assertEmailAvailable(input.email, id);

    const nextRole = input.role ?? current.role;
    await withTransaction(async (conn) => {
      await staffRepository.update(
        id,
        {
          name: input.name,
          email: input.email,
          phone: input.phone,
          role: input.role,
          is_active: input.isActive === undefined ? undefined : input.isActive ? 1 : 0,
        },
        conn,
      );
      if (nextRole === 'admin') {
        await staffRepository.replacePermissions(id, [], conn);
      } else if (input.permissions) {
        await staffRepository.replacePermissions(id, input.permissions, conn);
      }
    });

    const roleChanged = input.role !== undefined && input.role !== current.role;
    if (input.isActive === false || roleChanged) await tokenService.revokeAll('staff', id);

    return this.getById(id);
  },

  async setPermissions(id: number, permissions: Permission[]): Promise<StaffDto> {
    const row = await getRowOrThrow(id);
    if (row.role === 'admin') {
      throw AppError.badRequest(
        'Admins already have every permission',
        'ADMIN_HAS_ALL_PERMISSIONS',
      );
    }
    await staffRepository.replacePermissions(id, permissions);
    return this.getById(id);
  },

  async resetPassword(id: number, newPassword: string): Promise<void> {
    await getRowOrThrow(id);
    await staffRepository.updatePassword(id, await hashPassword(newPassword));
    await tokenService.revokeAll('staff', id);
  },

  async delete(id: number, actor: AuthStaff): Promise<void> {
    if (id === actor.id) {
      throw AppError.badRequest('You cannot delete your own account', 'SELF_MODIFICATION');
    }
    await getRowOrThrow(id);
    await tokenService.deleteAll('staff', id);
    await staffRepository.delete(id);
  },

  async updateOwnProfile(id: number, input: UpdateOwnProfileInput): Promise<StaffDto> {
    await staffRepository.update(id, { name: input.name, phone: input.phone });
    return this.getById(id);
  },
};
