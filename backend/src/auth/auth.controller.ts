import {
  Body,
  Controller,
  Get,
  Post,
  UnauthorizedException,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Throttle } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    role: string;
    tenantId: string | null;
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    return this.authService.login(user);
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(body.email);
    return {
      message:
        'If that email exists in our system, you will receive password reset instructions shortly.',
    };
  }

  @Throttle({ default: { limit: 5, ttl: 60 } })
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.authService.resetPasswordWithToken(body.token, body.newPassword);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const { password: _password, ...safeUser } = user;
    void _password;
    const tenant =
      req.user.tenantId !== null
        ? await this.tenantsService.findById(req.user.tenantId)
        : null;

    return {
      user: {
        id: safeUser.id,
        email: safeUser.email,
        role: safeUser.role,
        tenantId: safeUser.tenantId,
        createdAt: safeUser.createdAt,
        updatedAt: safeUser.updatedAt,
      },
      tenant: tenant
        ? {
            id: tenant.id,
            name: tenant.name,
            websiteUrl: tenant.websiteUrl,
            contactEmail: tenant.contactEmail,
            wpSiteUrl: tenant.wpSiteUrl,
            wpApiUser: tenant.wpApiUser,
            wpAppPassword: tenant.wpAppPassword,
            hostingCpanelUsername: tenant.hostingCpanelUsername,
            hostingExpirationDate: tenant.hostingExpirationDate,
            maintenanceExpirationDate: tenant.maintenanceExpirationDate,
            hostingOrdered: tenant.hostingOrdered,
            maintenanceOrdered: tenant.maintenanceOrdered,
            maintenancePlanName: tenant.maintenancePlanName,
            maintenanceHoursPerMonth: tenant.maintenanceHoursPerMonth,
            maintenanceCarryoverMode: tenant.maintenanceCarryoverMode,
            maintenanceStartDate: tenant.maintenanceStartDate,
          }
        : null,
    };
  }
}
