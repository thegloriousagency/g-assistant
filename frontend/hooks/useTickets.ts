'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addAdminTicketMessage,
  addClientTicketMessage,
  createAdminTicket,
  createClientTicket,
  fetchAdminTicket,
  fetchAdminTickets,
  fetchClientTicket,
  fetchClientTickets,
  updateAdminTicketStatus,
} from '@/lib/api/tickets';
import type {
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

type QueryEnabledOption = {
  enabled?: boolean;
};
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

function useNormalizedPagination(params?: PaginationParams) {
  return useMemo(
    () => ({
      page: params?.page ?? DEFAULT_PAGE,
      pageSize: params?.pageSize ?? DEFAULT_PAGE_SIZE,
    }),
    [params?.page, params?.pageSize],
  );
}

export function useClientTickets(
  params?: PaginationParams,
  options?: QueryEnabledOption,
) {
  const pagination = useNormalizedPagination(params);
  return useQuery<PaginatedResult<Ticket>>({
    queryKey: ['tickets', 'client', pagination],
    queryFn: () => fetchClientTickets(pagination),
    keepPreviousData: true,
    enabled: options?.enabled ?? true,
  });
}

export function useClientTicket(ticketId?: string) {
  return useQuery<Ticket>({
    queryKey: ['tickets', 'client', ticketId],
    queryFn: () => fetchClientTicket(ticketId as string),
    enabled: Boolean(ticketId),
  });
}

export function useCreateClientTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      body: string;
      type: TicketType;
    }) => createClientTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'client'] });
    },
  });
}

export function useAddClientTicketMessage(ticketId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string }) => {
      if (!ticketId) {
        return Promise.reject(new Error('ticketId is required'));
      }
      return addClientTicketMessage(ticketId, payload);
    },
    onSuccess: () => {
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: ['tickets', 'client', ticketId],
        });
      }
      // Also refresh the list for ordering
      queryClient.invalidateQueries({ queryKey: ['tickets', 'client'] });
    },
  });
}

export function useAdminTickets(
  params?: PaginationParams,
  options?: QueryEnabledOption,
) {
  const pagination = useNormalizedPagination(params);
  return useQuery<PaginatedResult<Ticket>>({
    queryKey: ['tickets', 'admin', pagination],
    queryFn: () => fetchAdminTickets(pagination),
    keepPreviousData: true,
    enabled: options?.enabled ?? true,
  });
}

export function useAdminTicket(ticketId?: string) {
  return useQuery<Ticket>({
    queryKey: ['tickets', 'admin', ticketId],
    queryFn: () => fetchAdminTicket(ticketId as string),
    enabled: Boolean(ticketId),
  });
}

export function useCreateAdminTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      tenantId: string;
      title: string;
      body: string;
      type: TicketType;
      priority?: TicketPriority;
    }) => createAdminTicket(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets', 'admin'] });
    },
  });
}

export function useAddAdminTicketMessage(ticketId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { body: string }) => {
      if (!ticketId) {
        return Promise.reject(new Error('ticketId is required'));
      }
      return addAdminTicketMessage(ticketId, payload);
    },
    onSuccess: () => {
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: ['tickets', 'admin', ticketId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tickets', 'admin'] });
    },
  });
}

export function useUpdateAdminTicketStatus(ticketId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: TicketStatus }) => {
      if (!ticketId) {
        return Promise.reject(new Error('ticketId is required'));
      }
      return updateAdminTicketStatus(ticketId, payload);
    },
    onSuccess: () => {
      if (ticketId) {
        queryClient.invalidateQueries({
          queryKey: ['tickets', 'admin', ticketId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ['tickets', 'admin'] });
    },
  });
}

