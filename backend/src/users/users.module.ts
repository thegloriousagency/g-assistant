import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AdminGuard, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
