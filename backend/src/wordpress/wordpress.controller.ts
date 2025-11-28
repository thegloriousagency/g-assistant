import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { WordpressService } from './wordpress.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { WordpressEventsQueryDto } from './dto/fetch-events.dto';
import { UpsertWordpressEventDto } from './dto/upsert-event.dto';

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
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.getPostsForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('locations')
  async getLocations(@Req() req: AuthenticatedRequest) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.getLocationsForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('settings')
  async getSettings(@Req() req: AuthenticatedRequest) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.getSettingsForTenant(tenantId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('events')
  async getEvents(
    @Req() req: AuthenticatedRequest,
    @Query() query: WordpressEventsQueryDto,
  ) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.getEventsForTenant(tenantId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('events/:eventId')
  async getEventDetails(
    @Req() req: AuthenticatedRequest,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.getEventDetailsForTenant(tenantId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('events')
  async createEvent(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpsertWordpressEventDto,
  ) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.createEventForTenant(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Put('events/:eventId')
  async updateEvent(
    @Req() req: AuthenticatedRequest,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: UpsertWordpressEventDto,
  ) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.updateEventForTenant(tenantId, eventId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('events/:eventId')
  async deleteEvent(
    @Req() req: AuthenticatedRequest,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    const tenantId = this.assertTenantId(req);
    return this.wordpressService.deleteEventForTenant(tenantId, eventId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/tenants/:tenantId/test')
  async testTenantConnection(@Param('tenantId') tenantId: string) {
    return this.wordpressService.testConnectionForTenant(tenantId);
  }

  private assertTenantId(req: AuthenticatedRequest) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No tenant associated with user');
    }
    return tenantId;
  }
}
