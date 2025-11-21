import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketPriority, TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { GetClientTicketsQueryDto } from './dto/get-client-tickets-query.dto';
import { CreateAdminTicketDto } from './dto/create-admin-ticket.dto';
import { GetAdminTicketsQueryDto } from './dto/get-admin-tickets-query.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';

type CurrentUser = {
  id: string;
  tenantId: string | null;
  role: UserRole;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePagination(query?: { page?: number; pageSize?: number }) {
    const page = Math.max(1, query?.page ?? 1);
    const sizeInput = query?.pageSize ?? DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, sizeInput));
    const skip = (page - 1) * pageSize;

    return { page, pageSize, skip };
  }

  async createTicketForClient(user: CurrentUser, dto: CreateTicketDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('No tenant associated with user');
    }

    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          tenantId: user.tenantId!,
          createdById: user.id,
          title: dto.title,
          type: dto.type,
          status: TicketStatus.OPEN,
          priority: TicketPriority.NORMAL,
          lastMessageAt: now,
        },
      });

      await tx.ticketMessage.create({
        data: {
          tenantId: ticket.tenantId,
          ticketId: ticket.id,
          authorId: user.id,
          authorRole: UserRole.CLIENT,
          body: dto.body,
          isReadByAdmin: false,
          isReadByClient: true,
        },
      });

      return ticket;
    });

    return result;
  }

  async listTicketsForClient(user: CurrentUser, query: GetClientTicketsQueryDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('No tenant associated with user');
    }
    const { page, pageSize, skip } = this.resolvePagination(query);
    const where = { tenantId: user.tenantId };

    const [rawItems, totalCount] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.ticket.count({ where }),
    ]);

    const ticketIds = rawItems.map((ticket) => ticket.id);
    const unreadSet = await this.getClientUnreadTickets(ticketIds);
    const items = rawItems.map((ticket) => ({
      ...ticket,
      hasUnreadForClient: unreadSet.has(ticket.id),
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalCount,
      },
    };
  }

  async getTicketForClient(user: CurrentUser, ticketId: string) {
    if (!user.tenantId) {
      throw new ForbiddenException('No tenant associated with user');
    }
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket || ticket.tenantId !== user.tenantId) {
      throw new NotFoundException('Ticket not found');
    }

    await this.markMessagesAsReadForClient(ticket.id);

    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async addMessageAsClient(
    user: CurrentUser,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('No tenant associated with user');
    }

    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!ticket || ticket.tenantId !== user.tenantId) {
      throw new NotFoundException('Ticket not found');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          tenantId: ticket.tenantId,
          ticketId: ticket.id,
          authorId: user.id,
          authorRole: UserRole.CLIENT,
          body: dto.body,
          isReadByAdmin: false,
          isReadByClient: true,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { lastMessageAt: now },
      });

      return message;
    });
  }

  async createTicketForAdmin(user: CurrentUser, dto: CreateAdminTicketDto) {
    const now = new Date();
    const priority = dto.priority ?? TicketPriority.NORMAL;

    const result = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          tenantId: dto.tenantId,
          createdById: user.id,
          title: dto.title,
          type: dto.type,
          status: TicketStatus.OPEN,
          priority,
          lastMessageAt: now,
        },
      });

      await tx.ticketMessage.create({
        data: {
          tenantId: ticket.tenantId,
          ticketId: ticket.id,
          authorId: user.id,
          authorRole: UserRole.ADMIN,
          body: dto.body,
          isReadByClient: false,
          isReadByAdmin: true,
        },
      });

      return ticket;
    });

    return result;
  }

  async listTicketsForAdmin(query: GetAdminTicketsQueryDto) {
    const { page, pageSize, skip } = this.resolvePagination(query);

    const [rawItems, totalCount] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.ticket.count(),
    ]);

    const ticketIds = rawItems.map((ticket) => ticket.id);
    const unreadSet = await this.getAdminUnreadTickets(ticketIds);
    const items = rawItems.map((ticket) => ({
      ...ticket,
      tenantName: ticket.tenant?.name ?? undefined,
      hasUnreadForAdmin: unreadSet.has(ticket.id),
    }));

    return {
      items,
      meta: {
        page,
        pageSize,
        totalCount,
      },
    };
  }

  async getTicketForAdmin(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    await this.markMessagesAsReadForAdmin(ticket.id);

    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async addMessageAsAdmin(
    user: CurrentUser,
    ticketId: string,
    dto: CreateTicketMessageDto,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.ticketMessage.create({
        data: {
          tenantId: ticket.tenantId,
          ticketId: ticket.id,
          authorId: user.id,
          authorRole: UserRole.ADMIN,
          body: dto.body,
          isReadByClient: false,
          isReadByAdmin: true,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          lastMessageAt: now,
          status:
            ticket.status === TicketStatus.OPEN
              ? TicketStatus.IN_PROGRESS
              : ticket.status,
        },
      });

      return message;
    });
  }

  updateTicketStatus(ticketId: string, dto: UpdateTicketStatusDto) {
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { status: dto.status },
    });
  }

  private async markMessagesAsReadForClient(ticketId: string) {
    await this.prisma.ticketMessage.updateMany({
      where: {
        ticketId,
        authorRole: UserRole.ADMIN,
        isReadByClient: false,
      },
      data: { isReadByClient: true },
    });
  }

  private async markMessagesAsReadForAdmin(ticketId: string) {
    await this.prisma.ticketMessage.updateMany({
      where: {
        ticketId,
        authorRole: UserRole.CLIENT,
        isReadByAdmin: false,
      },
      data: { isReadByAdmin: true },
    });
  }

  private async getClientUnreadTickets(ticketIds: string[]) {
    if (ticketIds.length === 0) {
      return new Set<string>();
    }
    const unread = await this.prisma.ticketMessage.findMany({
      where: {
        ticketId: { in: ticketIds },
        authorRole: UserRole.ADMIN,
        isReadByClient: false,
      },
      select: { ticketId: true },
    });
    return new Set(unread.map((entry) => entry.ticketId));
  }

  private async getAdminUnreadTickets(ticketIds: string[]) {
    if (ticketIds.length === 0) {
      return new Set<string>();
    }
    const unread = await this.prisma.ticketMessage.findMany({
      where: {
        ticketId: { in: ticketIds },
        authorRole: UserRole.CLIENT,
        isReadByAdmin: false,
      },
      select: { ticketId: true },
    });
    return new Set(unread.map((entry) => entry.ticketId));
  }
}
