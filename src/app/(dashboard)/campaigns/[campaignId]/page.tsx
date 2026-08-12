import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ContributionTable } from "@/components/campaign/contribution-table";
import { IndexTile } from "@/components/campaign/index-tile";
import { InsightsPanel } from "@/components/campaign/insights-panel";
import { KpiProgress } from "@/components/campaign/kpi-progress";
import { MetricStrip } from "@/components/campaign/metric-strip";
import { PostTable } from "@/components/campaign/post-table";
import { TrendChart } from "@/components/charts/trend-chart";
import { OwnerBadge } from "@/components/owner-badge";
import { StatusPill } from "@/components/status-pill";
import { getDictionary, getLocale } from "@/lib/i18n";
import { generateInsights } from "@/lib/insights";
import {
  getCampaign,
  getContribution,
  getHistory,
  getKpiProgress,
  getPlatformMix,
  getPosts,
  getTotals,
} from "@/lib/queries/campaign";
import { requireBrandAccess } from "@/lib/rbac";
import { formatCount, formatMoney } from "@/lib/utils";

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
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  // Authorisation is on the campaign's brand, resolved from the row itself —
  // never from a brandId in the URL, which the user controls.
  const { role } = await requireBrandAccess(campaign.brandId);

  const [totals, history, postRows, mix] = await Promise.all([
    getTotals(campaignId),
    getHistory(campaignId),
    getPosts(campaignId),
    getPlatformMix(campaignId),
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

  const start = new Date(campaign.startDate).getTime();
  const end = campaign.endDate ? new Date(campaign.endDate).getTime() : null;
  const insights = generateInsights({
    dict,
    history,
    contribution,
    posts: postRows,
    totals,
    kpis,
    currency: campaign.currency,
    daysElapsed: Math.max(1, Math.round((Date.now() - start) / 86_400_000)),
    daysTotal: end ? Math.max(1, Math.round((end - start) / 86_400_000)) : null,
  });

  const Chevron = locale === "he" ? ChevronRight : ChevronLeft;
  const totalMixReach = mix.reduce((s, m) => s + m.reach, 0) || 1;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Link
          href={`/brands/${campaign.brandId}`}
          className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink"
        >
          <Chevron className="size-4" aria-hidden />
          {campaign.brandName}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{campaign.name}</h1>
<StatusPill status={campaign.status} dict={dict} />
            </div>
            <p className="mt-1.5 text-sm text-muted">
              {campaign.objective ?? dict.campaign.noObjective}
            </p>
            <p className="tnum mt-2 text-xs text-muted">
              {campaign.startDate} → {campaign.endDate ?? dict.campaign.open} ·{" "}
              {formatMoney(campaign.budget, campaign.currency)} · {totals.postCount}{" "}
              {dict.metrics.posts.toLowerCase()} · {totals.creators}{" "}
              {dict.metrics.creators.toLowerCase()}
            </p>
            {campaign.ownerName && (
              <div className="mt-3">
                <OwnerBadge name={campaign.ownerName} email={campaign.ownerEmail} />
              </div>
            )}
            {campaign.notes && (
              <p className="mt-3 max-w-2xl rounded-md border-s-2 border-line-strong bg-sunken/60 px-3 py-2 text-sm text-ink-soft">
                {campaign.notes}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/campaigns/${campaign.id}/export`}
              className="h-9 rounded-md border border-line bg-surface px-4 text-sm font-medium leading-9 transition-colors hover:bg-sunken"
            >
              {dict.brand.export}
            </a>
            {role !== "VIEWER" && (
            <>
              <Link
                href={`/campaigns/${campaign.id}/posts/new`}
                className="h-9 rounded-md border border-line bg-surface px-4 text-sm font-medium leading-9 transition-colors hover:bg-sunken"
              >
                {dict.campaign.addPost}
              </Link>
              <Link
                href={`/campaigns/${campaign.id}/settings`}
                className="h-9 btn-primary rounded-md px-4 text-sm font-semibold leading-9"
              >
                {dict.campaign.edit}
              </Link>
            </>
            )}
          </div>
        </div>
      </header>

      <MetricStrip totals={totals} history={history} currency={campaign.currency} dict={dict} />

      <div className="grid gap-4 lg:grid-cols-2">
        <IndexTile
          label={dict.indices.prominence}
          native={dict.indices.prominenceNative}
          score={latest?.prominenceIndex ?? null}
          dict={dict}
          delta={
            latest?.prominenceIndex != null && weekAgo?.prominenceIndex != null
              ? latest.prominenceIndex - weekAgo.prominenceIndex
              : null
          }
          components={
            components?.prominence
              ? [
                  { label: dict.indices.volume, value: components.prominence.volume ?? 0 },
                  { label: dict.indices.breadth, value: components.prominence.breadth ?? 0 },
                  { label: dict.indices.amplification, value: components.prominence.amplification ?? 0 },
                ]
              : undefined
          }
        />
        <IndexTile
          label={dict.indices.effectiveness}
          native={dict.indices.effectivenessNative}
          score={latest?.effectivenessIndex ?? null}
          dict={dict}
          delta={
            latest?.effectivenessIndex != null && weekAgo?.effectivenessIndex != null
              ? latest.effectivenessIndex - weekAgo.effectivenessIndex
              : null
          }
          components={
            components?.effectiveness
              ? [
                  { label: dict.indices.quality, value: components.effectiveness.quality ?? 0 },
                  { label: dict.indices.efficiency, value: components.effectiveness.efficiency ?? 0 },
                  { label: dict.indices.attainment, value: components.effectiveness.attainment ?? 0 },
                ]
              : undefined
          }
        />
      </div>

      <TrendChart data={history} dict={dict} />

      <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section className="min-w-0 space-y-3">
          <h2 className="eyebrow">{dict.campaign.contribution}</h2>
          <ContributionTable rows={contribution} currency={campaign.currency} dict={dict} />
        </section>

        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="eyebrow">{dict.campaign.targets}</h2>
            <div className="card p-5">
              <KpiProgress kpis={kpis} />
            </div>
          </section>

          {mix.length > 1 && (
            <section className="space-y-3">
              <h2 className="eyebrow">{dict.campaign.platformMix}</h2>
              <div className="card space-y-3 p-5">
                <div className="flex h-2 overflow-hidden rounded-full bg-sunken">
                  {mix.map((m, i) => (
                    <div
                      key={m.platform}
                      title={m.platform}
                      style={{
                        width: `${(m.reach / totalMixReach) * 100}%`,
                        background: "var(--brand)",
                        opacity: 1 - i * 0.18,
                      }}
                    />
                  ))}
                </div>
                <ul className="space-y-1.5">
                  {mix.map((m, i) => (
                    <li key={m.platform} className="flex items-center gap-2 text-xs">
                      <span
                        aria-hidden
                        className="size-2 rounded-sm"
                        style={{ background: "var(--brand)", opacity: 1 - i * 0.18 }}
                      />
                      <span className="text-ink-soft">{m.platform.toLowerCase()}</span>
                      <span className="tnum ms-auto text-muted">
                        {formatCount(m.reach)} · {m.postCount}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="eyebrow">{dict.campaign.insights}</h2>
        <InsightsPanel insights={insights} dict={dict} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">{dict.campaign.posts}</h2>
        <PostTable posts={postRows} dict={dict} />
      </section>
    </div>
  );
}
