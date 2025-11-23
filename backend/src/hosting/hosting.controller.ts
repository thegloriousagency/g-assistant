import { BadRequestException, Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from '../tenants/tenants.service';
import { WhmService } from './whm.service';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string | null;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('hosting')
export class HostingController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly whmService: WhmService,
  ) {}

  @Get('cpanel-session')
  async getCpanelSession(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with this account.');
    }

    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant?.hostingCpanelUsername) {
      throw new BadRequestException(
        'Your hosting account isn’t connected yet. Please contact support.',
      );
    }

    const url = await this.whmService.createCpanelSession(tenant.hostingCpanelUsername);
    return { url };
  }

  @Get('account-summary')
  async getAccountSummary(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with this account.');
    }

    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant?.hostingCpanelUsername) {
      throw new BadRequestException(
        'Your hosting account isn’t connected yet. Please contact support.',
      );
    }

    return this.whmService.fetchAccountSummary(tenant.hostingCpanelUsername);
  }
}
