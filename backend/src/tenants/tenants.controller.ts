import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string | null;
  };
}

@Controller()
export class TenantsController {
  private readonly logger = new Logger(TenantsController.name);

  constructor(private readonly tenantsService: TenantsService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/tenants')
  createTenant(@Body() body: CreateTenantDto) {
    return this.tenantsService.createTenant(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants')
  findAll() {
    return this.tenantsService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findByIdWithUsersOrThrow(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/tenants/:id')
  updateTenant(@Param('id') id: string, @Body() body: UpdateTenantDto) {
    return this.tenantsService.updateTenant(id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/tenants/:id')
  deleteTenant(@Param('id') id: string) {
    return this.tenantsService.deleteTenantIfEmpty(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tenant/me')
  async currentTenant(@Req() req: AuthenticatedRequest) {
    if (!req.user?.tenantId) {
      return null;
    }

    const tenant = await this.tenantsService.findById(req.user.tenantId);
    if (!tenant) {
      return null;
    }

    this.logger.debug({
      message: 'Returning tenant info for current user',
      tenantId: tenant.id,
      maintenance: {
        planName: tenant.maintenancePlanName,
        hoursPerMonth: tenant.maintenanceHoursPerMonth,
        carryoverMode: tenant.maintenanceCarryoverMode,
        startDate: tenant.maintenanceStartDate,
        expirationDate: tenant.maintenanceExpirationDate,
        ordered: tenant.maintenanceOrdered,
      },
    });
    console.debug('[tenant/me] payload', {
      tenantId: tenant.id,
      maintenancePlanName: tenant.maintenancePlanName,
      maintenanceHoursPerMonth: tenant.maintenanceHoursPerMonth,
      maintenanceCarryoverMode: tenant.maintenanceCarryoverMode,
      maintenanceStartDate: tenant.maintenanceStartDate,
      maintenanceExpirationDate: tenant.maintenanceExpirationDate,
      maintenanceOrdered: tenant.maintenanceOrdered,
    });

    return {
      id: tenant.id,
      name: tenant.name,
      websiteUrl: tenant.websiteUrl,
      contactEmail: tenant.contactEmail,
      wpSiteUrl: tenant.wpSiteUrl,
      wpApiUser: tenant.wpApiUser,
      wpAppPassword: tenant.wpAppPassword,
      maintenancePlanName: tenant.maintenancePlanName,
      maintenanceHoursPerMonth: tenant.maintenanceHoursPerMonth,
      maintenanceCarryoverMode: tenant.maintenanceCarryoverMode,
      maintenanceStartDate: tenant.maintenanceStartDate,
      maintenanceExpirationDate: tenant.maintenanceExpirationDate,
      maintenanceOrdered: tenant.maintenanceOrdered,
      hostingExpirationDate: tenant.hostingExpirationDate,
      hostingOrdered: tenant.hostingOrdered,
    };
  }
}
