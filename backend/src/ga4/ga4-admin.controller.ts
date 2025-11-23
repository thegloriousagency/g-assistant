import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Ga4Service } from './ga4.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('ga4/admin')
export class Ga4AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ga4Service: Ga4Service,
  ) {}

  @Get('tenants/:tenantId/test')
  async testTenant(@Param('tenantId') tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    console.log(
      '[GA4 TEST] tenantId=',
      tenant?.id,
      'ga4PropertyId=',
      tenant?.ga4PropertyId,
    );
    console.log(
      '[GA4 TEST] GOOGLE_APPLICATION_CREDENTIALS=',
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
    );

    if (!tenant.ga4PropertyId) {
      throw new BadRequestException('No GA4 property is configured for this tenant.');
    }

    const result = await this.ga4Service.pingProperty(tenant.ga4PropertyId);

    if (result.ok) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ga4ConnectedAt: new Date(),
          ga4LastSyncStatus: 'ok',
        },
      });
      return {
        ok: true,
        status: 'ok',
        message: 'Analytics connection successful.',
        sample: {
          users: result.users,
          sessions: result.sessions,
        },
      };
    }

    const status = this.mapStatus(result.error);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ga4LastSyncStatus: status,
      },
    });

    return {
      ok: false,
      status,
      message: result.error,
    };
  }

  private mapStatus(message?: string) {
    if (!message) return 'error: unknown';
    if (message.includes('Permission denied')) return 'error: permission_denied';
    if (message.includes('not configured')) return 'error: not_configured';
    if (message.includes('not found')) return 'error: property_not_found';
    return 'error: unknown';
  }
}
