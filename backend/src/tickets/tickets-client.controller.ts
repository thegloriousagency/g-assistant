import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { GetClientTicketsQueryDto } from './dto/get-client-tickets-query.dto';
import { UserRole } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string | null;
    role?: string;
  };
}
@UseGuards(JwtAuthGuard)
@Controller('tickets')
export class TicketsClientController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  createTicket(@Req() req: AuthenticatedRequest, @Body() body: CreateTicketDto) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.createTicketForClient(currentUser, body);
  }

  @Get()
  listTickets(
    @Req() req: AuthenticatedRequest,
    @Query() query: GetClientTicketsQueryDto,
  ) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.listTicketsForClient(currentUser, query);
  }

  @Get(':id')
  getTicket(@Req() req: AuthenticatedRequest, @Param('id') ticketId: string) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.getTicketForClient(currentUser, ticketId);
  }

  @Post(':id/messages')
  addMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') ticketId: string,
    @Body() body: CreateTicketMessageDto,
  ) {
    const currentUser = this.getCurrentUser(req);
    return this.ticketsService.addMessageAsClient(currentUser, ticketId, body);
  }

  private getCurrentUser(req: AuthenticatedRequest) {
    if (!req.user) {
      throw new Error('User context missing');
    }
    const role = this.normalizeRole(req.user.role, UserRole.CLIENT);
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
