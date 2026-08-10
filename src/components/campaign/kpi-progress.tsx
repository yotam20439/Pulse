import { cn, formatCount, formatPercent } from "@/lib/utils";

type Kpi = {
  metric: string;
  target: number;
  actual: number;
  progress: number;
  inverted: boolean;
  weight: number;
};

const formatValue = (metric: string, value: number) =>
  metric === "ENGAGEMENT_RATE"
    ? formatPercent(value)
    : metric === "CPM" || metric === "CPE"
      ? value.toFixed(2)
      : formatCount(value);

export function KpiProgress({ kpis }: { kpis: Kpi[] }) {
  if (kpis.length === 0) {
    return (
      <p className="text-sm text-muted">
        No KPIs set. Targets make the effectiveness score meaningful — add them in campaign
        settings.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {kpis.map((kpi) => {
        const pct = Math.round(kpi.progress * 100);
        const met = kpi.progress >= 1;
        return (
          <li key={kpi.metric}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="capitalize">{kpi.metric.replace(/_/g, " ").toLowerCase()}</span>
              <span className="tnum text-xs text-muted">
                {formatValue(kpi.metric, kpi.actual)} / {formatValue(kpi.metric, kpi.target)}
                {kpi.inverted && " (lower is better)"}
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-sunken">
                <div
                  className={cn("h-1.5 rounded-full", met ? "bg-positive" : "bg-brand")}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span className={cn("tnum w-11 text-end text-xs", met ? "text-positive" : "text-muted")}>
                {pct}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
