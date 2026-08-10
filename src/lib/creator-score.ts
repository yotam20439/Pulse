import type { PlatformName } from "@/db/schema";
import { clamp, saturate } from "@/lib/indices";

/**
 * Two scores about creators, distinct from the two about campaigns.
 *
 *   • Quality   — how good is this creator, in general?
 *   • Relevance — how well do they fit *this* campaign?
 *
 * Both carry a confidence value, because the honest answer for a creator you
 * added five minutes ago is "we don't know yet". A score presented without its
 * evidence base invites people to trust a number built from one data point,
 * which is worse than showing no number at all.
 *
 * The important design decision: metrics a creator *claims* and metrics we have
 * *observed* from posts we tracked are weighted differently. A media kit says
 * whatever the creator wants it to say; a post we watched for thirty days does
 * not.
 */

export const SCORE_VERSION = "1.0.0";

/** Recent evidence counts more. Half-life of six months. */
const HALF_LIFE_DAYS = 180;

export function timeWeight(date: Date | string | null): number {
  if (!date) return 0.3;
  const days = (Date.now() - new Date(date).getTime()) / 86_400_000;
  if (days < 0) return 1;
  return Math.pow(0.5, days / HALF_LIFE_DAYS);
}

/**
 * Engagement rate falls predictably as follower count rises, so a flat
 * benchmark punishes large accounts and flatters small ones. These are the
 * rough industry bands; a creator is judged against their own size class.
 */
export function expectedEngagementRate(followers: number): number {
  if (followers <= 0) return 0.04;
  if (followers < 10_000) return 0.055; // nano
  if (followers < 50_000) return 0.042; // micro
  if (followers < 250_000) return 0.031; // mid
  if (followers < 1_000_000) return 0.021; // macro
  return 0.014; // mega
}

export function audienceTier(followers: number | null): string {
  if (!followers) return "unknown";
  if (followers < 10_000) return "nano";
  if (followers < 50_000) return "micro";
  if (followers < 250_000) return "mid";
  if (followers < 1_000_000) return "macro";
  return "mega";
}

/* -------------------------------------------------------------------------- */
/*  Quality                                                                    */
/* -------------------------------------------------------------------------- */

export type QualityInput = {
  /** Profile stats per account, as claimed or synced. */
  accounts: {
    platform: PlatformName;
    followerCount: number | null;
    baselineEngagementRate: number | null;
    statsSource: string;
    /** Oldest → newest follower readings, for growth. */
    followerHistory: number[];
  }[];
  /** Derived from posts we tracked ourselves. The trustworthy half. */
  observed: {
    postCount: number;
    engagementRate: number | null;
    /** Coefficient of variation of per-post engagement rate. */
    engagementVariance: number | null;
    /** Published ÷ contracted across every campaign. */
    deliveryRate: number | null;
    /** Mean effectiveness index across campaigns they ran. */
    meanEffectiveness: number | null;
    campaignsRun: number;
  };
};

export const QUALITY_WEIGHTS = {
  engagement: 0.35,
  consistency: 0.2,
  growth: 0.15,
  reliability: 0.3,
} as const;

export function qualityScore(input: QualityInput) {
  const { accounts, observed } = input;
  const totalFollowers = accounts.reduce((s, a) => s + (a.followerCount ?? 0), 0);

  // Engagement: measured against what a creator of this size should achieve.
  // Observed rate wins over claimed whenever we have enough posts to trust it.
  const claimedEr =
    accounts.reduce((s, a) => s + (a.baselineEngagementRate ?? 0) * (a.followerCount ?? 1), 0) /
    Math.max(totalFollowers, 1);
  const useObserved = observed.postCount >= 3 && observed.engagementRate != null;
  const effectiveEr = useObserved ? observed.engagementRate! : claimedEr;
  const expected = expectedEngagementRate(totalFollowers);
  const engagement = expected > 0 ? saturate(effectiveEr / expected, 1) : 0;

  // Consistency: low variance across posts means a bookable creator rather
  // than one who got lucky once. Unknown until we have four posts.
  const consistency =
    observed.engagementVariance == null || observed.postCount < 4
      ? 0.5
      : clamp(1 - observed.engagementVariance);

  // Growth: slope of follower history, normalised. Flat is fine, falling isn't.
  const growth = (() => {
    const withHistory = accounts.filter((a) => a.followerHistory.length >= 2);
    if (withHistory.length === 0) return 0.5;
    const rates = withHistory.map((a) => {
      const first = a.followerHistory[0] || 1;
      const last = a.followerHistory.at(-1) || first;
      return (last - first) / first;
    });
    const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
    // −10% → 0, flat → 0.5, +20% → ~1
    return clamp(0.5 + mean * 2.5);
  })();

  // Reliability: did they publish what they signed for, and did it work?
  const reliability = (() => {
    if (observed.campaignsRun === 0) return 0.5;
    const delivery = clamp(observed.deliveryRate ?? 0.5);
    const effect = clamp((observed.meanEffectiveness ?? 50) / 100);
    return 0.6 * delivery + 0.4 * effect;
  })();

  const score =
    QUALITY_WEIGHTS.engagement * engagement +
    QUALITY_WEIGHTS.consistency * consistency +
    QUALITY_WEIGHTS.growth * growth +
    QUALITY_WEIGHTS.reliability * reliability;

  // Confidence rises with evidence: tracked posts, completed campaigns, and
  // whether the profile numbers came from a platform rather than a person.
  const confidence = clamp(
    0.15 +
      saturate(observed.postCount, 8) * 0.4 +
      saturate(observed.campaignsRun, 2) * 0.3 +
      (accounts.some((a) => a.statsSource === "api") ? 0.15 : 0),
  );

  return {
    score: Math.round(clamp(score) * 1000) / 10,
    confidence: Math.round(confidence * 100) / 100,
    components: { engagement, consistency, growth, reliability },
    usedObservedMetrics: useObserved,
    version: SCORE_VERSION,
  };
}

/* -------------------------------------------------------------------------- */
/*  Relevance                                                                  */
/* -------------------------------------------------------------------------- */

export type RelevanceInput = {
  creator: {
    platforms: PlatformName[];
    totalFollowers: number;
    tags: string[];
    qualityScore: number | null;
  };
  campaign: {
    /** Platforms already in the roster, or the brand's usual mix. */
    platforms: PlatformName[];
    /** Budget per creator slot — anchors the audience-size fit. */
    budgetPerCreator: number;
    /** Brand industry plus campaign hashtags, lowercased. */
    keywords: string[];
  };
  /** This creator's past work, newest first. */
  history: {
    brandId: string;
    campaignBrandId: string;
    effectiveness: number | null;
    endedAt: Date | string | null;
    /** Same brand as the campaign being scored? */
    sameBrand: boolean;
  }[];
};

export const RELEVANCE_WEIGHTS = {
  platform: 0.3,
  audience: 0.25,
  trackRecord: 0.25,
  category: 0.2,
} as const;

/**
 * Rough market rate: what one post from a creator of a given size costs.
 * Used only to judge whether a creator is proportionate to the budget — a
 * 2M-follower account on a 3,000 slot is a poor fit however good they are.
 */
function expectedFee(followers: number) {
  return Math.max(300, followers * 0.012);
}

export function relevanceScore(input: RelevanceInput) {
  const { creator, campaign, history } = input;

  // Platform: does the creator work where the campaign lives?
  const overlap = creator.platforms.filter((p) => campaign.platforms.includes(p)).length;
  const platform =
    campaign.platforms.length === 0
      ? 0.6 // no roster yet — don't punish anyone
      : clamp(overlap / Math.min(campaign.platforms.length, 2));

  // Audience: proportionate to the money available for one slot.
  const fee = expectedFee(creator.totalFollowers);
  const ratio = campaign.budgetPerCreator > 0 ? fee / campaign.budgetPerCreator : 1;
  // Best fit is near parity; both far-too-big and far-too-small lose points.
  const audience = clamp(1 - Math.min(Math.abs(Math.log10(Math.max(ratio, 0.01))), 1));

  // Track record: time-weighted effectiveness, with work for this same brand
  // counting double — a creator the brand's audience already knows is a
  // different proposition from a stranger with the same numbers.
  const trackRecord = (() => {
    if (history.length === 0) return 0.45; // unknown, slightly below neutral
    let weighted = 0;
    let weights = 0;
    for (const h of history) {
      const w = timeWeight(h.endedAt) * (h.sameBrand ? 2 : 1);
      weighted += w * clamp((h.effectiveness ?? 50) / 100);
      weights += w;
    }
    return weights > 0 ? weighted / weights : 0.45;
  })();

  // Category: tag overlap with the brand and campaign vocabulary.
  const category = (() => {
    if (campaign.keywords.length === 0 || creator.tags.length === 0) return 0.5;
    const tags = creator.tags.map((t) => t.toLowerCase());
    const hits = campaign.keywords.filter((k) =>
      tags.some((t) => t.includes(k) || k.includes(t)),
    ).length;
    return clamp(0.3 + hits / campaign.keywords.length);
  })();

  const score =
    RELEVANCE_WEIGHTS.platform * platform +
    RELEVANCE_WEIGHTS.audience * audience +
    RELEVANCE_WEIGHTS.trackRecord * trackRecord +
    RELEVANCE_WEIGHTS.category * category;

  return {
    score: Math.round(clamp(score) * 1000) / 10,
    components: { platform, audience, trackRecord, category },
    expectedFee: Math.round(fee),
    version: SCORE_VERSION,
  };
}

export function scoreBand(score: number) {
  if (score >= 72) return { label: "Strong fit", tone: "positive" as const };
  if (score >= 52) return { label: "Reasonable fit", tone: "neutral" as const };
  if (score >= 32) return { label: "Weak fit", tone: "warning" as const };
  return { label: "Poor fit", tone: "critical" as const };
}
