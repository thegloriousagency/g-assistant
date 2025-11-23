import { apiFetch } from '@/lib/api-client';

export interface HostingAccountSummary {
  planName: string | null;
  storageMb: number | null;
  diskUsedMb: number | null;
  databases: number | null;
  ftpUsers: number | null;
  bandwidthMb: number | null;
  subdomains: number | null;
  emailAccounts: number | null;
  emailQuotaMb: number | null;
}

export function getCpanelSessionUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/hosting/cpanel-session', { method: 'GET' }, true);
}

export function getHostingAccountSummary(): Promise<HostingAccountSummary> {
  return apiFetch<HostingAccountSummary>('/hosting/account-summary', { method: 'GET' }, true);
}
