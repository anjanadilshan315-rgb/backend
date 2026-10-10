import { AppError } from '../../common/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import { staffRepository } from '../staff/staff.repository.js';
import { staffService } from '../staff/staff.service.js';
import type { ChangePasswordInput, LoginInput } from './auth.validation.js';
import { tokenService } from './token.service.js';
import type { ClientMeta } from './token.service.js';

const invalidCredentials = () =>
  AppError.unauthorized('Invalid e-mail or password', 'INVALID_CREDENTIALS');

export const staffAuthService = {
  async login({ email, password }: LoginInput, meta: ClientMeta) {
    const staff = await staffRepository.findByEmail(email);
    const passwordOk = await verifyPassword(password, staff?.password_hash);
    if (!staff || !passwordOk) throw invalidCredentials();
    if (!staff.is_active)
      throw AppError.forbidden('This account has been disabled', 'ACCOUNT_DISABLED');

    await staffRepository.touchLastLogin(staff.id);
    const [user, tokens] = await Promise.all([
      staffService.getById(staff.id),
      tokenService.issue('staff', staff.id, meta),
    ]);
    return { user, tokens };
  },

  async refresh(refreshToken: string, meta: ClientMeta) {
    const staffId = await tokenService.consume('staff', refreshToken);
    const staff = await staffRepository.findById(staffId);
    if (!staff || !staff.is_active) {
      throw AppError.unauthorized('Account is disabled or no longer exists', 'ACCOUNT_INACTIVE');
    }
    return { tokens: await tokenService.issue('staff', staffId, meta) };
  },

  logout(refreshToken: string) {
    return tokenService.revoke(refreshToken);
  },

  /** Changes the password, signs out every other session and returns fresh tokens. */
  async changePassword(staffId: number, input: ChangePasswordInput, meta: ClientMeta) {
    const staff = await staffRepository.findById(staffId);
    if (!staff) throw AppError.unauthorized();
    if (!(await verifyPassword(input.currentPassword, staff.password_hash))) {
      throw AppError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
    }
    await staffRepository.updatePassword(staffId, await hashPassword(input.newPassword));
    await tokenService.revokeAll('staff', staffId);
    return { tokens: await tokenService.issue('staff', staffId, meta) };
  },
};
