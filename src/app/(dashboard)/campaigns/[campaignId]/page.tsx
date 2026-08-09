import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ContributionTable } from "@/components/campaign/contribution-table";
import { IndexTile } from "@/components/campaign/index-tile";
import { InsightsPanel } from "@/components/campaign/insights-panel";
import { KpiProgress } from "@/components/campaign/kpi-progress";
import { MetricStrip } from "@/components/campaign/metric-strip";
import { PostTable } from "@/components/campaign/post-table";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  getCampaign,
  getContribution,
  getHistory,
  getInsights,
  getKpiProgress,
  getPosts,
  getTotals,
} from "@/lib/queries/campaign";
import { requireBrandAccess } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  return { title: campaign?.name ?? "Campaign" };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  // Authorisation is on the campaign's brand, resolved from the row itself —
  // never from a brandId in the URL, which the user controls.
  const { role } = await requireBrandAccess(campaign.brandId);

  const [totals, history, insights, postRows] = await Promise.all([
    getTotals(campaignId),
    getHistory(campaignId),
    getInsights(campaignId),
    getPosts(campaignId),
  ]);

  const [kpis, contribution] = await Promise.all([
    getKpiProgress(campaignId, totals),
    getContribution(campaignId, totals.reach),
  ]);

  const latest = history.at(-1);
  const weekAgo = history.at(-8);
  const components = (latest?.indexInputs ?? null) as {
    prominence?: Record<string, number>;
    effectiveness?: Record<string, number>;
  } | null;

  return (
    <div
      style={{ "--brand": campaign.brandAccent } as React.CSSProperties}
      className="space-y-8"
    >
      <header className="space-y-3">
        <Link
          href={`/brands/${campaign.brandId}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {campaign.brandName}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {campaign.objective ?? "No objective set"}
            </p>
            <p className="tnum mt-2 text-xs text-muted">
              {campaign.startDate} → {campaign.endDate ?? "open"} ·{" "}
              {campaign.status.toLowerCase()} · budget{" "}
              {formatMoney(campaign.budget, campaign.currency)}
            </p>
          </div>

          {role !== "VIEWER" && (
            <div className="flex gap-2">
              <Link
                href={`/campaigns/${campaign.id}/posts/new`}
                className="h-9 rounded-md border border-line px-4 text-sm font-medium leading-9 hover:bg-sunken"
              >
                Add post
              </Link>
              <Link
                href={`/campaigns/${campaign.id}/settings`}
                className="h-9 rounded-md bg-brand px-4 text-sm font-medium leading-9 text-brand-contrast"
              >
                Edit campaign
              </Link>
            </div>
          )}
        </div>
      </header>

      <MetricStrip totals={totals} currency={campaign.currency} />

      <div className="grid gap-4 lg:grid-cols-2">
        <IndexTile
          label="Prominence"
          hebrew="מדד בולטות"
          score={latest?.prominenceIndex ?? null}
          delta={
            latest?.prominenceIndex != null && weekAgo?.prominenceIndex != null
              ? latest.prominenceIndex - weekAgo.prominenceIndex
              : null
          }
          components={
            components?.prominence
              ? [
                  { label: "Volume", value: components.prominence.volume ?? 0 },
                  { label: "Breadth", value: components.prominence.breadth ?? 0 },
                  { label: "Amplification", value: components.prominence.amplification ?? 0 },
                ]
              : undefined
          }
        />
        <IndexTile
          label="Effectiveness"
          hebrew="מדד אפקטיביות"
          score={latest?.effectivenessIndex ?? null}
          delta={
            latest?.effectivenessIndex != null && weekAgo?.effectivenessIndex != null
              ? latest.effectivenessIndex - weekAgo.effectivenessIndex
              : null
          }
          components={
            components?.effectiveness
              ? [
                  { label: "Eng. quality", value: components.effectiveness.quality ?? 0 },
                  { label: "Cost efficiency", value: components.effectiveness.efficiency ?? 0 },
                  { label: "KPI attainment", value: components.effectiveness.attainment ?? 0 },
                ]
              : undefined
          }
        />
      </div>

      <TrendChart data={history} />

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <section className="min-w-0 space-y-3">
          <h2 className="eyebrow">Creator contribution</h2>
          <ContributionTable rows={contribution} currency={campaign.currency} />
        </section>

        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="eyebrow">Target progress</h2>
            <div className="rounded-lg border border-line bg-surface p-5">
              <KpiProgress kpis={kpis} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="eyebrow">Insights</h2>
            <InsightsPanel insights={insights} />
          </section>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="eyebrow">Posts</h2>
        <PostTable posts={postRows} />
      </section>
    </div>
  );
}
