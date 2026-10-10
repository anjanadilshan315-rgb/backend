export const STAFF_ROLES = ['admin', 'user'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const INVITATION_STATUSES = ['draft', 'pending', 'paid', 'cancelled'] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** Allowed status changes made by the sales team. */
export const STAFF_STATUS_TRANSITIONS: Record<InvitationStatus, InvitationStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['paid', 'cancelled'],
  paid: ['pending', 'cancelled'],
  cancelled: ['pending'],
};

/** Customers may edit their submission only in these statuses. */
export const CUSTOMER_EDITABLE_STATUSES: InvitationStatus[] = ['draft', 'pending'];

export const PHOTO_CATEGORIES = ['cover', 'groom', 'bride', 'gallery'] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];
export const SINGLE_PHOTO_CATEGORIES: PhotoCategory[] = ['cover', 'groom', 'bride'];
export const MAX_GALLERY_PHOTOS = 20;

export const GUEST_EMAIL_STATUSES = ['not_sent', 'queued', 'sent', 'failed'] as const;
export type GuestEmailStatus = (typeof GUEST_EMAIL_STATUSES)[number];

export const RSVP_STATUSES = ['pending', 'attending', 'declined'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const EMAIL_BATCH_STATUSES = [
  'queued',
  'processing',
  'completed',
  'completed_with_errors',
] as const;
export type EmailBatchStatus = (typeof EMAIL_BATCH_STATUSES)[number];
