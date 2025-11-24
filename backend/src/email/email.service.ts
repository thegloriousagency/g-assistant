import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  buildHostingInfoEmail,
  HostingInfoEmailContent,
} from './templates/hosting-info-email.template';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface AdminTicketNotificationInput {
  to: string;
  tenantName: string;
  ticketTitle: string;
  ticketId: string;
  action: 'new-ticket' | 'client-reply';
}

interface ClientTicketNotificationInput {
  to: string;
  ticketTitle: string;
  ticketId: string;
  action: 'admin-reply' | 'status-update';
  statusLabel?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey = process.env.EMAILIT_API_KEY;
  private readonly from =
    process.env.EMAIL_FROM ?? 'The Glorious Agency <no-reply@theglorious.agency>';
  private readonly appUrl: string;
  private readonly endpoint = 'https://api.emailit.com/v1/emails';

  constructor() {
    this.appUrl = this.resolveAppUrl();
  }

  async sendWelcomeSetPasswordEmail(email: string, token: string) {
    const link = `${this.appUrl}/set-password?token=${encodeURIComponent(token)}`;
    const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5; margin: 0; padding: 24px; background-color:#f8f8f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;">
      <tr>
        <td style="padding:24px;">
          <h2 style="margin-top:0;">Your Glorious Agency dashboard is ready</h2>
          <p>Use your email <strong>${email}</strong> and the button below to set your password and sign in securely.</p>
          <p style="margin:20px 0;">
            <a href="${link}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Create password</a>
          </p>
          <p style="font-size:13px;color:#555;">This secure link lets you create your login credentials.</p>
          <p style="margin-top:24px;">Inside the dashboard you can review hosting details*, track website analytics, see monthly maintenance activity*, request updates, and manage support conversations in one place.</p>
          <p>If you need any help, just reply to this email or message us from within the dashboard.</p>
          <p style="margin-top:24px;">— The Glorious Agency Support Team</p>
          <p style="font-size:12px;color:#555;margin-top:16px;">
            *Feature availability depends on your active hosting or maintenance subscription with The Glorious Agency.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = [
      'Your Glorious Agency dashboard is ready.',
      `Set your password here: ${link}`,
      '',
      'From the dashboard you can:',
      '- Review hosting details*, analytics, and maintenance activity*.',
      '- Request updates or submit support messages in one place.',
      '',
      'Need help? Reply to this email or reach us through the dashboard.',
      '',
      '— The Glorious Agency Support Team',
      '',
      '*Feature availability depends on your active hosting or maintenance subscription.',
    ].join('\n');

    return this.sendEmail({
      to: email,
      subject: 'Your Glorious Agency dashboard access',
      html,
      text,
    });
  }

  private resolveAppUrl() {
    const frontendEnv = process.env.FRONTEND_URL?.split(',')
      .map((value) => value.trim())
      .find((value) => value.length > 0);
    const raw = process.env.APP_URL?.trim() ?? frontendEnv ?? 'http://localhost:3000';
    return raw.replace(/\/$/, '');
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const link = `${this.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
    return this.sendEmail({
      to: email,
      subject: 'Reset your password',
      html: this.wrapHtml(
        'Password reset requested',
        'Use the link below to reset your password.',
        link,
        'Reset password',
      ),
      text: this.textTemplate('Password reset requested', `Reset your password: ${link}`),
    });
  }

  async sendPasswordChangedNotice(email: string) {
    return this.sendEmail({
      to: email,
      subject: 'Your password was changed',
      html: this.simpleHtml(
        'Password updated',
        'This is a confirmation that your password was changed. If this was not you, reset it immediately.',
      ),
      text: this.textTemplate(
        'Password updated',
        'If this was not you, please reset it immediately.',
      ),
    });
  }

  async sendPendingEmailVerification(email: string, token: string) {
    const link = `${this.appUrl}/confirm-email-change?token=${encodeURIComponent(token)}`;
    return this.sendEmail({
      to: email,
      subject: 'Confirm your new email',
      html: this.wrapHtml(
        'Confirm your email address',
        'Click below to verify your new email.',
        link,
        'Confirm email',
      ),
      text: this.textTemplate(
        'Confirm your email',
        `Verify your new email here: ${link}`,
      ),
    });
  }

  async sendHostingInfoEmail(to: string, content: HostingInfoEmailContent) {
    const template = buildHostingInfoEmail(content);
    return this.sendEmail({
      to,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });
  }

  async sendAdminTicketNotification(input: AdminTicketNotificationInput) {
    const link = `${this.appUrl}/admin/tickets/${input.ticketId}`;
    const subject =
      input.action === 'new-ticket'
        ? `New support ticket from ${input.tenantName}`
        : `New reply on: ${input.ticketTitle}`;
    const description =
      input.action === 'new-ticket'
        ? `${input.tenantName} just opened a new support ticket.`
        : `${input.tenantName} posted a new reply on the ticket below.`;

    return this.sendEmail({
      to: input.to,
      subject,
      html: this.ticketNotificationHtml(
        subject,
        description,
        input.ticketTitle,
        link,
        'Open ticket',
      ),
      text: this.ticketNotificationText(subject, description, input.ticketTitle, link),
    });
  }

  async sendClientTicketNotification(input: ClientTicketNotificationInput) {
    const link = `${this.appUrl}/dashboard/maintenance/tickets/${input.ticketId}`;
    const subject =
      input.action === 'admin-reply'
        ? 'New reply from The Glorious Agency'
        : 'Update on your support request';
    const description =
      input.action === 'admin-reply'
        ? 'Our team just replied to your support ticket.'
        : `Your ticket status changed to ${input.statusLabel ?? 'a new state'}.`;

    return this.sendEmail({
      to: input.to,
      subject,
      html: this.ticketNotificationHtml(
        subject,
        description,
        input.ticketTitle,
        link,
        'View ticket',
      ),
      text: this.ticketNotificationText(subject, description, input.ticketTitle, link),
    });
  }

  private async sendEmail(payload: EmailPayload) {
    if (!this.apiKey) {
      this.logger.warn('EMAILIT_API_KEY is not configured; skipping email send.');
      return false;
    }

    try {
      await axios.post(
        this.endpoint,
        {
          from: this.from,
          to: payload.to,
          subject: payload.subject,
          html: payload.html,
          text: payload.text,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to send email via Emailit', err?.stack);
      return false;
    }
  }

  private wrapHtml(title: string, message: string, link: string, cta: string) {
    return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <h2>${title}</h2>
    <p>${message}</p>
    <p>
      <a href="${link}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
        ${cta}
      </a>
    </p>
    <p style="font-size:12px;color:#555;">If the button doesn’t work, copy and paste this link into your browser:<br />${link}</p>
  </body>
</html>`;
  }

  private simpleHtml(title: string, message: string) {
    return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <h2>${title}</h2>
    <p>${message}</p>
  </body>
</html>`;
  }

  private textTemplate(title: string, message: string) {
    return `${title}\n\n${message}\n\n— The Glorious Agency`;
  }

  private ticketNotificationHtml(
    heading: string,
    message: string,
    ticketTitle: string,
    link: string,
    cta: string,
  ) {
    return `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111;">
    <h2>${heading}</h2>
    <p>${message}</p>
    <p style="font-weight:bold;">Ticket:</p>
    <p style="margin-top:0;">${ticketTitle}</p>
    <p>
      <a href="${link}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
        ${cta}
      </a>
    </p>
    <p style="font-size:12px;color:#555;">If the button doesn’t work, copy and paste this link into your browser:<br />${link}</p>
  </body>
</html>`;
  }

  private ticketNotificationText(
    heading: string,
    message: string,
    ticketTitle: string,
    link: string,
  ) {
    return `${heading}

${message}

Ticket: ${ticketTitle}
Open ticket: ${link}

— The Glorious Agency Support Team`;
  }
}
