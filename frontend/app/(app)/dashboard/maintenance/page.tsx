"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";

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

type MaintenanceSummary = {
  month: string;
  baseHours: number;
  carriedHours: number;
  usedHours: number;
  totalAvailable: number;
  remaining: number;
};

type MaintenanceEntry = {
  id: string;
  date: string;
  durationHours: number;
  notes: string | null;
  month: string;
  taskTitle: string | null;
};

type MaintenanceFeature = {
  id: string;
  label: string;
  description?: string | null;
};

function formatEntryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatMonthKey(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const date = new Date(year, month - 1, 1);
  if (Number.isNaN(date.getTime())) return monthKey;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function carryoverSummary(mode?: string | null) {
  if (mode === "carry") return "Unused hours roll into next month.";
  return "Unused hours expire monthly.";
}

function formatDurationHM(hoursFloat: number | null | undefined) {
  if (!Number.isFinite(hoursFloat ?? NaN) || (hoursFloat ?? 0) <= 0) {
    return "0h";
  }
  const totalMinutes = Math.round((hoursFloat ?? 0) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h}h`;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function MaintenanceStatusPage() {
  const { tenant } = useAuth();
  const status = computeStatus(tenant?.maintenanceExpirationDate);
  const ordered = Boolean(tenant?.maintenanceOrdered);
  const formattedEnd = formatEndDate(tenant?.maintenanceExpirationDate);
  const formattedStart = formatEndDate(tenant?.maintenanceStartDate);
  const {
    data: maintenance,
    isLoading: isMaintLoading,
    isError: isMaintError,
  } = useQuery<MaintenanceSummary>({
    queryKey: ["maintenance", "current"],
    queryFn: () => apiFetch<MaintenanceSummary>("/maintenance/current", { method: "GET" }, true),
    enabled: Boolean(tenant?.id),
  });

  const {
    data: includedFeatures,
    isLoading: isFeaturesLoading,
    isError: isFeaturesError,
  } = useQuery<MaintenanceFeature[]>({
    queryKey: ["maintenance", "features", tenant?.id],
    queryFn: () =>
      apiFetch<MaintenanceFeature[]>("/maintenance/features", { method: "GET" }, true),
    enabled: Boolean(tenant?.id),
  });

  const {
    data: entries,
    isLoading: isEntriesLoading,
    isError: isEntriesError,
  } = useQuery<MaintenanceEntry[]>({
    queryKey: ["maintenance", "entries"],
    queryFn: () => apiFetch<MaintenanceEntry[]>("/maintenance/entries", { method: "GET" }, true),
    enabled: Boolean(tenant?.id),
  });

  let description = "";
  let textClass = "text-muted-foreground";
  let percent = 0;
  let barColor = "bg-muted";

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

  const shouldShowRenew =
    ordered && status.state === "active" && typeof status.diffMonths === "number"
      ? status.diffMonths < 3
      : false;

  const currentMonthKey = maintenance?.month ?? null;

  const thisMonthEntries = useMemo(() => {
    if (!entries || !currentMonthKey) return [];
    return entries.filter((entry) => entry.month === currentMonthKey);
  }, [entries, currentMonthKey]);

  const previousByMonth = useMemo(() => {
    if (!entries) return [];
    const groups = new Map<string, MaintenanceEntry[]>();
    for (const entry of entries) {
      if (currentMonthKey && entry.month === currentMonthKey) continue;
      if (!groups.has(entry.month)) {
        groups.set(entry.month, []);
      }
      groups.get(entry.month)!.push(entry);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([month, list]) => ({ month, entries: list }));
  }, [entries, currentMonthKey]);

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Maintenance status</h2>
            <p className="text-sm text-muted-foreground">
              Overview of your maintenance coverage and renewal.
            </p>
          </div>
          <div className="flex flex-col gap-8 lg:flex-row">
            <div className="flex-1 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide">Maintenance</p>
                <p className={cn("text-sm font-medium text-foreground", textClass)}>{description}</p>
              </div>
              {status.state === "active" && (
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className={cn("h-2 rounded-full transition-all", barColor)}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  Start date:{" "}
                  <span className="text-foreground">
                    {formattedStart ?? (tenant?.maintenanceStartDate ? "Invalid date" : "Not configured")}
                  </span>
                </p>
                <p>
                  Expiration date:{" "}
                  <span className="text-foreground">
                    {formattedEnd ?? (tenant?.maintenanceExpirationDate ? "Invalid date" : "Not configured")}
                  </span>
                </p>
              </div>
              {shouldShowRenew && (
                <Button type="button" size="sm" variant="outline" asChild>
                  {/* TODO: Replace href with real renew URL */}
                  <a href="#TODO-renew-maintenance">Renew maintenance</a>
                </Button>
              )}
              <div className="space-y-2 pt-4">
                <p className="font-semibold text-foreground">What&apos;s included</p>
                {isFeaturesLoading && <p>Loading plan details…</p>}
                {isFeaturesError && (
                  <p className="text-destructive">Unable to load maintenance features right now.</p>
                )}
                {!isFeaturesLoading &&
                  !isFeaturesError &&
                  includedFeatures &&
                  includedFeatures.length > 0 && (
                    <ul className="list-disc space-y-1 pl-6">
                      {includedFeatures.map((feature) => (
                        <li key={feature.id}>{feature.label}</li>
                      ))}
                    </ul>
                  )}
                {!isFeaturesLoading &&
                  !isFeaturesError &&
                  (!includedFeatures || includedFeatures.length === 0) && (
                    <p>Your maintenance plan doesn&apos;t have a feature list configured yet.</p>
                  )}
                <p className="text-xs text-muted-foreground">
                  {tenant?.maintenanceHoursPerMonth !== null &&
                  tenant?.maintenanceHoursPerMonth !== undefined
                    ? `${tenant.maintenanceHoursPerMonth}h per month`
                    : "Monthly hours not configured"}
                  {" · "}
                  {carryoverSummary(tenant?.maintenanceCarryoverMode)}
                </p>
              </div>
            </div>
            <div className="flex-1 space-y-4 text-sm text-muted-foreground">
              <div>
                <h3 className="text-base font-semibold text-foreground">This Month&apos;s Hours</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time snapshot of your maintenance time.
                </p>
              </div>
              {isMaintLoading && <p>Loading maintenance hours…</p>}
              {isMaintError && (
                <p className="text-destructive">Unable to load maintenance hours right now.</p>
              )}
              {!isMaintLoading && !isMaintError && maintenance && (
                <div className="space-y-4">
                  <div>
                    <p className="text-base text-foreground">
                      This month: {maintenance.totalAvailable?.toFixed(1) ?? "0.0"}h total
                    </p>
                    <p>
                      Used: {formatDurationHM(maintenance.usedHours)} · Remaining:{" "}
                      {formatDurationHM(Math.max(0, maintenance.remaining ?? 0))}
                    </p>
                  </div>
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
                  {tenant?.maintenanceCarryoverMode === "carry" && !!maintenance.carriedHours && (
                    <p>
                      Carried from previous months:{" "}
                      <span className="text-foreground">{maintenance.carriedHours.toFixed(1)}h</span>
                    </p>
                  )}
                  <p className="text-xs">
                    We track all maintenance time here so you always know how much support you have available.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Maintenance work log</h2>
            <p className="text-sm text-muted-foreground">
              A record of the work we&apos;ve logged against your maintenance plan.
            </p>
          </div>
          {isEntriesLoading && <p className="text-sm text-muted-foreground">Loading recent maintenance work…</p>}
          {isEntriesError && (
            <p className="text-sm text-destructive">Unable to load maintenance work history right now.</p>
          )}
          {!isEntriesLoading && !isEntriesError && entries && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No maintenance work has been logged yet.</p>
          )}
          {!isEntriesLoading &&
            !isEntriesError &&
            entries &&
            thisMonthEntries.length > 0 && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">This month</p>
                <div className="space-y-2">
                  {thisMonthEntries.map((entry) => (
                    <div key={entry.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {formatDurationHM(entry.durationHours)}
                        </span>
                        <span>{formatEntryDate(entry.date)}</span>
                      </div>
                      {entry.taskTitle && (
                        <p className="text-xs text-foreground">Task: {entry.taskTitle}</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground">Notes: {entry.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          {!isEntriesLoading && !isEntriesError && previousByMonth.length > 0 && (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Previous months</p>
              <div className="space-y-4">
                {previousByMonth.map((group) => (
                  <div key={group.month} className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                      {formatMonthKey(group.month)}
                    </p>
                    <div className="space-y-2">
                      {group.entries.map((entry) => (
                        <div key={entry.id} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-foreground">
                              {formatDurationHM(entry.durationHours)}
                            </span>
                            <span>{formatEntryDate(entry.date)}</span>
                          </div>
                          {entry.taskTitle && (
                            <p className="text-xs text-foreground">Task: {entry.taskTitle}</p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-muted-foreground">Notes: {entry.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </ProtectedRoute>
  );
}

