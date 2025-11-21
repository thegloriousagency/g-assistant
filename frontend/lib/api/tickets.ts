import { apiFetch } from '@/lib/api-client';
import {
  PaginatedResult,
  Ticket,
  TicketMessage,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '@/types/tickets';

type PaginationParams = {
  page?: number;
  pageSize?: number;
};

const defaultPagination: Required<PaginationParams> = {
  page: 1,
  pageSize: 20,
};

function buildQuery(params?: PaginationParams) {
  const finalParams = {
    ...defaultPagination,
    ...params,
  };
  const search = new URLSearchParams();
  if (finalParams.page) search.set('page', String(finalParams.page));
  if (finalParams.pageSize) search.set('pageSize', String(finalParams.pageSize));
  const query = search.toString();
  return {
    queryString: query ? `?${query}` : '',
    normalized: finalParams,
  };
}

export async function fetchClientTickets(params?: PaginationParams) {
  const { queryString } = buildQuery(params);
  return apiFetch<PaginatedResult<Ticket>>(`/tickets${queryString}`, {
    includeAuthToken: true,
  });
}

export async function fetchClientTicket(ticketId: string) {
  return apiFetch<Ticket>(`/tickets/${ticketId}`, {
    includeAuthToken: true,
  });
}

export async function createClientTicket(payload: {
  title: string;
  body: string;
  type: TicketType;
}) {
  return apiFetch<Ticket>(
    '/tickets',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      includeAuthToken: true,
    },
  );
}

export async function addClientTicketMessage(
  ticketId: string,
  payload: { body: string },
) {
  return apiFetch<TicketMessage>(`/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
    includeAuthToken: true,
  });
}

export async function fetchAdminTickets(params?: PaginationParams) {
  const { queryString } = buildQuery(params);
  return apiFetch<PaginatedResult<Ticket>>(`/admin/tickets${queryString}`, {
    includeAuthToken: true,
  });
}

export async function fetchAdminTicket(ticketId: string) {
  return apiFetch<Ticket>(`/admin/tickets/${ticketId}`, {
    includeAuthToken: true,
  });
}

export async function createAdminTicket(payload: {
  tenantId: string;
  title: string;
  body: string;
  type: TicketType;
  priority?: TicketPriority;
}) {
  return apiFetch<Ticket>(
    '/admin/tickets',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      includeAuthToken: true,
    },
  );
}

export async function addAdminTicketMessage(
  ticketId: string,
  payload: { body: string },
) {
  return apiFetch<TicketMessage>(`/admin/tickets/${ticketId}/messages`, {
    method: 'POST',
    body: JSON.stringify(payload),
    includeAuthToken: true,
  });
}

export async function updateAdminTicketStatus(
  ticketId: string,
  payload: { status: TicketStatus },
) {
  return apiFetch<Ticket>(`/admin/tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    includeAuthToken: true,
  });
}

