import { AppError } from '../../common/errors/app-error.js';
import { verifyPassword } from '../../common/utils/password.js';
import { customerRepository } from '../customers/customer.repository.js';
import { toCustomerDto } from '../customers/customer.service.js';
import type { LoginInput } from './auth.validation.js';
import { tokenService } from './token.service.js';
import type { ClientMeta } from './token.service.js';

export const customerAuthService = {
  async login({ email, password }: LoginInput, meta: ClientMeta) {
    const customer = await customerRepository.findByEmail(email);
    const passwordOk = await verifyPassword(password, customer?.password_hash);
    if (!customer || !passwordOk) {
      throw AppError.unauthorized('Invalid e-mail or password', 'INVALID_CREDENTIALS');
    }
    if (!customer.is_active) {
      throw AppError.forbidden(
        'This account has been disabled. Please contact us.',
        'ACCOUNT_DISABLED',
      );
    }

    await customerRepository.touchLastLogin(customer.id);
    return {
      user: toCustomerDto(customer),
      tokens: await tokenService.issue('customer', customer.id, meta),
    };
  },

  async refresh(refreshToken: string, meta: ClientMeta) {
    const customerId = await tokenService.consume('customer', refreshToken);
    const customer = await customerRepository.findById(customerId);
    if (!customer || !customer.is_active) {
      throw AppError.unauthorized('Account is disabled or no longer exists', 'ACCOUNT_INACTIVE');
    }
    return { tokens: await tokenService.issue('customer', customerId, meta) };
  },

  logout(refreshToken: string) {
    return tokenService.revoke(refreshToken);
  },
};
