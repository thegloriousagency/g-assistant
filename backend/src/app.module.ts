import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { TenantsModule } from './tenants/tenants.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WordpressModule } from './wordpress/wordpress.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { TicketsModule } from './tickets/tickets.module';
import { Ga4Module } from './ga4/ga4.module';
import { EmailModule } from './email/email.module';
import { HostingModule } from './hosting/hosting.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 60,
      },
    ]),
    PrismaModule,
    UsersModule,
    TenantsModule,
    AuthModule,
    WordpressModule,
    MaintenanceModule,
    TicketsModule,
    Ga4Module,
    EmailModule,
    HostingModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
