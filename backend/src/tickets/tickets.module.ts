import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsClientController } from './tickets-client.controller';
import { TicketsAdminController } from './tickets-admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [TicketsClientController, TicketsAdminController],
  providers: [TicketsService],
})
export class TicketsModule {}
