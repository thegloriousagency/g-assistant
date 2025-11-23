import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { Ga4Service } from './ga4.service';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string | null;
  };
}

@UseGuards(JwtAuthGuard)
@Controller('ga4')
export class Ga4ClientController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ga4Service: Ga4Service,
  ) {}

  @Get('summary')
  async getSummary(@Req() req: AuthenticatedRequest, @Query('range') range?: string) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new NotFoundException('Tenant not found');
    }

    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return this.ga4Service.getSummaryForTenant(
      tenantId,
      tenant.ga4PropertyId ?? null,
      range,
    );
  }
}
