import { desc, eq, inArray, sql } from "drizzle-orm";

import Link from "next/link";
import { PlatformBadge } from "@/components/platform-badge";
import { db } from "@/db";
import {
  campaignInfluencers,
  campaigns,
  influencerAccounts,
  influencers,
} from "@/db/schema";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { formatCount, formatPercent } from "@/lib/utils";

export const metadata = { title: "Influencers" };

/**
 * The roster is global, but this view is not: a user only sees creators who
 * have worked on a brand they can access, so campaign relationships don't leak
 * between clients.
 */
export default async function InfluencersPage() {
  const [user, dict] = await Promise.all([requireUser(), getDictionary()]);
  const ids = accessibleBrandIds(user);

  const rows =
    ids !== null && ids.length === 0
      ? []
      : await db
          .select({
            id: influencerAccounts.id,
            name: influencers.displayName,
            handle: influencerAccounts.handle,
            platform: influencerAccounts.platform,
            followers: influencerAccounts.followerCount,
            baselineEr: influencerAccounts.baselineEngagementRate,
            campaignCount: sql<number>`count(distinct ${campaignInfluencers.campaignId})`.mapWith(Number),
          })
          .from(influencerAccounts)
          .innerJoin(influencers, eq(influencerAccounts.influencerId, influencers.id))
          .innerJoin(campaignInfluencers, eq(campaignInfluencers.accountId, influencerAccounts.id))
          .innerJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
          .where(ids === null ? undefined : inArray(campaigns.brandId, ids))
          .groupBy(influencerAccounts.id, influencers.displayName)
          .orderBy(desc(influencerAccounts.followerCount));

  if (rows.length === 0) {
    return (
      <div className="max-w-md py-16">
        <h1 className="text-2xl font-semibold tracking-tight">No creators yet</h1>
        <p className="mt-2 text-sm text-muted">
          Creators appear here once they&apos;re added to a campaign on a brand you can access.
        </p>
        <Link
          href="/influencers/new"
          className="mt-5 inline-flex h-9 items-center rounded-md bg-ink px-4 text-sm font-medium text-white"
        >
          Add creator
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{dict.nav.influencers}</h1>
        <Link
          href="/influencers/new"
          className="h-9 rounded-md bg-ink px-4 text-sm font-medium leading-9 text-white"
        >
          Add creator
        </Link>
      </div>

      <div className="overflow-hidden card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.metrics.creators}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.followers}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.engagementRate}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.nav.campaigns}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0 hover:bg-sunken">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <PlatformBadge platform={row.platform} />
                    <div>
                      <p className="font-medium">{row.name}</p>
                      <p className="tnum text-xs text-muted">@{row.handle}</p>
                    </div>
                  </div>
                </td>
                <td className="tnum px-4 py-3 text-end">{formatCount(row.followers)}</td>
                <td className="tnum px-4 py-3 text-end">{formatPercent(row.baselineEr)}</td>
                <td className="tnum px-4 py-3 text-end">{row.campaignCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
