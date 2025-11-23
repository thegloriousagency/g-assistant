"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCpanelSession, useHostingAccountSummary } from "@/hooks/useHosting";
import { ApiError } from "@/lib/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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

export default function HostingStatusPage() {
  const { tenant } = useAuth();
  const cpanelSession = useCpanelSession();
  const [cpanelError, setCpanelError] = useState<string | null>(null);
  const hasHostingCredentials = Boolean(tenant?.hostingCpanelUsername);
  const {
    data: accountSummary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
  } = useHostingAccountSummary(hasHostingCredentials);

  const handleGoToCpanel = async () => {
    setCpanelError(null);
    try {
      const result = await cpanelSession.mutateAsync();
      if (result?.url) {
        const newWindow = window.open(result.url, "_blank", "noopener,noreferrer");
        if (!newWindow) {
          setCpanelError("Your browser blocked the cPanel window. Please allow pop-ups and try again.");
        }
      } else {
        setCpanelError("We couldn’t open cPanel right now. Please try again later.");
      }
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "We couldn’t open cPanel right now. Please try again later.";
      setCpanelError(message);
    }
  };
  const status = computeStatus(tenant?.hostingExpirationDate);
  const ordered = Boolean(tenant?.hostingOrdered);
  const formattedEnd = formatEndDate(tenant?.hostingExpirationDate);

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

  return (
    <ProtectedRoute>
      <div className="space-y-8">
        <section className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Hosting status</h2>
            <p className="text-sm text-muted-foreground">
              Overview of your hosting plan and renewal.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Hosting</p>
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
              <p>
                {status.state === "active" && formattedEnd
                  ? `Paid through ${formattedEnd}`
                  : status.state === "expired" && formattedEnd
                    ? `Expired on ${formattedEnd}`
                    : ordered
                      ? "No expiration date set"
                      : "Service not ordered"}
              </p>
              {shouldShowRenew && (
                <Button type="button" size="sm" variant="outline" asChild>
                  {/* TODO: Replace href with real renew URL */}
                  <a href="#TODO-renew-hosting">Renew hosting</a>
                </Button>
              )}
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-card/40 p-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Storage usage</p>
                {hasHostingCredentials ? (
                  <>
                    {isSummaryLoading ? (
                      <p className="text-sm">Loading storage usage…</p>
                    ) : isSummaryError ? (
                      <p className="text-sm text-destructive">
                        We couldn’t load storage usage right now. Please try again later.
                      </p>
                    ) : (
                      <p className="text-sm text-foreground font-medium">
                        {describeStorageUsage(accountSummary?.diskUsedMb ?? null, accountSummary?.storageMb ?? null)}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm">Connect your cPanel account to view storage usage.</p>
                )}
              </div>
              {hasHostingCredentials && !isSummaryLoading && !isSummaryError && accountSummary && (
                renderStorageProgress(accountSummary.diskUsedMb, accountSummary.storageMb)
              )}
            </div>
          </div>
          <div className="space-y-4">
            {!hasHostingCredentials && (
              <p className="text-sm text-muted-foreground">
                We can’t load hosting details until your cPanel account is connected. Contact support if you believe this
                is a mistake.
              </p>
            )}

            {hasHostingCredentials && (
              <>
                {isSummaryLoading && (
                  <p className="text-sm text-muted-foreground">Loading plan details…</p>
                )}
                {isSummaryError && (
                  <p className="text-sm text-destructive">
                    We couldn’t load your hosting plan right now. Please try again later.
                  </p>
                )}
                {accountSummary && !isSummaryError && (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-muted px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Plan name</p>
                      <p className="text-lg font-semibold text-foreground">
                        {accountSummary.planName ?? "Plan information unavailable"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <HostingStatCard
                        label="Storage"
                        value={formatCapacity(accountSummary.storageMb)}
                        helper="Total disk allocation (MB)"
                      />
                      <HostingStatCard
                        label="Databases"
                        value={formatCount(accountSummary.databases)}
                        helper="MySQL / MariaDB"
                      />
                      <HostingStatCard
                        label="FTP users"
                        value={formatCount(accountSummary.ftpUsers)}
                        helper="Maximum FTP accounts"
                      />
                      <HostingStatCard
                        label="Monthly bandwidth"
                        value={formatCapacity(accountSummary.bandwidthMb)}
                        helper="Data transfer allowance (MB)"
                      />
                      <HostingStatCard
                        label="Subdomains"
                        value={formatCount(accountSummary.subdomains)}
                        helper="Maximum subdomains"
                      />
                      <HostingStatCard
                        label="Email accounts"
                        value={formatCount(accountSummary.emailAccounts)}
                        helper="Mailbox slots"
                      />
                      <HostingStatCard
                        label="Email quota"
                        value={formatCapacity(accountSummary.emailQuotaMb)}
                        helper="Per-mailbox quota (MB)"
                        spanFull
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="pt-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    className="bg-black text-white hover:bg-black/90 disabled:bg-muted disabled:text-muted-foreground"
                    disabled={cpanelSession.isPending || !hasHostingCredentials}
                  >
                    {cpanelSession.isPending ? "Connecting…" : "Go to cPanel"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Proceed to cPanel?</AlertDialogTitle>
                    <AlertDialogDescription>
                      cPanel is intended for experienced users. Changes there impact your live site, email,
                      and database. Continue only if you know what you’re doing.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleGoToCpanel}>Open cPanel</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!hasHostingCredentials && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact support to connect your hosting account.
                </p>
              )}
              {cpanelError && <p className="mt-2 text-sm text-destructive">{cpanelError}</p>}
            </div>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}

function formatCapacity(value: number | null) {
  if (value === null) {
    return "Unlimited";
  }
  return `${value.toLocaleString()} MB`;
}

function formatCapacityValue(value: number | null) {
  if (value === null) {
    return "Unknown";
  }
  return `${value.toLocaleString()} MB`;
}

function describeStorageUsage(usedMb: number | null, totalMb: number | null) {
  if (totalMb === null) {
    return `${formatCapacityValue(usedMb)} used · Unlimited plan`;
  }
  if (usedMb === null) {
    return `Up to ${formatCapacity(totalMb)} available`;
  }
  return `${formatCapacityValue(usedMb)} of ${formatCapacity(totalMb)} used`;
}

function renderStorageProgress(usedMb: number | null, totalMb: number | null) {
  const safeUsed = Math.max(0, usedMb ?? 0);
  const normalizedTotal = totalMb && totalMb > 0 ? totalMb : Math.max(safeUsed, 1);
  const percent = Math.min(100, Math.max(0, (safeUsed / normalizedTotal) * 100));
  const barColor =
    percent >= 90 ? "bg-red-500" : percent >= 70 ? "bg-amber-400" : "bg-emerald-500";

  return (
    <div>
      <div className="mt-1 h-2 w-full rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{percent.toFixed(1)}% of storage used</p>
    </div>
  );
}

function formatCount(value: number | null) {
  if (value === null) {
    return "Unlimited";
  }
  return value.toLocaleString();
}

function HostingStatCard({
  label,
  value,
  helper,
  spanFull,
}: {
  label: string;
  value: string;
  helper?: string;
  spanFull?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background/80 p-4 shadow-sm",
        spanFull && "sm:col-span-2 lg:col-span-3",
      )}
    >
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
    </div>
  );
}

