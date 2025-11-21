import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  MaintenanceCycle,
  MaintenanceFeature,
  MaintenanceTask,
  MaintenanceTimeEntry,
} from '@prisma/client';
import { CreateMaintenanceTaskDto } from './dto/create-maintenance-task.dto';
import { CreateMaintenanceEntryDto } from './dto/create-maintenance-entry.dto';
import { CreateMaintenanceFeatureDto } from './dto/create-maintenance-feature.dto';

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  private getCurrentMonthKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private getPreviousMonthKey(current: string): string {
    const [yearStr, monthStr] = current.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const date = new Date(year, month - 2, 1);
    const prevYear = date.getFullYear();
    const prevMonth = String(date.getMonth() + 1).padStart(2, '0');
    return `${prevYear}-${prevMonth}`;
  }

  async getOrCreateCurrentCycleForTenant(tenantId: string): Promise<MaintenanceCycle> {
    const monthKey = this.getCurrentMonthKey();

    let cycle = await this.prisma.maintenanceCycle.findUnique({
      where: { tenantId_month: { tenantId, month: monthKey } },
    });

    if (!cycle) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          maintenanceHoursPerMonth: true,
          maintenanceCarryoverMode: true,
        },
      });

      const baseHours = tenant?.maintenanceHoursPerMonth ?? 0;
      const carryoverEnabled = tenant?.maintenanceCarryoverMode === 'carry';
      let carriedHours = 0;

      if (carryoverEnabled) {
        const previousMonthKey = this.getPreviousMonthKey(monthKey);
        const previousCycle = await this.prisma.maintenanceCycle.findUnique({
          where: { tenantId_month: { tenantId, month: previousMonthKey } },
        });

        if (previousCycle) {
          const remaining =
            previousCycle.baseHours +
            previousCycle.carriedHours -
            previousCycle.usedHours;
          if (remaining > 0) {
            carriedHours = remaining;
          }
        }
      }

      cycle = await this.prisma.maintenanceCycle.create({
        data: {
          tenantId,
          month: monthKey,
          baseHours,
          carriedHours,
          usedHours: 0,
          status: 'open',
        },
      });
    }

    return cycle;
  }

  async updateCurrentCycleForTenant(
    tenantId: string,
    data: {
      baseHours?: number;
      carriedHours?: number;
      usedHours?: number;
    },
  ): Promise<MaintenanceCycle> {
    const cycle = await this.getOrCreateCurrentCycleForTenant(tenantId);
    return this.prisma.maintenanceCycle.update({
      where: { id: cycle.id },
      data: {
        baseHours: data.baseHours ?? cycle.baseHours,
        carriedHours: data.carriedHours ?? cycle.carriedHours,
        usedHours: data.usedHours ?? cycle.usedHours,
      },
    });
  }

  async createTaskForTenant(
    tenantId: string,
    dto: CreateMaintenanceTaskDto,
  ): Promise<MaintenanceTask> {
    return this.prisma.maintenanceTask.create({
      data: {
        tenantId,
        title: dto.title,
        type: dto.type ?? 'routine',
        status: dto.status ?? 'open',
      },
    });
  }

  async listTasksForTenant(tenantId: string): Promise<MaintenanceTask[]> {
    return this.prisma.maintenanceTask.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTimeEntryForTenant(
    tenantId: string,
    dto: CreateMaintenanceEntryDto,
  ): Promise<MaintenanceTimeEntry> {
    const cycle = await this.getOrCreateCurrentCycleForTenant(tenantId);

    const entry = await this.prisma.maintenanceTimeEntry.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        taskId: dto.taskId,
        date: new Date(dto.date),
        durationHours: dto.durationHours,
        isIncludedInPlan: dto.isIncludedInPlan ?? true,
        notes: dto.notes,
      },
    });

    await this.prisma.maintenanceCycle.update({
      where: { id: cycle.id },
      data: {
        usedHours: cycle.usedHours + dto.durationHours,
      },
    });

    return entry;
  }

  async listEntriesForCurrentCycle(tenantId: string): Promise<MaintenanceTimeEntry[]> {
    const cycle = await this.getOrCreateCurrentCycleForTenant(tenantId);

    return this.prisma.maintenanceTimeEntry.findMany({
      where: { tenantId, cycleId: cycle.id },
      orderBy: { date: 'desc' },
    });
  }

  async listEntriesForTenantWithMonth(tenantId: string) {
    const entries = await this.prisma.maintenanceTimeEntry.findMany({
      where: { tenantId },
      orderBy: { date: 'desc' },
      include: {
        cycle: { select: { month: true } },
        task: { select: { title: true } },
      },
    });

    return entries.map((entry) => ({
      id: entry.id,
      date: entry.date,
      durationHours: entry.durationHours,
      notes: entry.notes ?? null,
      month: entry.cycle.month,
      taskTitle: entry.task?.title ?? null,
    }));
  }

  private slugify(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async generateUniqueFeatureKey(label: string): Promise<string> {
    let baseKey = this.slugify(label);
    if (!baseKey) {
      baseKey = `feature-${Date.now()}`;
    }

    let candidate = baseKey;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.maintenanceFeature.findUnique({
        where: { key: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
      candidate = `${baseKey}-${counter}`;
      counter += 1;
    }
  }

  async listAllActiveFeatures(): Promise<MaintenanceFeature[]> {
    return this.prisma.maintenanceFeature.findMany({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });
  }

  async createFeature(dto: CreateMaintenanceFeatureDto): Promise<MaintenanceFeature> {
    const key = await this.generateUniqueFeatureKey(dto.label);
    return this.prisma.maintenanceFeature.create({
      data: {
        key,
        label: dto.label.trim(),
        description: dto.description?.trim() || null,
      },
    });
  }

  async getTenantFeatureSelection(tenantId: string) {
    const assignments = await this.prisma.tenantMaintenanceFeature.findMany({
      where: { tenantId },
      include: { feature: true },
      orderBy: { feature: { label: 'asc' } },
    });

    return {
      tenantId,
      selectedFeatureIds: assignments.map((assignment) => assignment.featureId),
      features: assignments.map((assignment) => assignment.feature),
    };
  }

  async assignFeaturesToTenant(tenantId: string, featureIds: string[]) {
    const uniqueIds = Array.from(new Set(featureIds));

    if (uniqueIds.length > 0) {
      const found = await this.prisma.maintenanceFeature.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true },
      });
      if (found.length !== uniqueIds.length) {
        throw new BadRequestException('One or more features do not exist');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.tenantMaintenanceFeature.deleteMany({ where: { tenantId } });
      if (uniqueIds.length > 0) {
        await tx.tenantMaintenanceFeature.createMany({
          data: uniqueIds.map((featureId) => ({
            tenantId,
            featureId,
          })),
        });
      }
    });

    return this.getTenantFeatureSelection(tenantId);
  }

  async createFeatureAndAssign(tenantId: string, dto: CreateMaintenanceFeatureDto) {
    const feature = await this.createFeature(dto);
    await this.prisma.tenantMaintenanceFeature.create({
      data: {
        tenantId,
        featureId: feature.id,
      },
    });
    return {
      feature,
      selection: await this.getTenantFeatureSelection(tenantId),
    };
  }

  async listFeaturesForTenant(tenantId: string) {
    const assignments = await this.prisma.tenantMaintenanceFeature.findMany({
      where: {
        tenantId,
        feature: { isActive: true },
      },
      include: { feature: true },
      orderBy: { feature: { label: 'asc' } },
    });

    return assignments.map((assignment) => ({
      id: assignment.feature.id,
      label: assignment.feature.label,
      description: assignment.feature.description,
    }));
  }
}
