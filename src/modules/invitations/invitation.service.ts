import { withTransaction } from '../../config/database.js';
import { logger } from '../../config/logger.js';
import {
  CUSTOMER_EDITABLE_STATUSES,
  STAFF_STATUS_TRANSITIONS,
} from '../../common/constants/statuses.js';
import { AppError } from '../../common/errors/app-error.js';
import type { AuthStaff } from '../../common/types/auth.js';
import { toJsonColumn } from '../../common/utils/json.js';
import { buildPaginationMeta, toLimitOffset } from '../../common/utils/pagination.js';
import { randomSlugSuffix, slugify } from '../../common/utils/strings.js';
import { emailBatchRepository } from '../emails/email-batch.repository.js';
import { toEmailBatchDto } from '../emails/email-batch.mapper.js';
import { notificationService } from '../emails/notification.service.js';
import { guestRepository } from '../guests/guest.repository.js';
import { templateService } from '../templates/template.service.js';
import {
  toAdminInvitationDto,
  toAdminInvitationListDto,
  toHistoryDto,
  toInvitationDto,
  toInvitationSummaryDto,
  toPublicInvitationDto,
} from './invitation.mapper.js';
import { invitationRepository } from './invitation.repository.js';
import type { InvitationContentColumns, InvitationRow } from './invitation.repository.js';
import type {
  AdminListInvitationsQuery,
  AdminUpdateInvitationInput,
  CreateInvitationInput,
  InvitationContentInput,
  UpdateStatusInput,
} from './invitation.validation.js';
import { photoRepository } from './photo.repository.js';
import { photoService } from './photo.service.js';

const REQUIRED_FOR_SUBMIT: { column: keyof InvitationRow; field: string; label: string }[] = [
  { column: 'groom_name', field: 'groomName', label: 'Groom name' },
  { column: 'bride_name', field: 'brideName', label: 'Bride name' },
  { column: 'wedding_date', field: 'weddingDate', label: 'Wedding date' },
  { column: 'venue_name', field: 'venueName', label: 'Venue name' },
];

function toContentColumns(
  input: InvitationContentInput & { staffNotes?: string | null },
): InvitationContentColumns {
  return {
    template_id: input.templateId,
    current_step: input.currentStep,
    groom_name: input.groomName,
    bride_name: input.brideName,
    groom_phone: input.groomPhone,
    bride_phone: input.bridePhone,
    groom_parents: input.groomParents,
    bride_parents: input.brideParents,
    wedding_date: input.weddingDate,
    wedding_time: input.weddingTime,
    rsvp_deadline: input.rsvpDeadline,
    venue_name: input.venueName,
    venue_address: input.venueAddress,
    map_url: input.mapUrl,
    greeting_message: input.greetingMessage,
    events_schedule:
      input.eventsSchedule === undefined ? undefined : toJsonColumn(input.eventsSchedule),
    extra_details: input.extraDetails === undefined ? undefined : toJsonColumn(input.extraDetails),
    staff_notes: input.staffNotes,
  };
}

/** "kaveen-ishara", or "kaveen-ishara-k7m2" when taken. */
async function generateUniqueSlug(groomName: string, brideName: string): Promise<string> {
  const base = slugify(`${groomName}-${brideName}`);
  // "demo-*" slugs are reserved for the static template previews on the website.
  const reserved = base.startsWith('demo');
  if (!reserved && !(await invitationRepository.slugExists(base))) return base;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = `${base}-${randomSlugSuffix()}`;
    if (!(await invitationRepository.slugExists(candidate))) return candidate;
  }
  throw new AppError(500, 'Could not generate a unique invitation link', 'SLUG_GENERATION_FAILED');
}

async function getOwnedOrThrow(customerId: number, invitationId: number): Promise<InvitationRow> {
  const row = await invitationRepository.findByIdForCustomer(invitationId, customerId);
  if (!row) throw AppError.notFound('Invitation not found');
  return row;
}

async function getOrThrow(invitationId: number): Promise<InvitationRow> {
  const row = await invitationRepository.findById(invitationId);
  if (!row) throw AppError.notFound('Invitation not found');
  return row;
}

function assertCustomerCanEdit(row: InvitationRow): void {
  if (!CUSTOMER_EDITABLE_STATUSES.includes(row.status)) {
    throw AppError.conflict(
      `This invitation is ${row.status} and can no longer be edited. Please contact us for changes.`,
      'INVITATION_LOCKED',
    );
  }
}

async function customerView(row: InvitationRow) {
  return toInvitationDto(row, await photoRepository.listForInvitation(row.id));
}

export const invitationService = {
  // ---- Customer ---------------------------------------------------------------

  async listForCustomer(customerId: number) {
    return (await invitationRepository.listForCustomer(customerId)).map(toInvitationSummaryDto);
  },

  /** Step 1 of the form: the customer picks a template (and may send more fields). */
  async create(customerId: number, input: CreateInvitationInput) {
    await templateService.assertSelectable(input.templateId);
    const id = await invitationRepository.create(customerId, input.templateId);
    await invitationRepository.updateContent(
      id,
      toContentColumns({ ...input, templateId: undefined }),
    );
    return customerView(await getOrThrow(id));
  },

  async getForCustomer(customerId: number, invitationId: number) {
    const row = await getOwnedOrThrow(customerId, invitationId);
    const [view, guestStats] = await Promise.all([
      customerView(row),
      guestRepository.stats(row.id),
    ]);
    return { ...view, guestStats };
  },

  /** Saves any subset of step-form fields. */
  async updateForCustomer(customerId: number, invitationId: number, input: InvitationContentInput) {
    const row = await getOwnedOrThrow(customerId, invitationId);
    assertCustomerCanEdit(row);
    if (input.templateId && input.templateId !== row.template_id) {
      await templateService.assertSelectable(input.templateId);
    }
    await invitationRepository.updateContent(invitationId, toContentColumns(input));
    return customerView(await getOrThrow(invitationId));
  },

  /** Final step: draft -> pending. The submission now shows up for the sales team. */
  async submit(customerId: number, invitationId: number) {
    const row = await getOwnedOrThrow(customerId, invitationId);
    if (row.status !== 'draft') {
      throw AppError.conflict('This invitation has already been submitted', 'ALREADY_SUBMITTED');
    }

    const missing = REQUIRED_FOR_SUBMIT.filter(({ column }) => !row[column]);
    if (missing.length > 0) {
      throw AppError.validation(
        missing.map(({ field, label }) => ({
          location: 'body',
          field,
          message: `${label} is required`,
        })),
        'Please complete the required fields before submitting',
      );
    }

    const slug = row.slug ?? (await generateUniqueSlug(row.groom_name ?? '', row.bride_name ?? ''));
    await withTransaction(async (conn) => {
      await invitationRepository.updateStatus(
        invitationId,
        { status: 'pending', submitted_at: new Date(), slug },
        conn,
      );
      await invitationRepository.addHistory(
        {
          invitationId,
          fromStatus: 'draft',
          toStatus: 'pending',
          changedByType: 'customer',
          changedById: customerId,
          note: 'Submitted by customer',
        },
        conn,
      );
    });
    return customerView(await getOrThrow(invitationId));
  },

  /** Customers can only delete drafts. */
  async deleteForCustomer(customerId: number, invitationId: number) {
    const row = await getOwnedOrThrow(customerId, invitationId);
    if (row.status !== 'draft') {
      throw AppError.conflict('Only draft invitations can be deleted', 'INVITATION_LOCKED');
    }
    await this.deleteWithPhotos(invitationId);
  },

  /** Used by the photo routes to check ownership + editability before uploading. */
  async assertCustomerCanEditPhotos(customerId: number, invitationId: number): Promise<void> {
    assertCustomerCanEdit(await getOwnedOrThrow(customerId, invitationId));
  },

  async assertOwnedPaid(customerId: number, invitationId: number): Promise<InvitationRow> {
    const row = await getOwnedOrThrow(customerId, invitationId);
    if (row.status !== 'paid') {
      throw AppError.conflict(
        'Guest invitations can be sent after your payment has been confirmed',
        'PAYMENT_REQUIRED',
      );
    }
    return row;
  },

  getOwnedOrThrow,

  // ---- Sales team -------------------------------------------------------------

  async assertExists(invitationId: number): Promise<void> {
    await getOrThrow(invitationId);
  },

  async adminList(query: AdminListInvitationsQuery) {
    const [limit, offset] = toLimitOffset(query);
    const { rows, total } = await invitationRepository.list({
      status: query.status,
      includeDrafts: query.includeDrafts,
      search: query.search,
      templateId: query.templateId,
      customerId: query.customerId,
      submittedFrom: query.submittedFrom,
      submittedTo: query.submittedTo,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      limit,
      offset,
    });
    return { items: rows.map(toAdminInvitationListDto), meta: buildPaginationMeta(query, total) };
  },

  async adminGet(invitationId: number) {
    const row = await getOrThrow(invitationId);
    const [photos, history, guestStats, batches] = await Promise.all([
      photoRepository.listForInvitation(invitationId),
      invitationRepository.listHistory(invitationId),
      guestRepository.stats(invitationId),
      emailBatchRepository.listForInvitation(invitationId, 10),
    ]);
    return {
      ...toAdminInvitationDto(row, photos),
      statusHistory: history.map(toHistoryDto),
      guestStats,
      emailBatches: batches.map(toEmailBatchDto),
    };
  },

  async adminUpdate(invitationId: number, input: AdminUpdateInvitationInput) {
    const row = await getOrThrow(invitationId);
    if (input.templateId && input.templateId !== row.template_id) {
      await templateService.assertSelectable(input.templateId);
    }
    await invitationRepository.updateContent(invitationId, toContentColumns(input));
    return this.adminGet(invitationId);
  },

  /** pending -> paid is the main flow; cancel and undo are also supported. */
  async changeStatus(invitationId: number, input: UpdateStatusInput, staff: AuthStaff) {
    const row = await getOrThrow(invitationId);
    if (row.status === input.status) {
      throw AppError.conflict(`Invitation is already ${input.status}`, 'STATUS_UNCHANGED');
    }
    if (!STAFF_STATUS_TRANSITIONS[row.status].includes(input.status)) {
      throw AppError.conflict(
        `Cannot change status from ${row.status} to ${input.status}`,
        'INVALID_STATUS_TRANSITION',
      );
    }
    if (input.status === 'pending' && (!row.groom_name || !row.bride_name)) {
      throw AppError.conflict(
        'Couple names are required before the invitation can be pending',
        'INCOMPLETE',
      );
    }

    const needsLink = input.status === 'pending' || input.status === 'paid';
    const slug =
      row.slug ??
      (needsLink
        ? await generateUniqueSlug(row.groom_name ?? '', row.bride_name ?? '')
        : undefined);

    const paidFields =
      input.status === 'paid'
        ? {
            paid_at: new Date(),
            paid_marked_by: staff.id,
            payment_amount: input.paymentAmount ?? row.payment_amount,
            payment_reference: input.paymentReference ?? row.payment_reference,
          }
        : { paid_at: null, paid_marked_by: null };

    await withTransaction(async (conn) => {
      await invitationRepository.updateStatus(
        invitationId,
        {
          status: input.status,
          slug,
          ...(needsLink && !row.submitted_at ? { submitted_at: new Date() } : {}),
          ...paidFields,
        },
        conn,
      );
      await invitationRepository.addHistory(
        {
          invitationId,
          fromStatus: row.status,
          toStatus: input.status,
          changedByType: 'staff',
          changedById: staff.id,
          note: input.note ?? null,
        },
        conn,
      );
    });

    const updated = await getOrThrow(invitationId);
    if (input.status === 'paid') {
      notificationService.sendPaymentConfirmed(updated).catch((err: unknown) => {
        logger.error({ err, invitationId }, 'Failed to send payment confirmation e-mail');
      });
    }
    return this.adminGet(invitationId);
  },

  async adminDelete(invitationId: number) {
    await getOrThrow(invitationId);
    await this.deleteWithPhotos(invitationId);
  },

  async deleteWithPhotos(invitationId: number) {
    const publicIds = await photoService.publicIdsForInvitation(invitationId);
    await invitationRepository.delete(invitationId);
    photoService.destroyRemoteInBackground(publicIds);
  },

  // ---- Public invitation page ----------------------------------------------------

  /** Only paid invitations are public. `code` personalises the page for one guest. */
  async getPublic(slug: string, inviteCode?: string) {
    const row = await invitationRepository.findBySlug(slug);
    if (!row || row.status !== 'paid') throw AppError.notFound('Invitation not found');

    const [photos, guest] = await Promise.all([
      photoRepository.listForInvitation(row.id),
      inviteCode ? guestRepository.findByCode(row.id, inviteCode) : Promise.resolve(null),
    ]);
    return {
      ...toPublicInvitationDto(row, photos),
      guest: guest
        ? { name: guest.name, rsvpStatus: guest.rsvp_status, headCount: guest.head_count }
        : null,
    };
  },

  async getPublicRowOrThrow(slug: string): Promise<InvitationRow> {
    const row = await invitationRepository.findBySlug(slug);
    if (!row || row.status !== 'paid') throw AppError.notFound('Invitation not found');
    return row;
  },
};
