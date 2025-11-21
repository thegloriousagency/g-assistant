"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What to expect next</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>What&apos;s included in your hosting plan (placeholder).</li>
              <li>How renewals work (placeholder).</li>
              <li>Contact us if you need to upgrade (placeholder).</li>
            </ul>
          </div>
        </section>
      </div>
    </ProtectedRoute>
  );
}

