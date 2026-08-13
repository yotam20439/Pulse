import type { Dictionary } from "@/lib/i18n";
import type { CampaignDay } from "@/db/schema";
import type { CampaignTotals } from "@/lib/queries/campaign";
import { cn, formatCount, formatMoney, formatPercent } from "@/lib/utils";

/**
 * Headline totals with a sparkline behind each one.
 *
 * A number alone answers "how much"; the sparkline answers "and is that still
 * happening" — which is the question an analyst actually has. It costs one
 * inline SVG per tile and no extra query, since the daily rollups are already
 * loaded for the chart.
 */
function Spark({ points }: { points: number[] }) {
  if (points.length < 3) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const span = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 20 - ((v - min) / span) * 18;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="mt-2 h-5 w-full" aria-hidden>
      <path
        d={`${d} L 100 20 L 0 20 Z`}
        fill="var(--brand)"
        fillOpacity="0.07"
        stroke="none"
      />
      <path d={d} fill="none" stroke="var(--brand)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MetricStrip({
  totals,
  history,
  currency,
  dict,
}: {
  totals: CampaignTotals;
  history: CampaignDay[];
  currency: string;
  dict: Dictionary;
}) {
  const series = (key: "reach" | "impressions" | "engagements" | "clicks") =>
    history.map((h) => h[key] ?? 0);

  const items = [
    { label: dict.metrics.reach, value: formatCount(totals.reach), spark: series("reach") },
    { label: dict.metrics.impressions, value: formatCount(totals.impressions), spark: series("impressions") },
    { label: dict.metrics.engagements, value: formatCount(totals.engagements), spark: series("engagements") },
    { label: dict.metrics.engagementRate, value: formatPercent(totals.engagementRate), spark: [] },
    { label: dict.metrics.clicks, value: formatCount(totals.clicks), spark: series("clicks") },
    { label: dict.metrics.spend, value: formatMoney(totals.spend, currency), spark: [] },
    { label: dict.metrics.cpm, value: totals.cpm == null ? "—" : totals.cpm.toFixed(2), spark: [] },
    { label: dict.metrics.cpe, value: totals.cpe == null ? "—" : totals.cpe.toFixed(2), spark: [] },
  ];

  return (
    <dl className="tile grid grid-cols-2 overflow-hidden rounded-[var(--radius)] sm:grid-cols-4 xl:grid-cols-8">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            "border-line p-4",
            i % 2 === 0 && "border-e",
            i < items.length - 2 && "border-b",
            "sm:border-b-0 sm:border-e xl:[&:last-child]:border-e-0",
          )}
        >
          <dt className="eyebrow truncate">{item.label}</dt>
          <dd className="tnum mt-1.5 text-xl leading-none">{item.value}</dd>
          <Spark points={item.spark} />
        </div>
      ))}
    </dl>
  );
}
