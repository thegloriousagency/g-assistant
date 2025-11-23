"use client";

interface AnalyticsKpiProps {
  label: string;
  value: string;
  helper: string;
  tooltip?: string;
}

export function AnalyticsKpi({ label, value, helper, tooltip }: AnalyticsKpiProps) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        {tooltip && (
          <span
            className="cursor-help rounded-full border border-border px-1 text-[10px] font-semibold text-muted-foreground transition hover:text-foreground"
            title={tooltip}
            aria-label={tooltip}
          >
            ?
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

export function formatAnalyticsDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0m 00s";
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}
