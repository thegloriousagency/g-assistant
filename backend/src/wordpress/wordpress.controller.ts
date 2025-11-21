import {
  Controller,
  Get,
  Req,
  UseGuards,
  BadRequestException,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { WordpressService } from './wordpress.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

interface AuthenticatedRequest extends Request {
  user?: {
    tenantId: string | null;
  };
}

@Controller('wordpress')
export class WordpressController {
  constructor(private readonly wordpressService: WordpressService) {}

  @UseGuards(JwtAuthGuard)
  @Get('posts')
  async getPosts(@Req() req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with user');
    }

    return this.wordpressService.getPostsForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/test')
  async testTenantConnection(@Param('tenantId') tenantId: string) {
    return this.wordpressService.testConnectionForTenant(tenantId);
  }
}
