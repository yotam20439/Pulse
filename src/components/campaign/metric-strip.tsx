import { formatCount, formatMoney, formatPercent } from "@/lib/utils";
import type { CampaignTotals } from "@/lib/queries/campaign";

export function MetricStrip({ totals, currency }: { totals: CampaignTotals; currency: string }) {
  const items = [
    { label: "Reach", value: formatCount(totals.reach) },
    { label: "Impressions", value: formatCount(totals.impressions) },
    { label: "Engagements", value: formatCount(totals.engagements) },
    { label: "Eng. rate", value: formatPercent(totals.engagementRate) },
    { label: "Clicks", value: formatCount(totals.clicks) },
    { label: "Spend", value: formatMoney(totals.spend, currency) },
    { label: "CPM", value: totals.cpm == null ? "—" : totals.cpm.toFixed(2) },
    { label: "CPE", value: totals.cpe == null ? "—" : totals.cpe.toFixed(2) },
  ];

  return (
    <dl className="grid grid-cols-2 divide-line rounded-lg border border-line bg-surface sm:grid-cols-4 sm:divide-x xl:grid-cols-8">
      {items.map((item) => (
        <div key={item.label} className="border-b border-line px-4 py-3 last:border-b-0 xl:border-b-0">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="tnum mt-1 text-lg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
