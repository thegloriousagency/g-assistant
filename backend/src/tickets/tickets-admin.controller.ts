import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateAdminTicketDto } from './dto/create-admin-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { GetAdminTicketsQueryDto } from './dto/get-admin-tickets-query.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string | null;
    role?: string;
  };
}

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/tickets')
export class TicketsAdminController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  createTicket(@Req() req: AuthenticatedRequest, @Body() body: CreateAdminTicketDto) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.createTicketForAdmin(currentUser, body);
  }

  @Get()
  listTickets(@Query() query: GetAdminTicketsQueryDto) {
    return this.ticketsService.listTicketsForAdmin(query);
  }

  @Get(':id')
  getTicket(@Param('id') ticketId: string) {
    return this.ticketsService.getTicketForAdmin(ticketId);
  }

  @Post(':id/messages')
  addMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') ticketId: string,
    @Body() body: CreateTicketMessageDto,
  ) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.addMessageAsAdmin(currentUser, ticketId, body);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') ticketId: string, @Body() body: UpdateTicketStatusDto) {
    return this.ticketsService.updateTicketStatus(ticketId, body);
  }

  private getCurrentUser(req: AuthenticatedRequest) {
    if (!req.user) {
      throw new Error('User context missing');
    }
    const role = this.normalizeRole(req.user.role, UserRole.ADMIN);
    return {
      id: req.user.userId,
      tenantId: req.user.tenantId ?? null,
      role,
    };
  }

  private normalizeRole(role: string | undefined, fallback: UserRole) {
    if (typeof role === 'string') {
      const upper = role.toUpperCase();
      if (upper === UserRole.ADMIN) {
        return UserRole.ADMIN;
      }
      if (upper === UserRole.CLIENT) {
        return UserRole.CLIENT;
      }
    }
    return fallback;
  }
}
