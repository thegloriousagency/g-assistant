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
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  private readonly endpoint = 'https://api.emailit.com/v1/emails';

  async sendWelcomeSetPasswordEmail(email: string, token: string) {
    const link = `${this.appUrl}/set-password?token=${encodeURIComponent(token)}`;
    return this.sendEmail({
      to: email,
      subject: 'Welcome! Set your password',
      html: this.wrapHtml(
        'Welcome!',
        `Set your password to access your dashboard.`,
        link,
        'Set password',
      ),
      text: this.textTemplate(
        'Welcome to the Glorious Dashboard!',
        `Set your password to log in: ${link}`,
      ),
    });
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
