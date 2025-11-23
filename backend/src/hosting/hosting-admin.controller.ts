import {
  BadGatewayException,
  BadRequestException,
  Controller,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TenantsService } from '../tenants/tenants.service';
import { WhmService } from './whm.service';
import { EmailService } from '../email/email.service';
import { HostingInfoEmailContent } from '../email/templates/hosting-info-email.template';
import { Tenant, User } from '@prisma/client';

const DEFAULT_CPANEL_LOGIN_URL =
  process.env.CPANEL_LOGIN_URL ??
  'https://cpanel.theglorious.agency:2083/login/?login_only=1';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/tenants/:tenantId/hosting')
export class HostingAdminController {
  private readonly logger = new Logger(HostingAdminController.name);

  constructor(
    private readonly tenantsService: TenantsService,
    private readonly whmService: WhmService,
    private readonly emailService: EmailService,
  ) {}

  @Post('send-info-email')
  async sendHostingInfoEmail(@Param('tenantId') tenantId: string) {
    const tenant = await this.tenantsService.findByIdWithUsersOrThrow(tenantId);
    if (!tenant.hostingCpanelUsername) {
      throw new BadRequestException(
        'Assign a cPanel username before sending hosting info.',
      );
    }

    const recipients = this.getRecipients(tenant);
    if (recipients.length === 0) {
      throw new BadRequestException(
        'No client contact emails available. Add a contact email or client user first.',
      );
    }

    const [summary] = await Promise.all([
      this.whmService.fetchAccountSummary(tenant.hostingCpanelUsername),
    ]);
    const passwordResetUrl = this.whmService.getCpanelPasswordResetUrl();

    const emailContent: HostingInfoEmailContent = {
      tenantName: tenant.name,
      siteUrl: tenant.websiteUrl ?? null,
      planName: summary.planName,
      storageMb: summary.storageMb,
      bandwidthMb: summary.bandwidthMb,
      databases: summary.databases,
      ftpUsers: summary.ftpUsers,
      subdomains: summary.subdomains,
      emailAccounts: summary.emailAccounts,
      emailQuotaMb: summary.emailQuotaMb,
      hostingExpirationDate: tenant.hostingExpirationDate ?? null,
      cpanelLoginUrl: DEFAULT_CPANEL_LOGIN_URL,
      cpanelUsername: tenant.hostingCpanelUsername ?? undefined,
      passwordResetUrl,
    };

    for (const email of recipients) {
      const sent = await this.emailService.sendHostingInfoEmail(email, emailContent);
      if (!sent) {
        this.logger.warn(`Failed to send hosting info email to ${email}`);
        throw new BadGatewayException(
          'We could not send the hosting info email right now. Please try again shortly.',
        );
      }
    }

    return { ok: true };
  }

  private getRecipients(tenant: Tenant & { users: User[] }) {
    const recipients = new Set<string>();
    if (tenant.contactEmail) {
      recipients.add(tenant.contactEmail.trim().toLowerCase());
    }

    for (const user of tenant.users ?? []) {
      if (user.role?.toLowerCase() === 'client' && user.email) {
        recipients.add(user.email.toLowerCase());
      }
    }

    return Array.from(recipients);
  }
}
