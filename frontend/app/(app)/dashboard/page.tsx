"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { useGa4Summary, type SupportedGa4Range } from "@/hooks/useGa4";
import { AnalyticsKpi, formatAnalyticsDuration } from "@/components/analytics/analytics-kpi";

// TODO: Re-enable WordPress posts typing (disabled for MVP focus)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type WordpressPost = {
  id: number;
  title: string;
  slug: string;
  status: string;
  date: string;
  modified: string;
};

type MaintenanceSummary = {
  month: string;
  baseHours: number;
  carriedHours: number;
  extraHours: number;
  usedHours: number;
  totalAvailable: number;
  remaining: number;
};
type StatusResult =
  | { state: "none" }
  | { state: "invalid" }
  | { state: "expired"; diffDays: number }
  | {
      state: "active";
      diffDays: number;
      diffMonths: number;
      color: "green" | "yellow" | "red";
      percent: number;
    };

function computeStatus(expirationIso?: string | null): StatusResult {
  if (!expirationIso) return { state: "none" };
  const expiry = new Date(expirationIso);
  if (Number.isNaN(expiry.getTime())) return { state: "invalid" };
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { state: "expired", diffDays };
  const diffMonths = diffDays / 30;
  let color: "green" | "yellow" | "red" = "yellow";
  if (diffMonths > 6) color = "green";
  else if (diffMonths < 2) color = "red";
  const totalWindowDays = 365;
  const usedDays = Math.max(0, totalWindowDays - diffDays);
  const percent = Math.min(100, Math.max(0, (usedDays / totalWindowDays) * 100));
  return { state: "active", diffDays, diffMonths, color, percent };
}

function formatEndDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDurationLabel(seconds: number) {
  return formatAnalyticsDuration(seconds);
}

export default function DashboardPage() {
  const { tenant } = useAuth();
  const [analyticsRange, setAnalyticsRange] = useState<SupportedGa4Range>("last_30_days");
  const {
    data: maintenance,
    isLoading: isMaintLoading,
    isError: isMaintError,
  } = useQuery<MaintenanceSummary>({
    queryKey: ["maintenance", "current"],
    queryFn: () => apiFetch<MaintenanceSummary>("/maintenance/current", { method: "GET" }, true),
    enabled: Boolean(tenant?.id),
  });

  const wpConfigured = useMemo(
    () =>
      Boolean(tenant?.wpSiteUrl) &&
      Boolean(tenant?.wpApiUser) &&
      Boolean(tenant?.wpAppPassword),
    [tenant?.wpSiteUrl, tenant?.wpApiUser, tenant?.wpAppPassword],
  );
  const {
    data: analytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
  } = useGa4Summary(analyticsRange);

  // TODO: Re-enable WordPress posts (disabled for MVP focus)
  /*
  const {
    data: posts,
    isLoading,
    isError,
    error,
  } = useQuery<WordpressPost[]>({
    queryKey: ["wordpress", "posts"],
    queryFn: () => apiFetch<WordpressPost[]>("/wordpress/posts", { method: "GET" }, true),
    enabled: wpConfigured,
  });
  */

  useEffect(() => {
    // Debug tenant + WP configuration state
    console.debug("[dashboard] tenant", tenant);
    console.debug("[dashboard] WordPress configured?", wpConfigured);
  }, [tenant, wpConfigured]);

  // TODO: Re-enable WordPress posts logging (disabled for MVP focus)
  /*
  useEffect(() => {
    if (posts) {
      console.debug("[dashboard] fetched posts", posts);
    }
  }, [posts]);
  */

  const hostingStatus = computeStatus(tenant?.hostingExpirationDate);
  const maintenanceStatus = computeStatus(tenant?.maintenanceExpirationDate);

  const renderStatusBlock = (
    label: "Hosting" | "Maintenance",
    status: StatusResult,
    ordered: boolean,
    expirationIso?: string | null,
    renewHref?: string,
    renewCopy?: string,
  ) => {
    let description = "";
    let textClass = "text-muted-foreground";
    let percent = 0;
    let barColor = "";
    const formattedEnd = formatEndDate(expirationIso);

    if (!ordered && status.state === "none") {
      description = "Not ordered";
    } else if (status.state === "none") {
      description = "No expiration date set";
    } else if (status.state === "invalid") {
      description = "Invalid expiration date";
      textClass = "text-red-500";
    } else if (status.state === "expired") {
      description = `Expired ${Math.abs(status.diffDays)} days ago`;
      textClass = "text-red-500";
    } else if (status.state === "active") {
      description =
        status.diffMonths >= 1
          ? `~${Math.max(1, Math.round(status.diffMonths))} months left`
          : `${status.diffDays} days left`;
      textClass =
        status.color === "green"
          ? "text-emerald-600"
          : status.color === "yellow"
            ? "text-amber-500"
            : "text-red-500";
      percent = status.percent;
      barColor =
        status.color === "green"
          ? "bg-emerald-500"
          : status.color === "yellow"
            ? "bg-amber-400"
            : "bg-red-500";
    }

    const detailHref = label === "Hosting" ? "/dashboard/hosting" : "/dashboard/maintenance";
    const shouldShowRenew =
      ordered && status.state === "active" && typeof status.diffMonths === "number"
        ? status.diffMonths < 3
        : false;

    return (
      <div className="w-full space-y-2 text-sm text-muted-foreground">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-sm font-medium text-foreground", textClass)}>{description}</p>
        {status.state === "active" && (
          <div className="mt-1 h-2 w-full rounded-full bg-muted">
            <div
              className={cn("h-2 rounded-full transition-all", barColor)}
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
        <p>
          {status.state === "active" && formattedEnd
            ? `Paid through ${formattedEnd}`
            : status.state === "expired" && formattedEnd
              ? `Expired on ${formattedEnd}`
              : ordered
                ? "No expiration date set"
                : "Service not ordered"}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {shouldShowRenew && renewHref && renewCopy && (
            <Button type="button" size="sm" variant="outline" asChild>
              <a href={renewHref}>{renewCopy}</a>
            </Button>
          )}
          <Link
            href={detailHref}
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
          >
            View {label.toLowerCase()} details
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7h10v10" />
            </svg>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <section className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Service status</h2>
              <p className="text-sm text-muted-foreground">
                Track hosting and maintenance timelines.
              </p>
            </div>
            <div className="text-sm text-muted-foreground">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Website</p>
              {tenant?.websiteUrl ? (
                <Link
                  href={tenant.websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {tenant.websiteUrl}
                </Link>
              ) : (
                <span>Not configured</span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-6 md:flex-row">
            {renderStatusBlock(
              "Hosting",
              hostingStatus,
              Boolean(tenant?.hostingOrdered),
              tenant?.hostingExpirationDate,
              "#TODO-renew-hosting",
              "Renew hosting",
            )}
            {renderStatusBlock(
              "Maintenance",
              maintenanceStatus,
              Boolean(tenant?.maintenanceOrdered),
              tenant?.maintenanceExpirationDate,
              "#TODO-renew-maintenance",
              "Renew maintenance",
            )}
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Website analytics.
              </p>
            </div>
            <div className="inline-flex rounded-md border border-border p-0.5 text-xs font-semibold">
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 transition",
                  analyticsRange === "last_7_days"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAnalyticsRange("last_7_days")}
              >
                Last 7 days
              </button>
              <button
                type="button"
                className={cn(
                  "rounded px-3 py-1 transition",
                  analyticsRange === "last_30_days"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setAnalyticsRange("last_30_days")}
              >
                Last 30 days
              </button>
            </div>
          </div>
          {isAnalyticsLoading && (
            <p className="text-sm text-muted-foreground">Loading analytics…</p>
          )}
          {isAnalyticsError && (
            <p className="text-sm text-destructive">
              We couldn’t load analytics right now. Please try again later or contact support.
            </p>
          )}
          {!isAnalyticsLoading && !isAnalyticsError && analytics && (
            <>
              {analytics.configured ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <AnalyticsKpi
                    label="Visitors"
                    helper="Unique users"
                    tooltip="Unique users (GA4 totalUsers)"
                    value={analytics.totals.users.toLocaleString()}
                  />
                  <AnalyticsKpi
                    label="Visits"
                    helper="Sessions"
                    tooltip="Sessions (GA4 sessions)"
                    value={analytics.totals.sessions.toLocaleString()}
                  />
                  <AnalyticsKpi
                    label="Page views"
                    helper="Views"
                    tooltip="Views (GA4 screenPageViews)"
                    value={analytics.totals.pageViews.toLocaleString()}
                  />
                  <AnalyticsKpi
                    label="Avg. visit duration"
                    helper="Average session duration"
                    tooltip="Average session duration (GA4 averageSessionDuration)"
                    value={formatDurationLabel(analytics.totals.avgSessionDuration)}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Analytics is not connected yet for this account. Contact us to set this up.
                </p>
              )}
              {analytics.error && (
                <p className="text-sm text-muted-foreground" title={analytics.error}>
                  We couldn’t load analytics right now. Please try again later or contact support.
                </p>
              )}
              <div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/analytics">View full analytics</Link>
                </Button>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Maintenance hours</h2>
            <p className="text-sm text-muted-foreground">
              Track how much plan time you have this month.
            </p>
          </div>
          {isMaintLoading && (
            <p className="text-sm text-muted-foreground">Loading maintenance hours…</p>
          )}
          {isMaintError && (
            <p className="text-sm text-destructive">Unable to load maintenance hours right now.</p>
          )}
          {!isMaintLoading && !isMaintError && maintenance && (
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                This month:{" "}
                <span className="font-medium text-foreground">
                  {maintenance.totalAvailable.toFixed(1)}h
                </span>
              </p>
              <p>
                Used:{" "}
                <span className="font-medium text-foreground">
                  {maintenance.usedHours.toFixed(1)}h
                </span>{" "}
                · Remaining:{" "}
                <span className="font-medium text-foreground">
                  {Math.max(0, maintenance.remaining).toFixed(1)}h
                </span>
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${
                      maintenance.totalAvailable > 0
                        ? Math.min(100, (maintenance.usedHours / maintenance.totalAvailable) * 100)
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div>
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/maintenance">View maintenance details</Link>
                </Button>
              </div>
            </div>
          )}
        </section>

        {/*
          TODO: Re-enable WordPress posts (disabled for hosting/maintenance MVP)
        <Card>
          <CardHeader>
            <CardTitle>WordPress posts</CardTitle>
            <CardDescription>
              Latest posts pulled from your connected WordPress site.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {!wpConfigured && (
              <p className="text-muted-foreground">
                WordPress connection is not configured for this tenant yet.
              </p>
            )}

            {wpConfigured && isLoading && (
              <p className="text-muted-foreground">Loading WordPress posts...</p>
            )}

            {wpConfigured && isError && (
              <p className="text-destructive">
                {error instanceof ApiError
                  ? error.message
                  : "Failed to load WordPress posts."}
              </p>
            )}

            {wpConfigured &&
              !isLoading &&
              !isError &&
              posts &&
              posts.length === 0 && (
                <p className="text-muted-foreground">No posts found.</p>
              )}

            {wpConfigured &&
              !isLoading &&
              !isError &&
              posts &&
              posts.length > 0 && (
                <ul className="space-y-3">
                  {posts.map((post) => (
                    <li key={post.id} className="border-b pb-2 last:border-b-0">
                      <p className="font-medium text-foreground">
                        {post.title || "(no title)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {post.status} • Published:{" "}
                        {new Date(post.date).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
          </CardContent>
        </Card>
        */}
      </div>
    </ProtectedRoute>
  );
}
