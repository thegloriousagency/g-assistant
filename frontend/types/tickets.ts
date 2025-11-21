export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type TicketType =
  | 'MAINTENANCE'
  | 'CONTENT_UPDATE'
  | 'BUG'
  | 'BILLING'
  | 'OTHER';

export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH';

export type TicketAuthorRole = 'ADMIN' | 'CLIENT';

export interface TicketMessage {
  id: string;
  ticketId: string;
  tenantId: string;
  authorId: string;
  authorRole: TicketAuthorRole;
  body: string;
  isReadByClient: boolean;
  isReadByAdmin: boolean;
  createdAt: string;
}

export interface Ticket {
  id: string;
  tenantId: string;
  createdById: string;
  title: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: TicketMessage[];
  tenantName?: string;
  hasUnreadForClient?: boolean;
  hasUnreadForAdmin?: boolean;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}

