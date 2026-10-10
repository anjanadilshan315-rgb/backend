import type { Permission } from '../constants/permissions.js';
import type { StaffRole } from '../constants/statuses.js';

export type SubjectType = 'staff' | 'customer';

export interface AuthStaff {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Set<Permission>;
}

export interface AuthCustomer {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    staff?: AuthStaff;
    customer?: AuthCustomer;
  }
}
