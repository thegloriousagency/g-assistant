import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export type SupportedGa4Range = "last_7_days" | "last_30_days" | "last_90_days";

export interface Ga4Summary {
  range: SupportedGa4Range;
  configured: boolean;
  error: string | null;
  totals: {
    users: number;
    sessions: number;
    pageViews: number;
    avgSessionDuration: number;
  };
  timeseries: Array<{ date: string; sessions: number; users: number }>;
  topPages: Array<{ path: string; title: string | null; views: number }>;
  topChannels: Array<{ channel: string; sessions: number }>;
}

export function useGa4Summary(range: SupportedGa4Range = "last_30_days") {
  return useQuery<Ga4Summary>({
    queryKey: ["ga4", "summary", range],
    queryFn: () => apiFetch<Ga4Summary>(`/ga4/summary?range=${range}`, { method: "GET" }, true),
  });
}
