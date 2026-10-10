import { withTransaction } from '../../config/database.js';
import { AppError } from '../../common/errors/app-error.js';
import { guestRepository } from '../guests/guest.repository.js';
import type { RecipientMode } from '../guests/guest.repository.js';
import type { InvitationRow } from '../invitations/invitation.repository.js';
import { toEmailBatchDto } from './email-batch.mapper.js';
import { emailBatchRepository } from './email-batch.repository.js';
import { emailDispatcher } from './email-dispatcher.js';

export const emailService = {
  /**
   * Creates a batch, flags its recipients as queued and hands it to the
   * dispatcher. Returns immediately (202); progress is polled via the batch.
   *   mode "unsent"   – guests never e-mailed, or whose last e-mail failed
   *   mode "all"      – every guest with an e-mail (re-send)
   *   mode "selected" – only guestIds
   */
  async queueInvitations(
    invitation: InvitationRow,
    requestedBy: { type: 'customer' | 'staff'; id: number },
    options: { mode: RecipientMode; guestIds?: number[] },
  ) {
    if (invitation.status !== 'paid' || !invitation.slug) {
      throw AppError.conflict(
        'Invitations can be sent after the payment is confirmed',
        'PAYMENT_REQUIRED',
      );
    }
    const active = await emailBatchRepository.findActiveForInvitation(invitation.id);
    if (active) {
      throw AppError.conflict(
        'Invitations are already being sent. Please wait until it finishes.',
        'BATCH_IN_PROGRESS',
      );
    }

    const batchId = await withTransaction(async (conn) => {
      const id = await emailBatchRepository.create(invitation.id, requestedBy, conn);
      const queued = await guestRepository.queueForBatch(
        invitation.id,
        id,
        options.mode,
        options.guestIds,
        conn,
      );
      if (queued === 0) {
        throw AppError.badRequest(
          'There are no guests with an e-mail address to send to',
          'NO_RECIPIENTS',
        );
      }
      await emailBatchRepository.setTotal(id, queued, conn);
      return id;
    });

    emailDispatcher.enqueue(batchId);
    return toEmailBatchDto((await emailBatchRepository.findById(batchId))!);
  },

  async listBatches(invitationId: number) {
    return (await emailBatchRepository.listForInvitation(invitationId)).map(toEmailBatchDto);
  },

  async getBatch(invitationId: number, batchId: number) {
    const batch = await emailBatchRepository.findForInvitation(invitationId, batchId);
    if (!batch) throw AppError.notFound('E-mail batch not found');
    return toEmailBatchDto(batch);
  },
};
