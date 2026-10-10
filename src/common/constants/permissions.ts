/**
 * Permissions that an admin can grant to a staff user with role "user".
 * Admins implicitly have every permission (plus staff management).
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_UPDATE: 'customers.update',
  CUSTOMERS_DELETE: 'customers.delete',
  INVITATIONS_VIEW: 'invitations.view',
  INVITATIONS_UPDATE: 'invitations.update',
  INVITATIONS_UPDATE_STATUS: 'invitations.update_status',
  INVITATIONS_DELETE: 'invitations.delete',
  MESSAGES_VIEW: 'messages.view',
  MESSAGES_MANAGE: 'messages.manage',
  TEMPLATES_VIEW: 'templates.view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS = Object.values(PERMISSIONS) as [Permission, ...Permission[]];

/** Shown in the dashboard when assigning permissions. */
export const PERMISSION_CATALOG: { group: string; key: Permission; description: string }[] = [
  { group: 'Dashboard', key: PERMISSIONS.DASHBOARD_VIEW, description: 'View dashboard statistics' },
  { group: 'Customers', key: PERMISSIONS.CUSTOMERS_VIEW, description: 'View customers' },
  { group: 'Customers', key: PERMISSIONS.CUSTOMERS_CREATE, description: 'Register new customers' },
  {
    group: 'Customers',
    key: PERMISSIONS.CUSTOMERS_UPDATE,
    description: 'Edit customers, activate / deactivate, reset passwords',
  },
  { group: 'Customers', key: PERMISSIONS.CUSTOMERS_DELETE, description: 'Delete customers' },
  {
    group: 'Submissions',
    key: PERMISSIONS.INVITATIONS_VIEW,
    description: 'View customer submissions',
  },
  {
    group: 'Submissions',
    key: PERMISSIONS.INVITATIONS_UPDATE,
    description: 'Edit submission details and photos',
  },
  {
    group: 'Submissions',
    key: PERMISSIONS.INVITATIONS_UPDATE_STATUS,
    description: 'Change submission status (mark as paid, cancel)',
  },
  { group: 'Submissions', key: PERMISSIONS.INVITATIONS_DELETE, description: 'Delete submissions' },
  { group: 'Messages', key: PERMISSIONS.MESSAGES_VIEW, description: 'Read contact messages' },
  {
    group: 'Messages',
    key: PERMISSIONS.MESSAGES_MANAGE,
    description: 'Mark as read and delete contact messages',
  },
  { group: 'Templates', key: PERMISSIONS.TEMPLATES_VIEW, description: 'View invitation templates' },
];
