import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { ChevronRight } from "lucide-react";

import { CreatorLinkAdd } from "@/components/forms/creator-link-add";
import { EditableCell } from "@/components/forms/inline-edit";
import { PlatformBadge } from "@/components/platform-badge";
import { db } from "@/db";
import { campaignInfluencers, campaigns, influencerAccounts, influencers } from "@/db/schema";
import { addCreatorByLink, updateAccountField, updateCreatorField } from "@/lib/actions/creators";
import { audienceTier } from "@/lib/creator-score";
import { getDictionary } from "@/lib/i18n";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { formatCount, formatPercent } from "@/lib/utils";

export const metadata = { title: "Influencers" };

/**
 * The roster is a record of who you've worked with, not a gate: anyone can be
 * added from a pasted link at the top. Names, tags, followers, and engagement
 * rate are editable in place — the common corrections after an import, and not
 * worth a page navigation each.
 */
export default async function InfluencersPage() {
  const [user, dict] = await Promise.all([requireUser(), getDictionary()]);
  const ids = accessibleBrandIds(user);

  const rows =
    ids !== null && ids.length === 0
      ? []
      : await db
          .select({
            influencerId: influencers.id,
            name: influencers.displayName,
            tags: influencers.tags,
            accountId: influencerAccounts.id,
            handle: influencerAccounts.handle,
            platform: influencerAccounts.platform,
            followers: influencerAccounts.followerCount,
            baselineEr: influencerAccounts.baselineEngagementRate,
            statsSource: influencerAccounts.statsSource,
            campaignCount: sql<number>`count(distinct ${campaignInfluencers.campaignId})`.mapWith(Number),
          })
          .from(influencers)
          .innerJoin(influencerAccounts, eq(influencerAccounts.influencerId, influencers.id))
          .leftJoin(campaignInfluencers, eq(campaignInfluencers.accountId, influencerAccounts.id))
          .leftJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
          .groupBy(influencers.id, influencerAccounts.id)
          .orderBy(desc(influencerAccounts.followerCount));

  type Account = {
    id: string;
    platform: string;
    handle: string;
    followers: number | null;
    er: number | null;
    source: string;
  };

  const creators = new Map<
    string,
    { id: string; name: string; tags: string[]; totalFollowers: number; campaigns: number; accounts: Account[] }
  >();

  for (const row of rows) {
    const entry = creators.get(row.influencerId) ?? {
      id: row.influencerId,
      name: row.name,
      tags: row.tags ?? [],
      totalFollowers: 0,
      campaigns: 0,
      accounts: [],
    };
    entry.totalFollowers += row.followers ?? 0;
    entry.campaigns = Math.max(entry.campaigns, row.campaignCount);
    entry.accounts.push({
      id: row.accountId,
      platform: row.platform,
      handle: row.handle,
      followers: row.followers,
      er: row.baselineEr,
      source: row.statsSource,
    });
    creators.set(row.influencerId, entry);
  }

  const list = [...creators.values()].sort((a, b) => b.totalFollowers - a.totalFollowers);
  const totalReach = list.reduce((s, c) => s + c.totalFollowers, 0);

  return (
    <div className="space-y-8">
      <header className="page-header">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">{dict.nav.influencers}</p>
            <h1 className="mt-1.5 text-3xl font-bold tracking-[-0.03em]">
              {list.length} {dict.metrics.creators.toLowerCase()}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted">{dict.creator.rosterIntro}</p>
          </div>

          {list.length > 0 && (
            <dl className="flex gap-8">
              <div>
                <dt className="eyebrow">{dict.metrics.followers}</dt>
                <dd className="tnum mt-1 text-2xl font-semibold">{formatCount(totalReach)}</dd>
              </div>
              <div>
                <dt className="eyebrow">{dict.common.accounts}</dt>
                <dd className="tnum mt-1 text-2xl font-semibold">{rows.length}</dd>
              </div>
            </dl>
          )}
        </div>
      </header>

      <CreatorLinkAdd action={addCreatorByLink} dict={dict} />

      {list.length === 0 ? (
        <p className="empty text-sm text-muted">{dict.creator.noCreators}</p>
      ) : (
        <section className="space-y-3">
          <h2 className="section-head eyebrow">{dict.metrics.creators}</h2>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="data-head">
                  <th className="eyebrow px-4 text-start font-normal">{dict.metrics.creators}</th>
                  <th className="eyebrow px-4 text-start font-normal">{dict.common.accounts}</th>
                  <th className="eyebrow px-4 text-end font-normal">{dict.metrics.followers}</th>
                  <th className="eyebrow px-4 text-end font-normal">{dict.metrics.engagementRate}</th>
                  <th className="eyebrow px-4 text-end font-normal">{dict.nav.campaigns}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {list.map((creator) => {
                  const weightedEr =
                    creator.totalFollowers > 0
                      ? creator.accounts.reduce((s, a) => s + (a.er ?? 0) * (a.followers ?? 0), 0) /
                        creator.totalFollowers
                      : null;
                  const primary = creator.accounts[0];

                  return (
                    <tr key={creator.id} className="data-row group">
                      <td className="px-4 py-3">
                        <EditableCell
                          action={updateCreatorField}
                          hidden={{ influencerId: creator.id }}
                          name="displayName"
                          value={creator.name}
                          className="font-medium"
                        />
                        <p className="mt-0.5 text-xs text-muted">
                          {audienceTier(creator.totalFollowers)}
                          {creator.tags.length > 0 && ` · ${creator.tags.join(", ")}`}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {creator.accounts.map((a) => (
                            <span key={a.id} className="inline-flex items-center gap-1">
                              <PlatformBadge platform={a.platform as never} />
                            </span>
                          ))}
                        </span>
                      </td>

                      <td className="tnum px-4 py-3 text-end">
                        {creator.accounts.length === 1 && primary ? (
                          <EditableCell
                            action={updateAccountField}
                            hidden={{ accountId: primary.id }}
                            name="followerCount"
                            type="number"
                            align="end"
                            value={primary.followers}
                            format={(v) => formatCount(v as number)}
                          />
                        ) : (
                          formatCount(creator.totalFollowers)
                        )}
                      </td>

                      <td className="tnum px-4 py-3 text-end">
                        {creator.accounts.length === 1 && primary ? (
                          <EditableCell
                            action={updateAccountField}
                            hidden={{ accountId: primary.id }}
                            name="baselineEngagementRate"
                            type="number"
                            align="end"
                            value={primary.er}
                            format={(v) => formatPercent(v as number)}
                          />
                        ) : (
                          formatPercent(weightedEr)
                        )}
                      </td>

                      <td className="tnum px-4 py-3 text-end text-muted">{creator.campaigns}</td>

                      <td className="px-2 py-3">
                        <Link
                          href={`/influencers/${creator.id}`}
                          aria-label={creator.name}
                          className="row-actions inline-flex rounded p-1 text-muted hover:bg-sunken hover:text-ink"
                        >
                          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
