import { env } from '../../config/env.js';
import { sendMail } from '../../config/mailer.js';
import type { InvitationRow } from '../invitations/invitation.repository.js';
import { renderPaymentConfirmedEmail } from './templates/payment-confirmed-email.js';

/** One-off transactional e-mails to customers. */
export const notificationService = {
  async sendPaymentConfirmed(invitation: InvitationRow): Promise<void> {
    await sendMail(
      renderPaymentConfirmedEmail({
        to: invitation.customer_email,
        customerName: invitation.customer_first_name,
        referenceNo: invitation.reference_no ?? `#${invitation.id}`,
        coupleNames: `${invitation.groom_name ?? ''} & ${invitation.bride_name ?? ''}`,
        dashboardUrl: `${env.WEBSITE_URL.replace(/\/$/, '')}/dashboard`,
      }),
    );
  },
};
