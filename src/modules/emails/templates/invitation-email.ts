import type { MailMessage } from '../../../config/mailer.js';
import { escapeHtml } from '../../../common/utils/strings.js';
import { button, emailLayout, formatLongDate, formatTime } from './layout.js';

export interface InvitationEmailData {
  to: string;
  guestName: string;
  groomName: string;
  brideName: string;
  weddingDate: string | null;
  weddingTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
  greetingMessage: string | null;
  coverImageUrl: string | null;
  inviteUrl: string;
}

export function renderInvitationEmail(data: InvitationEmailData): MailMessage {
  const couple = `${data.groomName} & ${data.brideName}`;
  const date = formatLongDate(data.weddingDate);
  const time = formatTime(data.weddingTime);
  const venue = [data.venueName, data.venueAddress].filter(Boolean).join(', ');
  const e = escapeHtml;

  const details = [
    date &&
      `<p style="margin:0 0 6px;font-size:17px;">${e(date)}${time ? ` &middot; ${e(time)}` : ''}</p>`,
    venue && `<p style="margin:0;font-size:15px;color:#6b5d48;">${e(venue)}</p>`,
  ]
    .filter(Boolean)
    .join('');

  const body = `
    ${data.coverImageUrl ? `<tr><td><img src="${e(data.coverImageUrl)}" alt="${e(couple)}" width="560" style="display:block;width:100%;height:auto;border:0;"></td></tr>` : ''}
    <tr><td style="padding:36px 32px 12px;text-align:center;">
      <p style="margin:0 0 18px;font-size:15px;">Dear ${e(data.guestName)},</p>
      <p style="margin:0 0 8px;font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#b08d57;font-family:Arial,sans-serif;">You are invited to the wedding of</p>
      <h1 style="margin:0 0 20px;font-size:32px;font-weight:normal;">${e(couple)}</h1>
      ${data.greetingMessage ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;font-style:italic;">${e(data.greetingMessage)}</p>` : ''}
      ${details}
    </td></tr>
    <tr><td style="padding:24px 32px 40px;text-align:center;">
      ${button(data.inviteUrl, 'View your invitation')}
      <p style="margin:18px 0 0;font-size:12px;color:#8a7c66;font-family:Arial,sans-serif;">Please open the invitation to RSVP and leave your wishes.</p>
    </td></tr>`;

  const text = [
    `Dear ${data.guestName},`,
    '',
    `You are invited to the wedding of ${couple}.`,
    data.greetingMessage ?? '',
    date ? `Date: ${date}${time ? ` at ${time}` : ''}` : '',
    venue ? `Venue: ${venue}` : '',
    '',
    `View your invitation and RSVP: ${data.inviteUrl}`,
  ]
    .filter((line, index, lines) => line !== '' || lines[index - 1] !== '')
    .join('\n');

  return {
    to: data.to,
    subject: `Wedding invitation: ${couple}`,
    html: emailLayout({ preheader: `${couple} invite you to their wedding`, body }),
    text,
  };
}
