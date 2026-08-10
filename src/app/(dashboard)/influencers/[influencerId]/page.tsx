import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { AccountStatsForm, AddAccountForm } from "@/components/forms/creator-account-forms";
import { PlatformBadge } from "@/components/platform-badge";
import { StatusPill } from "@/components/status-pill";
import { addAccountToCreator, updateAccountStats } from "@/lib/actions/creators";
import { audienceTier, scoreBand } from "@/lib/creator-score";
import { getDictionary } from "@/lib/i18n";
import { getCreatorScore } from "@/lib/queries/creators";
import { requireUser } from "@/lib/rbac";
import { cn, formatCount, formatMoney, formatPercent } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ influencerId: string }> }) {
  const { influencerId } = await params;
  const result = await getCreatorScore(influencerId);
  return { title: result?.creator.displayName ?? "Creator" };
}

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ influencerId: string }>;
}) {
  const { influencerId } = await params;
  await requireUser();
  const dict = await getDictionary();

  const result = await getCreatorScore(influencerId);
  if (!result) notFound();

  const { creator, observed, history, score, confidence, components, usedObservedMetrics } = result;
  const band = scoreBand(score);
  const totalFollowers = creator.accounts.reduce((s, a) => s + (a.followerCount ?? 0), 0);

  const componentLabels: [string, number][] = [
    ["Engagement", components.engagement],
    ["Consistency", components.consistency],
    ["Growth", components.growth],
    ["Reliability", components.reliability],
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{dict.nav.influencers}</p>
          <h1 className="mt-1 text-2xl font-semibold">{creator.displayName}</h1>
          <p className="tnum mt-1.5 text-sm text-muted">
            {formatCount(totalFollowers)} {dict.metrics.followers} ·{" "}
            {audienceTier(totalFollowers)} · {creator.accounts.length} accounts
          </p>
          {creator.tags.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {creator.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-sunken px-2.5 py-1 text-xs text-ink-soft">
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quality score, with the confidence stated rather than implied. */}
        <div className="card min-w-56 p-5">
          <p className="eyebrow">Creator score</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="tnum text-4xl font-medium leading-none">{score.toFixed(0)}</span>
            <span className="text-xs text-muted">/ 100</span>
          </div>
          <p
            className={cn(
              "mt-1 text-sm font-medium",
              band.tone === "positive" && "text-positive",
              band.tone === "warning" && "text-warning",
              band.tone === "critical" && "text-critical",
            )}
          >
            {band.label}
          </p>

          <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
            {componentLabels.map(([label, value]) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <dt className="w-24 shrink-0 text-muted">{label}</dt>
                <dd className="h-1 flex-1 rounded-full bg-sunken">
                  <div
                    className="h-1 rounded-full bg-ink-soft/40"
                    style={{ width: `${Math.round(value * 100)}%` }}
                  />
                </dd>
                <dd className="tnum w-7 text-end text-muted">{Math.round(value * 100)}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            {Math.round(confidence * 100)}% confidence ·{" "}
            {usedObservedMetrics
              ? `based on ${observed.measuredCount} tracked posts`
              : "based on entered profile stats only"}
          </p>
        </div>
      </header>

      {/* Observed vs claimed. This contrast is the reason the page exists. */}
      <section className="space-y-3">
        <h2 className="eyebrow">Measured from tracked posts</h2>
        {observed.measuredCount === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-sm text-muted">
            Nothing measured yet. These fill in automatically once this creator has posts on a
            campaign and the collector has run — and once they do, the score stops relying on
            numbers typed in by hand.
          </p>
        ) : (
          <dl className="card grid grid-cols-2 overflow-hidden sm:grid-cols-5">
            {[
              { label: dict.metrics.engagementRate, value: formatPercent(observed.engagementRate) },
              { label: `Avg ${dict.metrics.likes.toLowerCase()}`, value: formatCount(observed.avgLikes) },
              { label: `Avg ${dict.metrics.comments.toLowerCase()}`, value: formatCount(observed.avgComments) },
              { label: `Avg ${dict.metrics.views.toLowerCase()}`, value: formatCount(observed.avgViews) },
              { label: `Avg ${dict.metrics.reach.toLowerCase()}`, value: formatCount(observed.avgReach) },
            ].map((item) => (
              <div key={item.label} className="border-e border-line p-4 last:border-e-0">
                <dt className="eyebrow truncate">{item.label}</dt>
                <dd className="tnum mt-1.5 text-xl leading-none">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-muted">
          {observed.measuredCount} of {observed.postCount} tracked posts have metrics.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Social accounts</h2>

        <ul className="space-y-3">
          {creator.accounts.map((account) => (
            <li key={account.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <PlatformBadge platform={account.platform} />
                <a
                  href={account.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tnum inline-flex items-center gap-1 font-medium hover:underline"
                >
                  @{account.handle}
                  <ExternalLink className="size-3 text-muted" aria-hidden />
                </a>

                <div className="tnum ms-auto flex flex-wrap items-center gap-5 text-xs text-muted">
                  <span>
                    {formatCount(account.followerCount)} {dict.metrics.followers}
                  </span>
                  <span>ER {formatPercent(account.baselineEngagementRate)}</span>
                  <span>♥ {formatCount(account.avgLikes)}</span>
                  <span>▶ {formatCount(account.avgViews)}</span>
                  <span className="rounded-full bg-sunken px-2 py-0.5">
                    {account.statsSource}
                  </span>
                </div>
              </div>

              <details className="mt-3 border-t border-line pt-3">
                <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                  Update stats
                </summary>
                <div className="pt-3">
                  <AccountStatsForm action={updateAccountStats} account={account} />
                </div>
              </details>
            </li>
          ))}
        </ul>

        <AddAccountForm action={addAccountToCreator} influencerId={creator.id} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Campaign history ({history.length})</h2>

        {history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-sm text-muted">
            Not booked on anything yet.
          </p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.campaigns}</th>
                  <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.brands}</th>
                  <th className="eyebrow px-4 py-3 text-start font-normal">{dict.campaign.status}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.campaign.delivered}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.campaign.cost}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.indices.effectiveness}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.campaignId} className="data-row hover:bg-sunken">
                    <td className="px-4 py-3">
                      <Link href={`/campaigns/${row.campaignId}`} className="font-medium hover:underline">
                        {row.campaignName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-ink-soft">
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ background: row.accentColor }}
                        />
                        {row.brandName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={row.status} dict={dict} />
                    </td>
                    <td
                      className={cn(
                        "tnum px-4 py-3 text-end",
                        !row.delivered && "text-warning",
                      )}
                    >
                      {row.published}/{row.planned}
                    </td>
                    <td className="tnum px-4 py-3 text-end">{formatMoney(row.spend)}</td>
                    <td className="tnum px-4 py-3 text-end">
                      {row.effectiveness?.toFixed(0) ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
