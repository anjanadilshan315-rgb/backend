import type { MailMessage } from '../../../config/mailer.js';
import { escapeHtml } from '../../../common/utils/strings.js';
import { button, emailLayout } from './layout.js';

export interface PaymentConfirmedEmailData {
  to: string;
  customerName: string;
  referenceNo: string;
  coupleNames: string;
  dashboardUrl: string;
}

export function renderPaymentConfirmedEmail(data: PaymentConfirmedEmailData): MailMessage {
  const e = escapeHtml;
  const body = `
    <tr><td style="padding:36px 32px 12px;">
      <p style="margin:0 0 16px;font-size:15px;">Hi ${e(data.customerName)},</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">
        Thank you! Your payment for the invitation <strong>${e(data.coupleNames)}</strong>
        (reference <strong>${e(data.referenceNo)}</strong>) has been confirmed.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.6;">
        You can now upload your guest list from your dashboard and send the invitations by e-mail.
      </p>
    </td></tr>
    <tr><td style="padding:24px 32px 40px;text-align:center;">${button(data.dashboardUrl, 'Go to my dashboard')}</td></tr>`;

  return {
    to: data.to,
    subject: `Payment confirmed — ${data.referenceNo}`,
    html: emailLayout({ preheader: 'Your invitation is ready to send', body }),
    text: [
      `Hi ${data.customerName},`,
      '',
      `Your payment for the invitation "${data.coupleNames}" (reference ${data.referenceNo}) has been confirmed.`,
      'You can now upload your guest list and send the invitations from your dashboard:',
      data.dashboardUrl,
    ].join('\n'),
  };
}
