import type { TicketStatus, TicketType } from '@/types/tickets';

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  MAINTENANCE: 'Maintenance issue',
  CONTENT_UPDATE: 'Content update / text or image change',
  BUG: 'Bug / technical issue',
  BILLING: 'Billing / account question',
  OTHER: 'Other',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const TICKET_STATUS_BADGES: Record<TicketStatus, string> = {
  OPEN: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border border-amber-200',
  RESOLVED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CLOSED: 'bg-slate-100 text-slate-700 border border-slate-200',
};

export const TICKET_STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
];

export function formatTicketDate(dateString: string, withTime = false) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  const options: Intl.DateTimeFormatOptions = withTime
    ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleString('en-US', options);
}

