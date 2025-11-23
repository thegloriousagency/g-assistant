import { Module } from '@nestjs/common';
import { HostingController } from './hosting.controller';
import { WhmService } from './whm.service';
import { TenantsModule } from '../tenants/tenants.module';
import { HostingAdminController } from './hosting-admin.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TenantsModule, EmailModule],
  controllers: [HostingController, HostingAdminController],
  providers: [WhmService],
})
export class HostingModule {}
