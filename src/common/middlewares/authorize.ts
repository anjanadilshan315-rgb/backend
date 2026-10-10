import type { Request, RequestHandler } from 'express';
import type { Permission } from '../constants/permissions.js';
import { AppError } from '../errors/app-error.js';
import type { AuthCustomer, AuthStaff } from '../types/auth.js';

/** Admin only (staff management, admin-level settings). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.staff) throw AppError.unauthorized();
  if (req.staff.role !== 'admin') throw AppError.forbidden('Only admins can perform this action');
  next();
};

/** Requires every listed permission. Admins always pass. */
export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (req, _res, next) => {
    const staff = req.staff;
    if (!staff) throw AppError.unauthorized();
    if (staff.role === 'admin' || permissions.every((p) => staff.permissions.has(p))) {
      next();
      return;
    }
    throw AppError.forbidden();
  };
}

export function currentStaff(req: Request): AuthStaff {
  if (!req.staff) throw AppError.unauthorized();
  return req.staff;
}

export function currentCustomer(req: Request): AuthCustomer {
  if (!req.customer) throw AppError.unauthorized();
  return req.customer;
}
