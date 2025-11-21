import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { MaintenanceService } from './maintenance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateMaintenanceCycleDto } from './dto/update-maintenance-cycle.dto';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { CreateMaintenanceEntryDto } from './dto/create-maintenance-entry.dto';
import { CreateMaintenanceFeatureDto } from './dto/create-maintenance-feature.dto';
import { SetTenantFeaturesDto } from './dto/set-tenant-features.dto';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string | null;
  };
}

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/current')
  getCurrentCycleForTenant(@Param('tenantId') tenantId: string) {
    return this.maintenanceService.getOrCreateCurrentCycleForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/tenants/:tenantId/current')
  updateCurrentCycleForTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: UpdateMaintenanceCycleDto,
  ) {
    return this.maintenanceService.updateCurrentCycleForTenant(tenantId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  async getCurrentCycleForCurrentTenant(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with user');
    }

    const cycle =
      await this.maintenanceService.getOrCreateCurrentCycleForTenant(tenantId);

    const totalAvailable = cycle.baseHours + cycle.carriedHours;
    const remaining = totalAvailable - cycle.usedHours;

    return {
      month: cycle.month,
      baseHours: cycle.baseHours,
      carriedHours: cycle.carriedHours,
      usedHours: cycle.usedHours,
      totalAvailable,
      remaining,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('entries')
  async getEntriesForCurrentTenant(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with user');
    }

    return this.maintenanceService.listEntriesForTenantWithMonth(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('features')
  async getFeaturesForCurrentTenant(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with user');
    }
    return this.maintenanceService.listFeaturesForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/features')
  listActiveFeatures() {
    return this.maintenanceService.listAllActiveFeatures();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/features')
  createFeature(@Body() body: CreateMaintenanceFeatureDto) {
    return this.maintenanceService.createFeature(body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/features')
  getTenantFeatures(@Param('tenantId') tenantId: string) {
    return this.maintenanceService.getTenantFeatureSelection(tenantId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('admin/tenants/:tenantId/features')
  setTenantFeatures(
    @Param('tenantId') tenantId: string,
    @Body() body: SetTenantFeaturesDto,
  ) {
    return this.maintenanceService.assignFeaturesToTenant(
      tenantId,
      body.featureIds ?? [],
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/tenants/:tenantId/features')
  createFeatureForTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateMaintenanceFeatureDto,
  ) {
    return this.maintenanceService.createFeatureAndAssign(tenantId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/tenants/:tenantId/tasks')
  createTaskForTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateMaintenanceTaskDto,
  ) {
    return this.maintenanceService.createTaskForTenant(tenantId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/tasks')
  listTasksForTenant(@Param('tenantId') tenantId: string) {
    return this.maintenanceService.listTasksForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/tenants/:tenantId/entries')
  createEntryForTenant(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateMaintenanceEntryDto,
  ) {
    return this.maintenanceService.createTimeEntryForTenant(tenantId, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/entries')
  listEntriesForTenant(@Param('tenantId') tenantId: string) {
    return this.maintenanceService.listEntriesForCurrentCycle(tenantId);
  }
}
