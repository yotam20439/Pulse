import Link from "next/link";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";

import { CreatorLinkAdd } from "@/components/forms/creator-link-add";
import { PlatformBadge } from "@/components/platform-badge";
import { db } from "@/db";
import { campaignInfluencers, campaigns, influencerAccounts, influencers } from "@/db/schema";
import { addCreatorByLink } from "@/lib/actions/creators";
import { audienceTier } from "@/lib/creator-score";
import { getDictionary } from "@/lib/i18n";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { formatCount, formatPercent } from "@/lib/utils";

export const metadata = { title: "Influencers" };

/**
 * The roster is a record of who you've worked with, not a gate. Anyone can be
 * added from a pasted link at the top of this page, or inline while building a
 * campaign — the list below is memory, not a menu.
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
            campaignCount: sql<number>`count(distinct ${campaignInfluencers.campaignId})`.mapWith(Number),
          })
          .from(influencers)
          .innerJoin(influencerAccounts, eq(influencerAccounts.influencerId, influencers.id))
          .leftJoin(campaignInfluencers, eq(campaignInfluencers.accountId, influencerAccounts.id))
          .leftJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
          .groupBy(influencers.id, influencerAccounts.id)
          .orderBy(desc(influencerAccounts.followerCount));

  // One row per creator, accounts collapsed underneath.
  const creators = new Map<
    string,
    {
      id: string;
      name: string;
      tags: string[];
      totalFollowers: number;
      campaigns: number;
      accounts: { platform: string; handle: string; followers: number | null; er: number | null }[];
    }
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
      platform: row.platform,
      handle: row.handle,
      followers: row.followers,
      er: row.baselineEr,
    });
    creators.set(row.influencerId, entry);
  }

  const list = [...creators.values()].sort((a, b) => b.totalFollowers - a.totalFollowers);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">{dict.nav.influencers}</h1>
        <p className="mt-1 text-sm text-muted">{dict.creator.rosterIntro}</p>
      </header>

      <CreatorLinkAdd action={addCreatorByLink} dict={dict} />

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
          {dict.creator.noCreators}
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="eyebrow">
            {dict.metrics.creators} ({list.length})
          </h2>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="data-head">
                  <th className="eyebrow px-4 py-3 text-start font-normal">{dict.metrics.creators}</th>
                  <th className="eyebrow px-4 py-3 text-start font-normal">{dict.common.accounts}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.followers}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.engagementRate}</th>
                  <th className="eyebrow px-4 py-3 text-end font-normal">{dict.nav.campaigns}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((creator) => {
                  const weightedEr =
                    creator.totalFollowers > 0
                      ? creator.accounts.reduce(
                          (s, a) => s + (a.er ?? 0) * (a.followers ?? 0),
                          0,
                        ) / creator.totalFollowers
                      : null;

                  return (
                    <tr key={creator.id} className="data-row transition-colors hover:bg-sunken/60">
                      <td className="px-4 py-3">
                        <Link
                          href={`/influencers/${creator.id}`}
                          className="font-medium hover:underline"
                        >
                          {creator.name}
                        </Link>
                        <p className="text-xs text-muted">
                          {audienceTier(creator.totalFollowers)}
                          {creator.tags.length > 0 && ` · ${creator.tags.join(", ")}`}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap items-center gap-1.5">
                          {creator.accounts.map((a) => (
                            <PlatformBadge key={`${a.platform}${a.handle}`} platform={a.platform as never} />
                          ))}
                        </span>
                      </td>
                      <td className="tnum px-4 py-3 text-end">
                        {formatCount(creator.totalFollowers)}
                      </td>
                      <td className="tnum px-4 py-3 text-end">{formatPercent(weightedEr)}</td>
                      <td className="tnum px-4 py-3 text-end">{creator.campaigns}</td>
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
