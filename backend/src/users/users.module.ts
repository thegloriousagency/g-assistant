import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  AdminUsersController,
  SelfUsersController,
  UsersController,
} from './users.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [EmailModule],
  controllers: [UsersController, AdminUsersController, SelfUsersController],
  providers: [UsersService, AdminGuard, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
