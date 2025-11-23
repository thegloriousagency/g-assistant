import { Module } from '@nestjs/common';
import { Ga4Service } from './ga4.service';
import { Ga4AdminController } from './ga4-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { Ga4ClientController } from './ga4-client.controller';

@Module({
  imports: [PrismaModule],
  controllers: [Ga4AdminController, Ga4ClientController],
  providers: [Ga4Service],
  exports: [Ga4Service],
})
export class Ga4Module {}
