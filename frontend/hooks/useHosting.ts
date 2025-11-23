import { useMutation, useQuery } from '@tanstack/react-query';
import { getCpanelSessionUrl, getHostingAccountSummary } from '@/lib/api/hosting';

export function useCpanelSession() {
  return useMutation({
    mutationFn: () => getCpanelSessionUrl(),
  });
}

export function useHostingAccountSummary(enabled = true) {
  return useQuery({
    queryKey: ['hosting', 'account-summary'],
    queryFn: () => getHostingAccountSummary(),
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
