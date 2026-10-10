import type { Request, RequestHandler } from 'express';
import { ALL_PERMISSIONS } from '../constants/permissions.js';
import { AppError } from '../errors/app-error.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { staffRepository } from '../../modules/staff/staff.repository.js';
import { customerRepository } from '../../modules/customers/customer.repository.js';

function bearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) throw AppError.unauthorized();
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw AppError.unauthorized();
  return token;
}

/**
 * Sales-team authentication. The account is re-read on every request so that
 * deactivating a user or changing permissions takes effect immediately.
 */
export const authenticateStaff: RequestHandler = async (req, _res, next) => {
  const id = verifyAccessToken(bearerToken(req), 'staff');
  const staff = await staffRepository.findById(id);
  if (!staff || !staff.is_active) {
    throw AppError.unauthorized('Account is disabled or no longer exists', 'ACCOUNT_INACTIVE');
  }

  const permissions =
    staff.role === 'admin' ? ALL_PERMISSIONS : await staffRepository.findPermissions(staff.id);

  req.staff = {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    permissions: new Set(permissions),
  };
  next();
};

/** Website customer authentication. */
export const authenticateCustomer: RequestHandler = async (req, _res, next) => {
  const id = verifyAccessToken(bearerToken(req), 'customer');
  const customer = await customerRepository.findById(id);
  if (!customer || !customer.is_active) {
    throw AppError.unauthorized('Account is disabled or no longer exists', 'ACCOUNT_INACTIVE');
  }

  req.customer = {
    id: customer.id,
    firstName: customer.first_name,
    lastName: customer.last_name,
    email: customer.email,
  };
  next();
};
