import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  accountSnapshots,
  brands,
  campaignInfluencers,
  campaignMetricsHistory,
  campaigns,
  influencerAccounts,
  influencers,
  metricsSnapshots,
  posts,
  type PlatformName,
} from "@/db/schema";
import { qualityScore, relevanceScore, type QualityInput } from "@/lib/creator-score";
import { rawEngagements } from "@/lib/indices";

/**
 * Everything a creator's profile page needs, plus the inputs to their score.
 *
 * The "observed" figures here are the point of the whole module: average likes
 * and engagement rate computed from posts this system watched, rather than
 * numbers someone typed in from a media kit. Where the two disagree, the
 * observed ones are what the score trusts.
 */

const num = (expr: ReturnType<typeof sql>) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

export async function getCreator(influencerId: string) {
  const [creator] = await db.select().from(influencers).where(eq(influencers.id, influencerId));
  if (!creator) return null;

  const accounts = await db
    .select()
    .from(influencerAccounts)
    .where(eq(influencerAccounts.influencerId, influencerId))
    .orderBy(desc(influencerAccounts.followerCount));

  return { ...creator, accounts };
}

/** Per-post figures for every post this creator published, across campaigns. */
export async function getObservedMetrics(influencerId: string) {
  const rows = await db
    .select({
      postId: posts.id,
      platform: posts.platform,
      postType: posts.postType,
      accountId: campaignInfluencers.accountId,
      publishedAt: posts.publishedAt,
      reach: metricsSnapshots.reach,
      views: metricsSnapshots.views,
      likes: metricsSnapshots.likes,
      comments: metricsSnapshots.comments,
      shares: metricsSnapshots.shares,
      saves: metricsSnapshots.saves,
    })
    .from(campaignInfluencers)
    .innerJoin(posts, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .leftJoin(metricsSnapshots, eq(posts.latestSnapshotId, metricsSnapshots.id))
    .where(eq(campaignInfluencers.influencerId, influencerId));

  const measured = rows.filter((r) => (r.reach ?? 0) > 0);
  const rates = measured.map((r) => rawEngagements(r) / (r.reach || 1));

  const mean = rates.length ? rates.reduce((s, r) => s + r, 0) / rates.length : null;
  // Coefficient of variation: standard deviation relative to the mean, so a
  // creator with big numbers isn't penalised for big absolute swings.
  const variance =
    rates.length >= 2 && mean
      ? Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / rates.length) / mean
      : null;

  const avg = (key: "likes" | "comments" | "views" | "reach") =>
    measured.length
      ? Math.round(measured.reduce((s, r) => s + (r[key] ?? 0), 0) / measured.length)
      : null;

  return {
    postCount: rows.length,
    measuredCount: measured.length,
    avgLikes: avg("likes"),
    avgComments: avg("comments"),
    avgViews: avg("views"),
    avgReach: avg("reach"),
    engagementRate: mean,
    engagementVariance: variance,
    byPlatform: [...new Set(rows.map((r) => r.platform))] as PlatformName[],
    posts: rows,
  };
}

/** Campaigns this creator has worked on, with how each performed. */
export async function getCreatorHistory(influencerId: string) {
  const rows = await db
    .select({
      campaignId: campaigns.id,
      campaignName: campaigns.name,
      status: campaigns.status,
      brandId: brands.id,
      brandName: brands.name,
      accentColor: brands.accentColor,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      fee: campaignInfluencers.fee,
      inKind: campaignInfluencers.inKindValue,
      planned: campaignInfluencers.deliverablesPlanned,
      published: num(sql`count(${posts.id})`),
    })
    .from(campaignInfluencers)
    .innerJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .leftJoin(posts, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .where(eq(campaignInfluencers.influencerId, influencerId))
    .groupBy(campaigns.id, brands.id, campaignInfluencers.id)
    .orderBy(desc(campaigns.startDate));

  if (rows.length === 0) return [];

  // Latest effectiveness reading per campaign, for the track-record component.
  const scores = await db
    .selectDistinctOn([campaignMetricsHistory.campaignId], {
      campaignId: campaignMetricsHistory.campaignId,
      effectiveness: campaignMetricsHistory.effectivenessIndex,
    })
    .from(campaignMetricsHistory)
    .where(inArray(campaignMetricsHistory.campaignId, rows.map((r) => r.campaignId)))
    .orderBy(campaignMetricsHistory.campaignId, desc(campaignMetricsHistory.day));

  const byCampaign = new Map(scores.map((s) => [s.campaignId, s.effectiveness]));

  return rows.map((r) => ({
    ...r,
    effectiveness: byCampaign.get(r.campaignId) ?? null,
    spend: Number(r.fee) + Number(r.inKind),
    delivered: r.published >= r.planned,
  }));
}

/** Everything assembled into a quality score. */
export async function getCreatorScore(influencerId: string) {
  const [creator, observed, history] = await Promise.all([
    getCreator(influencerId),
    getObservedMetrics(influencerId),
    getCreatorHistory(influencerId),
  ]);
  if (!creator) return null;

  const snapshots = creator.accounts.length
    ? await db
        .select({
          accountId: accountSnapshots.accountId,
          followerCount: accountSnapshots.followerCount,
        })
        .from(accountSnapshots)
        .where(inArray(accountSnapshots.accountId, creator.accounts.map((a) => a.id)))
        .orderBy(asc(accountSnapshots.capturedAt))
    : [];

  const historyByAccount = new Map<string, number[]>();
  for (const s of snapshots) {
    if (s.followerCount == null) continue;
    const list = historyByAccount.get(s.accountId) ?? [];
    list.push(s.followerCount);
    historyByAccount.set(s.accountId, list);
  }

  const completed = history.filter((h) => h.status === "COMPLETED" || h.status === "ACTIVE");
  const deliveryRate = completed.length
    ? completed.reduce((s, h) => s + Math.min(h.published / Math.max(h.planned, 1), 1), 0) /
      completed.length
    : null;
  const withScores = completed.filter((h) => h.effectiveness != null);
  const meanEffectiveness = withScores.length
    ? withScores.reduce((s, h) => s + (h.effectiveness ?? 0), 0) / withScores.length
    : null;

  const input: QualityInput = {
    accounts: creator.accounts.map((a) => ({
      platform: a.platform,
      followerCount: a.followerCount,
      baselineEngagementRate: a.baselineEngagementRate,
      statsSource: a.statsSource,
      followerHistory: historyByAccount.get(a.id) ?? [],
    })),
    observed: {
      postCount: observed.measuredCount,
      engagementRate: observed.engagementRate,
      engagementVariance: observed.engagementVariance,
      deliveryRate,
      meanEffectiveness,
      campaignsRun: completed.length,
    },
  };

  return { ...qualityScore(input), observed, history, creator };
}

/**
 * Ranks every creator in the roster against one campaign.
 *
 * Deliberately returns everyone rather than a filtered shortlist: the roster is
 * a suggestion layer, and hiding a creator because an algorithm scored them low
 * is how a tool starts making booking decisions it isn't qualified to make.
 */
export async function rankCreatorsForCampaign(campaignId: string, limit = 20) {
  const [campaign] = await db
    .select({
      id: campaigns.id,
      brandId: campaigns.brandId,
      budget: campaigns.budget,
      meta: campaigns.meta,
      industry: brands.industry,
    })
    .from(campaigns)
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .where(eq(campaigns.id, campaignId));
  if (!campaign) return [];

  const roster = await db
    .select({ accountId: campaignInfluencers.accountId, influencerId: campaignInfluencers.influencerId })
    .from(campaignInfluencers)
    .where(eq(campaignInfluencers.campaignId, campaignId));

  const bookedIds = new Set(roster.map((r) => r.influencerId));

  const campaignPlatforms = roster.length
    ? (
        await db
          .select({ platform: influencerAccounts.platform })
          .from(influencerAccounts)
          .where(inArray(influencerAccounts.id, roster.map((r) => r.accountId)))
      ).map((r) => r.platform)
    : [];

  const candidates = await db
    .select({
      id: influencers.id,
      displayName: influencers.displayName,
      tags: influencers.tags,
      accountId: influencerAccounts.id,
      platform: influencerAccounts.platform,
      handle: influencerAccounts.handle,
      followerCount: influencerAccounts.followerCount,
      baselineEngagementRate: influencerAccounts.baselineEngagementRate,
    })
    .from(influencers)
    .innerJoin(influencerAccounts, eq(influencerAccounts.influencerId, influencers.id));

  // Collapse accounts into one row per creator.
  const grouped = new Map<
    string,
    {
      id: string;
      displayName: string;
      tags: string[];
      platforms: PlatformName[];
      totalFollowers: number;
      accounts: { id: string; platform: PlatformName; handle: string; followerCount: number | null }[];
    }
  >();

  for (const row of candidates) {
    const entry = grouped.get(row.id) ?? {
      id: row.id,
      displayName: row.displayName,
      tags: row.tags ?? [],
      platforms: [],
      totalFollowers: 0,
      accounts: [],
    };
    entry.platforms.push(row.platform);
    entry.totalFollowers += row.followerCount ?? 0;
    entry.accounts.push({
      id: row.accountId,
      platform: row.platform,
      handle: row.handle,
      followerCount: row.followerCount,
    });
    grouped.set(row.id, entry);
  }

  const allHistory = await db
    .select({
      influencerId: campaignInfluencers.influencerId,
      brandId: campaigns.brandId,
      endDate: campaigns.endDate,
      campaignId: campaigns.id,
    })
    .from(campaignInfluencers)
    .innerJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id));

  const effectiveness = allHistory.length
    ? await db
        .selectDistinctOn([campaignMetricsHistory.campaignId], {
          campaignId: campaignMetricsHistory.campaignId,
          effectiveness: campaignMetricsHistory.effectivenessIndex,
        })
        .from(campaignMetricsHistory)
        .orderBy(campaignMetricsHistory.campaignId, desc(campaignMetricsHistory.day))
    : [];
  const effByCampaign = new Map(effectiveness.map((e) => [e.campaignId, e.effectiveness]));

  const keywords = [
    campaign.industry ?? "",
    ...(campaign.meta?.hashtags ?? []).map((h) => h.replace("#", "")),
  ]
    .filter(Boolean)
    .map((k) => k.toLowerCase());

  const budgetPerCreator = Number(campaign.budget) / Math.max(roster.length || 4, 1);

  const scored = [...grouped.values()].map((creator) => {
    const history = allHistory
      .filter((h) => h.influencerId === creator.id)
      .map((h) => ({
        brandId: h.brandId,
        campaignBrandId: h.brandId,
        effectiveness: effByCampaign.get(h.campaignId) ?? null,
        endedAt: h.endDate,
        sameBrand: h.brandId === campaign.brandId,
      }));

    const relevance = relevanceScore({
      creator: {
        platforms: creator.platforms,
        totalFollowers: creator.totalFollowers,
        tags: creator.tags,
        qualityScore: null,
      },
      campaign: {
        platforms: campaignPlatforms,
        budgetPerCreator,
        keywords,
      },
      history,
    });

    return {
      ...creator,
      ...relevance,
      alreadyBooked: bookedIds.has(creator.id),
      workedWithBrand: history.some((h) => h.sameBrand),
      campaignsRun: history.length,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
