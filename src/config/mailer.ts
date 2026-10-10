import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env, isProduction, isSmtpConfigured } from './env.js';
import { logger } from './logger.js';

function createTransport(): Transporter {
  if (isSmtpConfigured) {
    return nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      pool: true,
      maxConnections: env.EMAIL_SEND_CONCURRENCY,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
  }

  if (isProduction) {
    logger.warn('SMTP_HOST is not set — e-mails will NOT be delivered.');
  } else {
    logger.info('SMTP_HOST is not set — e-mails are logged instead of sent (development mode).');
  }
  // jsonTransport builds the message without sending it.
  return nodemailer.createTransport({ jsonTransport: true });
}

export const mailer = createTransport();

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  const info = await mailer.sendMail({ from: env.MAIL_FROM, ...message });
  if (!isSmtpConfigured) {
    logger.debug(
      { to: message.to, subject: message.subject, messageId: info.messageId },
      'E-mail (not sent: SMTP not configured)',
    );
  }
}

export function closeMailer(): void {
  mailer.close();
}
