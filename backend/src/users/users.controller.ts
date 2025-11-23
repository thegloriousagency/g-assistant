import { Body, Controller, Delete, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email.dto';
import { Throttle } from '@nestjs/throttler';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':tenantId/users')
  createClientUser(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateClientUserDto,
  ) {
    return this.usersService.createClientUser(tenantId, body);
  }

  @Delete(':tenantId/users/:userId')
  async deleteClientUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    await this.usersService.deleteClientUser(tenantId, userId);
    return { ok: true };
  }
}

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle({ default: { limit: 3, ttl: 300 } })
  @Post(':userId/send-reset')
  async sendReset(@Param('userId') userId: string) {
    await this.usersService.triggerPasswordResetEmail(userId);
    return { ok: true };
  }

  @Throttle({ default: { limit: 3, ttl: 300 } })
  @Post(':userId/send-welcome')
  async sendWelcome(@Param('userId') userId: string) {
    await this.usersService.resendWelcomeEmail(userId);
    return { ok: true };
  }
}

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('users/me')
@UseGuards(JwtAuthGuard)
export class SelfUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('change-password')
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    await this.usersService.changePasswordForUser(
      req.user.userId,
      body.currentPassword,
      body.newPassword,
    );
    return { ok: true };
  }

  @Post('change-email')
  async changeEmail(@Req() req: AuthenticatedRequest, @Body() body: ChangeEmailDto) {
    await this.usersService.initiateEmailChange(
      req.user.userId,
      body.password,
      body.newEmail,
    );
    return {
      message: 'Check your new inbox to verify this email address.',
    };
  }

  @Post('confirm-email-change')
  async confirmEmailChange(@Body() body: ConfirmEmailChangeDto) {
    await this.usersService.confirmEmailChange(body.token);
    return { ok: true };
  }
}
