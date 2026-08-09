import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  brands,
  campaignInfluencers,
  campaignKpis,
  campaignMetricsHistory,
  campaigns,
  influencerAccounts,
  influencers,
  insights,
  metricsSnapshots,
  posts,
} from "@/db/schema";
import {
  effectivenessIndex,
  indexBand,
  rawEngagements,
  weightedEngagements,
} from "@/lib/indices";

/**
 * Every function here takes a campaignId and returns data for one campaign.
 * None of them check permissions — the page calls requireBrandAccess() once,
 * using the brandId from getCampaign(), before touching anything else.
 */

const num = (expr: ReturnType<typeof sql>) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

export async function getCampaign(campaignId: string) {
  const [row] = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      objective: campaigns.objective,
      status: campaigns.status,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      budget: campaigns.budget,
      currency: campaigns.currency,
      meta: campaigns.meta,
      brandId: brands.id,
      brandName: brands.name,
      brandAccent: brands.accentColor,
      brandBaseline: brands.baselineMonthlyImpressions,
    })
    .from(campaigns)
    .innerJoin(brands, eq(campaigns.brandId, brands.id))
    .where(eq(campaigns.id, campaignId));
  return row ?? null;
}

/** Daily rollups for the trend charts, oldest first. */
export async function getHistory(campaignId: string, days = 30) {
  const rows = await db
    .select()
    .from(campaignMetricsHistory)
    .where(eq(campaignMetricsHistory.campaignId, campaignId))
    .orderBy(desc(campaignMetricsHistory.day))
    .limit(days);
  return rows.reverse();
}

/**
 * Campaign totals from the latest snapshot of every post — not a sum over the
 * whole snapshot table, which would count every post once per collection run.
 */
export async function getTotals(campaignId: string) {
  const [row] = await db
    .select({
      postCount: num(sql`count(${posts.id})`),
      impressions: num(sql`sum(${metricsSnapshots.impressions})`),
      reach: num(sql`sum(${metricsSnapshots.reach})`),
      views: num(sql`sum(${metricsSnapshots.views})`),
      likes: num(sql`sum(${metricsSnapshots.likes})`),
      comments: num(sql`sum(${metricsSnapshots.comments})`),
      shares: num(sql`sum(${metricsSnapshots.shares})`),
      saves: num(sql`sum(${metricsSnapshots.saves})`),
      clicks: num(sql`sum(${metricsSnapshots.clicks})`),
      creators: num(sql`count(distinct ${campaignInfluencers.influencerId})`),
      platforms: num(sql`count(distinct ${posts.platform})`),
      spend: num(sql`sum(${campaignInfluencers.fee} + ${campaignInfluencers.inKindValue})`),
    })
    .from(posts)
    .innerJoin(campaignInfluencers, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .leftJoin(metricsSnapshots, eq(posts.latestSnapshotId, metricsSnapshots.id))
    .where(eq(posts.campaignId, campaignId));

  const engagements = rawEngagements(row);
  return {
    ...row,
    engagements,
    engagementRate: row.reach > 0 ? engagements / row.reach : 0,
    cpm: row.impressions > 0 ? (row.spend / row.impressions) * 1000 : null,
    cpe: engagements > 0 ? row.spend / engagements : null,
  };
}

export type CampaignTotals = Awaited<ReturnType<typeof getTotals>>;

/** KPI targets against live actuals. */
export async function getKpiProgress(campaignId: string, totals: CampaignTotals) {
  const kpis = await db
    .select()
    .from(campaignKpis)
    .where(eq(campaignKpis.campaignId, campaignId))
    .orderBy(desc(campaignKpis.weight));

  const actualFor = (metric: string) =>
    ({
      IMPRESSIONS: totals.impressions,
      REACH: totals.reach,
      VIEWS: totals.views,
      LIKES: totals.likes,
      COMMENTS: totals.comments,
      SHARES: totals.shares,
      SAVES: totals.saves,
      CLICKS: totals.clicks,
      ENGAGEMENT_RATE: totals.engagementRate,
      CPM: totals.cpm ?? 0,
      CPE: totals.cpe ?? 0,
    })[metric] ?? 0;

  return kpis.map((kpi) => {
    const target = Number(kpi.targetValue);
    const actual = actualFor(kpi.metric);
    // For cost metrics, under target is good — invert the ratio.
    const inverted = kpi.metric === "CPM" || kpi.metric === "CPE";
    const progress = target > 0 ? (inverted ? target / Math.max(actual, 1e-9) : actual / target) : 0;
    return { ...kpi, target, actual, progress, inverted };
  });
}

/**
 * Per-influencer contribution. This is the table that decides who gets
 * re-booked, so it carries cost as well as output: share of campaign reach
 * next to cost per weighted engagement.
 */
export async function getContribution(campaignId: string, campaignReach: number) {
  const rows = await db
    .select({
      participantId: campaignInfluencers.id,
      influencerId: influencers.id,
      name: influencers.displayName,
      handle: influencerAccounts.handle,
      platform: influencerAccounts.platform,
      followers: influencerAccounts.followerCount,
      baselineEr: influencerAccounts.baselineEngagementRate,
      fee: campaignInfluencers.fee,
      inKind: campaignInfluencers.inKindValue,
      planned: campaignInfluencers.deliverablesPlanned,
      published: num(sql`count(${posts.id})`),
      reach: num(sql`sum(${metricsSnapshots.reach})`),
      views: num(sql`sum(${metricsSnapshots.views})`),
      likes: num(sql`sum(${metricsSnapshots.likes})`),
      comments: num(sql`sum(${metricsSnapshots.comments})`),
      shares: num(sql`sum(${metricsSnapshots.shares})`),
      saves: num(sql`sum(${metricsSnapshots.saves})`),
      clicks: num(sql`sum(${metricsSnapshots.clicks})`),
    })
    .from(campaignInfluencers)
    .innerJoin(influencers, eq(campaignInfluencers.influencerId, influencers.id))
    .innerJoin(influencerAccounts, eq(campaignInfluencers.accountId, influencerAccounts.id))
    .leftJoin(posts, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .leftJoin(metricsSnapshots, eq(posts.latestSnapshotId, metricsSnapshots.id))
    .where(eq(campaignInfluencers.campaignId, campaignId))
    .groupBy(
      campaignInfluencers.id,
      influencers.id,
      influencerAccounts.handle,
      influencerAccounts.platform,
      influencerAccounts.followerCount,
      influencerAccounts.baselineEngagementRate,
    );

  return rows
    .map((r) => {
      const spend = Number(r.fee) + Number(r.inKind);
      const wEng = weightedEngagements(r);
      const eff = effectivenessIndex({
        engagements: r,
        reach: r.reach,
        spend,
        baselineEngagementRate: r.baselineEr ?? 0.04,
      });
      return {
        ...r,
        spend,
        engagements: rawEngagements(r),
        engagementRate: r.reach > 0 ? rawEngagements(r) / r.reach : 0,
        // Against the creator's own normal performance, not a flat benchmark.
        lift: r.baselineEr && r.reach > 0 ? rawEngagements(r) / r.reach / r.baselineEr : null,
        shareOfReach: campaignReach > 0 ? r.reach / campaignReach : 0,
        costPerEngagement: wEng > 0 ? spend / wEng : null,
        effectiveness: eff.score,
        band: indexBand(eff.score),
        delivery: `${r.published}/${r.planned}`,
        underDelivering: r.published < r.planned,
      };
    })
    .sort((a, b) => b.reach - a.reach);
}

export type ContributionRow = Awaited<ReturnType<typeof getContribution>>[number];

/** Individual posts with their latest numbers. */
export async function getPosts(campaignId: string) {
  const rows = await db
    .select({
      id: posts.id,
      url: posts.url,
      platform: posts.platform,
      postType: posts.postType,
      caption: posts.caption,
      thumbnailUrl: posts.thumbnailUrl,
      publishedAt: posts.publishedAt,
      collectionStatus: posts.collectionStatus,
      lastCollectedAt: posts.lastCollectedAt,
      isTracked: posts.isTracked,
      name: influencers.displayName,
      handle: influencerAccounts.handle,
      reach: metricsSnapshots.reach,
      views: metricsSnapshots.views,
      likes: metricsSnapshots.likes,
      comments: metricsSnapshots.comments,
      shares: metricsSnapshots.shares,
      saves: metricsSnapshots.saves,
      clicks: metricsSnapshots.clicks,
      deltaViews: metricsSnapshots.deltaViews,
    })
    .from(posts)
    .innerJoin(campaignInfluencers, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .innerJoin(influencers, eq(campaignInfluencers.influencerId, influencers.id))
    .innerJoin(influencerAccounts, eq(campaignInfluencers.accountId, influencerAccounts.id))
    .leftJoin(metricsSnapshots, eq(posts.latestSnapshotId, metricsSnapshots.id))
    .where(eq(posts.campaignId, campaignId))
    .orderBy(desc(posts.publishedAt));

  return rows.map((r) => {
    const engagements = rawEngagements(r);
    return {
      ...r,
      engagements,
      engagementRate: r.reach && r.reach > 0 ? engagements / r.reach : null,
    };
  });
}

export type PostRow = Awaited<ReturnType<typeof getPosts>>[number];

export async function getInsights(campaignId: string) {
  return db
    .select()
    .from(insights)
    .where(and(eq(insights.campaignId, campaignId), sql`${insights.dismissedById} is null`))
    .orderBy(desc(insights.isPinned), desc(insights.createdAt))
    .limit(6);
}

/** Sparkline source: daily views per platform, for the mix chart. */
export async function getPlatformMix(campaignId: string) {
  const rows = await db
    .select({
      platform: posts.platform,
      reach: num(sql`sum(${metricsSnapshots.reach})`),
      engagements: num(
        sql`sum(coalesce(${metricsSnapshots.likes},0) + coalesce(${metricsSnapshots.comments},0)
             + coalesce(${metricsSnapshots.shares},0) + coalesce(${metricsSnapshots.saves},0))`,
      ),
      postCount: num(sql`count(${posts.id})`),
    })
    .from(posts)
    .leftJoin(metricsSnapshots, eq(posts.latestSnapshotId, metricsSnapshots.id))
    .where(eq(posts.campaignId, campaignId))
    .groupBy(posts.platform)
    .orderBy(asc(posts.platform));
  return rows;
}
