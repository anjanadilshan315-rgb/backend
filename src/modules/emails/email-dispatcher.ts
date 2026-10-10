import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { sendMail } from '../../config/mailer.js';
import { guestRepository } from '../guests/guest.repository.js';
import type { GuestRow } from '../guests/guest.repository.js';
import { buildInviteUrl } from '../invitations/invitation.mapper.js';
import { invitationRepository } from '../invitations/invitation.repository.js';
import type { InvitationRow } from '../invitations/invitation.repository.js';
import { photoRepository } from '../invitations/photo.repository.js';
import { emailBatchRepository } from './email-batch.repository.js';
import { renderInvitationEmail } from './templates/invitation-email.js';

const CHUNK_SIZE = 50;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
) {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++] as T;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * Sends e-mail batches in the background, inside the API process.
 *
 * Progress lives in the database (guests.email_status), so a batch that was
 * interrupted by a restart is picked up again by resumeUnfinished() on boot.
 * For very high volumes this class is the seam to swap for a real queue
 * (BullMQ / SQS) without touching the routes.
 */
class EmailDispatcher {
  private readonly running = new Set<number>();
  private stopping = false;

  enqueue(batchId: number): void {
    if (this.stopping || this.running.has(batchId)) return;
    this.running.add(batchId);
    setImmediate(() => {
      this.process(batchId)
        .catch((err: unknown) => logger.error({ err, batchId }, 'E-mail batch failed'))
        .finally(() => this.running.delete(batchId));
    });
  }

  async resumeUnfinished(): Promise<void> {
    const batches = await emailBatchRepository.findUnfinished();
    if (batches.length > 0)
      logger.info({ count: batches.length }, 'Resuming unfinished e-mail batches');
    for (const batch of batches) this.enqueue(batch.id);
  }

  /** Stops picking up new chunks; the batch resumes on the next start. */
  stop(): void {
    this.stopping = true;
  }

  private async process(batchId: number): Promise<void> {
    const batch = await emailBatchRepository.findById(batchId);
    if (!batch || batch.status === 'completed' || batch.status === 'completed_with_errors') return;

    const invitation = await invitationRepository.findById(batch.invitation_id);
    if (!invitation || !invitation.slug) {
      logger.warn({ batchId }, 'Invitation missing or has no link — closing batch');
      await emailBatchRepository.complete(batchId);
      return;
    }
    const cover = (await photoRepository.listByCategory(invitation.id, 'cover'))[0];

    await emailBatchRepository.markProcessing(batchId);
    logger.info({ batchId, invitationId: invitation.id }, 'Sending e-mail batch');

    while (!this.stopping) {
      const guests = await guestRepository.listQueuedForBatch(batchId, CHUNK_SIZE);
      if (guests.length === 0) break;
      await runWithConcurrency(guests, env.EMAIL_SEND_CONCURRENCY, (guest) =>
        this.sendToGuest(invitation, cover?.url ?? null, guest),
      );
      await emailBatchRepository.refreshCounts(batchId);
    }

    if (this.stopping) return;
    await emailBatchRepository.refreshCounts(batchId);
    await emailBatchRepository.complete(batchId);
    logger.info({ batchId }, 'E-mail batch finished');
  }

  private async sendToGuest(
    invitation: InvitationRow,
    coverImageUrl: string | null,
    guest: GuestRow,
  ) {
    if (!guest.email) {
      await guestRepository.markFailed(guest.id, 'Guest has no e-mail address');
      return;
    }
    try {
      await sendMail(
        renderInvitationEmail({
          to: guest.email,
          guestName: guest.name,
          groomName: invitation.groom_name ?? '',
          brideName: invitation.bride_name ?? '',
          weddingDate: invitation.wedding_date,
          weddingTime: invitation.wedding_time,
          venueName: invitation.venue_name,
          venueAddress: invitation.venue_address,
          greetingMessage: invitation.greeting_message,
          coverImageUrl,
          inviteUrl: buildInviteUrl(invitation.slug!, {
            name: guest.name,
            inviteCode: guest.invite_code,
          }),
        }),
      );
      await guestRepository.markSent(guest.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ guestId: guest.id, err: message }, 'Invitation e-mail failed');
      await guestRepository.markFailed(guest.id, message);
    }
  }
}

export const emailDispatcher = new EmailDispatcher();
