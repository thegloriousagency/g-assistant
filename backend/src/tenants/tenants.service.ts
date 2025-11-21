import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Tenant, User } from '@prisma/client';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  createTenant(data: CreateTenantDto): Promise<Tenant> {
    const {
      hostingExpirationDate,
      maintenanceExpirationDate,
      maintenanceStartDate,
      ...rest
    } = data;
    return this.prisma.tenant.create({
      data: {
        ...rest,
        hostingExpirationDate: this.transformDate(hostingExpirationDate),
        maintenanceExpirationDate: this.transformDate(maintenanceExpirationDate),
        maintenanceStartDate: this.transformDate(maintenanceStartDate),
      },
    });
  }

  findAll(): Promise<Tenant[]> {
    return this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({ where: { id } });
  }

  async findByIdOrThrow(id: string): Promise<Tenant> {
    const tenant = await this.findById(id);
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  findByIdWithUsersOrThrow(id: string): Promise<Tenant & { users: User[] }> {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id },
      include: { users: true },
    });
  }

  updateTenant(id: string, data: UpdateTenantDto): Promise<Tenant> {
    const {
      hostingExpirationDate,
      maintenanceExpirationDate,
      maintenanceStartDate,
      ...rest
    } = data;
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...rest,
        hostingExpirationDate: this.transformDate(hostingExpirationDate),
        maintenanceExpirationDate: this.transformDate(maintenanceExpirationDate),
        maintenanceStartDate: this.transformDate(maintenanceStartDate),
      },
    });
  }

  async deleteTenantIfEmpty(id: string): Promise<Tenant> {
    const userCount = await this.prisma.user.count({
      where: { tenantId: id },
    });

    if (userCount > 0) {
      throw new BadRequestException('Cannot delete tenant with existing users');
    }

    return this.prisma.tenant.delete({
      where: { id },
    });
  }

  private transformDate(value?: string | null): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value === '') {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid date provided');
    }
    return parsed;
  }
}
