import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { ConfirmDelete } from "@/components/forms/confirm-delete";
import {
  AccountStatsForm,
  AddAccountForm,
  RefreshStatsForm,
} from "@/components/forms/creator-account-forms";
import { PlatformBadge } from "@/components/platform-badge";
import { StatusPill } from "@/components/status-pill";
import {
  addAccountToCreator,
  deleteCreator,
  refreshAccountStats,
  updateAccountStats,
} from "@/lib/actions/creators";
import { getProfileCollector } from "@/lib/profile-collectors";
import { registerAllProfileCollectors } from "@/lib/profile-collectors/register";
import { audienceTier, scoreBand } from "@/lib/creator-score";
import { getDictionary } from "@/lib/i18n";
import { t } from "@/lib/i18n/dictionaries";
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

  registerAllProfileCollectors();

  const result = await getCreatorScore(influencerId);
  if (!result) notFound();

  const { creator, observed, history, score, confidence, components, usedObservedMetrics } = result;
  const band = scoreBand(score);
  const bandLabel = {
    "Strong fit": dict.creator.strongFit,
    "Reasonable fit": dict.creator.reasonableFit,
    "Weak fit": dict.creator.weakFit,
    "Poor fit": dict.creator.poorFit,
  }[band.label];
  const totalFollowers = creator.accounts.reduce((s, a) => s + (a.followerCount ?? 0), 0);

  const componentLabels: [string, number][] = [
    [dict.creator.engagement, components.engagement],
    [dict.creator.consistency, components.consistency],
    [dict.creator.growth, components.growth],
    [dict.creator.reliability, components.reliability],
  ];

  return (
    <div className="space-y-8">
      <header className="page-header flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{dict.nav.influencers}</p>
          <h1 className="mt-1 text-2xl font-semibold">{creator.displayName}</h1>
          <p className="tnum mt-1.5 text-sm text-muted">
            {formatCount(totalFollowers)} {dict.metrics.followers} ·{" "}
            {audienceTier(totalFollowers)} · {creator.accounts.length} {dict.common.accounts.toLowerCase()}
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
          <p className="eyebrow">{dict.creator.score}</p>
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
            {bandLabel}
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
            {Math.round(confidence * 100)}% {dict.creator.confidence} ·{" "}
            {usedObservedMetrics
              ? t(dict.creator.confidenceFrom, { n: observed.measuredCount })
              : dict.creator.confidenceManual}
          </p>
        </div>
      </header>

      {/* Observed vs claimed. This contrast is the reason the page exists. */}
      <section className="space-y-3">
        <h2 className="section-head eyebrow">{dict.creator.measured}</h2>
        {observed.measuredCount === 0 ? (
          <p className="empty text-sm text-muted">
            {dict.creator.noMeasured}
          </p>
        ) : (
          <dl className="card grid grid-cols-2 overflow-hidden sm:grid-cols-5">
            {[
              { label: dict.metrics.engagementRate, value: formatPercent(observed.engagementRate) },
              { label: dict.creator.avgLikes, value: formatCount(observed.avgLikes) },
              { label: dict.creator.avgComments, value: formatCount(observed.avgComments) },
              { label: dict.creator.avgViews, value: formatCount(observed.avgViews) },
              { label: dict.metrics.reach, value: formatCount(observed.avgReach) },
            ].map((item) => (
              <div key={item.label} className="border-e border-line p-4 last:border-e-0">
                <dt className="eyebrow truncate">{item.label}</dt>
                <dd className="tnum mt-1.5 text-xl leading-none">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-xs text-muted">
          {t(dict.creator.measuredCount, {
            measured: observed.measuredCount,
            total: observed.postCount,
          })}
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="section-head eyebrow">{dict.creator.accounts}</h2>

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
                  <span
                    className="rounded-full bg-sunken px-2 py-0.5"
                    title={
                      account.statsSource === "manual"
                        ? dict.creator.sourceManual
                        : dict.creator.sourceApi
                    }
                  >
                    {account.statsSource}
                    {account.followersSyncedAt &&
                      ` · ${new Date(account.followersSyncedAt).toISOString().slice(0, 10)}`}
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3 border-t border-line pt-3">
                <RefreshStatsForm
                  action={refreshAccountStats}
                  accountId={account.id}
                  influencerId={creator.id}
                  dict={dict}
                  provider={
                    getProfileCollector(account.platform)?.isConfigured()
                      ? getProfileCollector(account.platform)!.source
                      : null
                  }
                />

                <details>
                  <summary className="cursor-pointer text-xs text-muted hover:text-ink">
                    {dict.creator.enterManually}
                  </summary>
                  <div className="pt-3">
                    <AccountStatsForm action={updateAccountStats} account={account} dict={dict} />
                  </div>
                </details>
              </div>
            </li>
          ))}
        </ul>

        <AddAccountForm action={addAccountToCreator} influencerId={creator.id} dict={dict} />
      </section>

      <section className="space-y-3">
        <h2 className="section-head eyebrow">
          {dict.creator.history} ({history.length})
        </h2>

        {history.length === 0 ? (
          <p className="empty text-sm text-muted">
            {dict.creator.noHistory}
          </p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="data-head">
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
                  <tr key={row.campaignId} className="data-row transition-colors hover:bg-sunken/60">
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
      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="section-head eyebrow">{dict.danger.zone}</h2>
        <ConfirmDelete
          action={deleteCreator}
          confirmValue={creator.displayName}
          hidden={{ influencerId: creator.id }}
          dict={dict}
          triggerLabel={dict.danger.deleteCreator}
          title={t(dict.danger.deleteCreatorTitle, { name: creator.displayName })}
          consequence={dict.danger.deleteCreatorWhat}
          forceLabel={
            observed.postCount > 0
              ? t(dict.danger.forceCreator, { posts: observed.postCount })
              : undefined
          }
        />
      </section>

    </div>
  );
}