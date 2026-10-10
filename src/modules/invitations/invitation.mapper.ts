import { env } from '../../config/env.js';
import { parseJsonColumn } from '../../common/utils/json.js';
import type { InvitationRow, StatusHistoryRow } from './invitation.repository.js';
import type { PhotoRow } from './photo.repository.js';

export interface EventScheduleItem {
  name: string;
  time: string;
  venue?: string;
  description?: string;
}

export function buildInviteUrl(slug: string, guest?: { name: string; inviteCode: string }): string {
  const base = `${env.WEBSITE_URL.replace(/\/$/, '')}/invite/${encodeURIComponent(slug)}`;
  if (!guest) return base;
  const query = new URLSearchParams({ guest: guest.name, code: guest.inviteCode });
  return `${base}?${query.toString()}`;
}

/** "16:30:00" -> "16:30" */
const toHourMinute = (time: string | null) => (time ? time.slice(0, 5) : null);

export function toPhotoDto(row: PhotoRow) {
  return {
    id: row.id,
    category: row.category,
    url: row.url,
    width: row.width,
    height: row.height,
    sortOrder: row.sort_order,
  };
}

export function groupPhotos(rows: PhotoRow[]) {
  const pick = (category: PhotoRow['category']) => {
    const row = rows.find((photo) => photo.category === category);
    return row ? toPhotoDto(row) : null;
  };
  return {
    cover: pick('cover'),
    groom: pick('groom'),
    bride: pick('bride'),
    gallery: rows.filter((photo) => photo.category === 'gallery').map(toPhotoDto),
  };
}

function templateOf(row: InvitationRow) {
  return { id: row.template_id, code: row.template_code, name: row.template_name };
}

/** The fields the step form edits (shared by customer, staff and public views). */
function contentOf(row: InvitationRow) {
  return {
    groomName: row.groom_name,
    brideName: row.bride_name,
    groomPhone: row.groom_phone,
    bridePhone: row.bride_phone,
    groomParents: row.groom_parents,
    brideParents: row.bride_parents,
    weddingDate: row.wedding_date,
    weddingTime: toHourMinute(row.wedding_time),
    rsvpDeadline: row.rsvp_deadline,
    venueName: row.venue_name,
    venueAddress: row.venue_address,
    mapUrl: row.map_url,
    greetingMessage: row.greeting_message,
    eventsSchedule: parseJsonColumn<EventScheduleItem[]>(row.events_schedule, []),
    extraDetails: parseJsonColumn<Record<string, unknown>>(row.extra_details, {}),
  };
}

function customerOf(row: InvitationRow) {
  return {
    id: row.customer_id,
    firstName: row.customer_first_name,
    lastName: row.customer_last_name,
    fullName: `${row.customer_first_name} ${row.customer_last_name}`,
    email: row.customer_email,
    phone: row.customer_phone,
  };
}

export function toInvitationSummaryDto(row: InvitationRow) {
  return {
    id: row.id,
    referenceNo: row.reference_no,
    status: row.status,
    currentStep: row.current_step,
    template: templateOf(row),
    groomName: row.groom_name,
    brideName: row.bride_name,
    weddingDate: row.wedding_date,
    slug: row.slug,
    inviteUrl: row.slug && row.status === 'paid' ? buildInviteUrl(row.slug) : null,
    submittedAt: row.submitted_at,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** What the customer sees for their own invitation. */
export function toInvitationDto(row: InvitationRow, photos: PhotoRow[]) {
  return {
    ...toInvitationSummaryDto(row),
    ...contentOf(row),
    photos: groupPhotos(photos),
    payment: { amount: row.payment_amount, reference: row.payment_reference },
  };
}

export function toAdminInvitationListDto(row: InvitationRow) {
  return {
    ...toInvitationSummaryDto(row),
    customer: customerOf(row),
    paymentAmount: row.payment_amount,
  };
}

export function toHistoryDto(row: StatusHistoryRow) {
  return {
    id: row.id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: { type: row.changed_by_type, id: row.changed_by_id, name: row.changed_by_name },
    note: row.note,
    createdAt: row.created_at,
  };
}

/** What the sales team sees: everything, plus the customer and internal fields. */
export function toAdminInvitationDto(row: InvitationRow, photos: PhotoRow[]) {
  return {
    ...toInvitationDto(row, photos),
    customer: customerOf(row),
    payment: {
      amount: row.payment_amount,
      reference: row.payment_reference,
      markedBy: row.paid_marked_by
        ? { id: row.paid_marked_by, name: row.paid_marked_by_name }
        : null,
    },
    staffNotes: row.staff_notes,
  };
}

/** What the public invitation page receives — no customer, payment or internal data. */
export function toPublicInvitationDto(row: InvitationRow, photos: PhotoRow[]) {
  return {
    slug: row.slug,
    template: { code: row.template_code, name: row.template_name },
    ...contentOf(row),
    photos: groupPhotos(photos),
  };
}
