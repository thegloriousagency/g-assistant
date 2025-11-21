import { Module } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService, AdminGuard, JwtAuthGuard],
  exports: [TenantsService],
})
export class TenantsModule {}
