"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useGa4Summary, type SupportedGa4Range } from "@/hooks/useGa4";
import { AnalyticsKpi, formatAnalyticsDuration } from "@/components/analytics/analytics-kpi";
import { cn } from "@/lib/utils";

const RANGE_OPTIONS: Array<{
  key: string;
  label: string;
  value: SupportedGa4Range;
  disabled?: boolean;
}> = [
  { key: "today", label: "Today", value: "last_7_days", disabled: true },
  { key: "last_7_days", label: "Last 7 days", value: "last_7_days" },
  { key: "last_30_days", label: "Last 30 days", value: "last_30_days" },
  { key: "last_90_days", label: "Last 90 days", value: "last_90_days" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<SupportedGa4Range>("last_30_days");
  const {
    data: summary,
    isLoading,
    isError,
  } = useGa4Summary(range);

  const topPages = summary?.topPages ?? [];
  const topChannels = summary?.topChannels ?? [];

  const isConfigured = Boolean(summary?.configured);
  const hasData = isConfigured && !isLoading && !isError;

  const chartData = useMemo(() => {
    const points = summary?.timeseries ?? [];
    return points.map((point) => ({
      ...point,
      formattedDate: formatDate(point.date),
    }));
  }, [summary?.timeseries]);

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-muted-foreground">Analytics</p>
          <h1 className="text-3xl font-semibold text-foreground">Traffic overview</h1>
          <p className="text-sm text-muted-foreground">
            Monitor visitors, visits, and traffic sources.
          </p>
        </header>

        <section className="space-y-4 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium text-foreground">Date range</p>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs font-semibold">
              {RANGE_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  disabled={option.disabled}
                  className={cn(
                    "rounded px-3 py-1 transition",
                    option.disabled && "cursor-not-allowed text-muted-foreground/60",
                    !option.disabled &&
                      (range === option.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"),
                  )}
                  onClick={() => {
                    if (option.disabled) return;
                    setRange(option.value);
                  }}
                >
                  {option.label}
                  {option.disabled && (
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">Soon</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Loading analytics…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              We couldn’t load analytics right now. Please try again later or contact support.
            </p>
          )}

          {!isLoading && !isError && summary && !isConfigured && (
            <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Analytics is not connected yet for this account. Contact us to set this up.
              </p>
            </div>
          )}

          {hasData && summary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <AnalyticsKpi
                  label="Visitors"
                  helper="Unique users"
                  tooltip="Unique users (GA4 totalUsers)"
                  value={summary.totals.users.toLocaleString()}
                />
                <AnalyticsKpi
                  label="Visits"
                  helper="Sessions"
                  tooltip="Sessions (GA4 sessions)"
                  value={summary.totals.sessions.toLocaleString()}
                />
                <AnalyticsKpi
                  label="Page views"
                  helper="Views"
                  tooltip="Views (GA4 screenPageViews)"
                  value={summary.totals.pageViews.toLocaleString()}
                />
                <AnalyticsKpi
                  label="Avg. visit duration"
                  helper="Average session duration"
                  tooltip="Average session duration (GA4 averageSessionDuration)"
                  value={formatAnalyticsDuration(summary.totals.avgSessionDuration)}
                />
              </div>

              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-base font-semibold text-foreground">Traffic trend</h2>
                  <p className="text-sm text-muted-foreground">Daily sessions for the selected range.</p>
                </div>
                {chartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Not enough data yet for this range.</p>
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="formattedDate" stroke="currentColor" tick={{ fontSize: 12 }} />
                        <YAxis stroke="currentColor" tick={{ fontSize: 12 }} allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--card)",
                            borderColor: "var(--border)",
                          }}
                          labelFormatter={(label) => label}
                          formatter={(value: number, name: string) => {
                            if (name === "sessions") return [value.toLocaleString(), "Sessions"];
                            if (name === "users") return [value.toLocaleString(), "Visitors"];
                            return [value, name];
                          }}
                        />
                        <Line type="monotone" dataKey="sessions" stroke="#2563eb" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Top pages</h3>
                    <p className="text-sm text-muted-foreground">Most viewed content in this range.</p>
                  </div>
                  {topPages.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not enough data yet for this range.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2">Page</th>
                          <th className="py-2 text-right">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topPages.map((page) => (
                          <tr key={`${page.path ?? "unknown"}-${page.title ?? "untitled"}`} className="border-t border-border text-foreground">
                            <td className="py-2 pr-3">
                              <p className="font-medium">{page.title || page.path || "Untitled"}</p>
                              {page.path && (
                                <p className="text-xs text-muted-foreground">{page.path}</p>
                              )}
                            </td>
                            <td className="py-2 text-right font-semibold">
                              {page.views.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="space-y-3 rounded-lg border border-border p-4">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Top channels</h3>
                    <p className="text-sm text-muted-foreground">Where your traffic is coming from.</p>
                  </div>
                  {topChannels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not enough data yet for this range.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="py-2">Channel</th>
                          <th className="py-2 text-right">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topChannels.map((channel) => (
                          <tr key={channel.channel || "unknown"} className="border-t border-border text-foreground">
                            <td className="py-2 pr-3">{channel.channel || "(not set)"}</td>
                            <td className="py-2 text-right font-semibold">
                              {channel.sessions.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}

          {summary?.error && (
            <p className="text-sm text-muted-foreground" title={summary.error}>
              We couldn’t load analytics right now. Please try again later or contact support.
            </p>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
