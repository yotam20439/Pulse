import "server-only";
import type { PlatformName } from "@/db/schema";

/**
 * Fetching creator profile stats — followers, average likes, engagement rate —
 * from the platforms themselves.
 *
 * WHY THERE IS NO HTML SCRAPER HERE
 *
 * The obvious implementation is to fetch a public profile page and read the
 * numbers out of the markup. It is not built that way on purpose:
 *
 *   1. It stops working constantly. Instagram and TikTok ship markup changes
 *      every few weeks, and each one silently turns your follower counts into
 *      nulls — or worse, into stale numbers that look fine.
 *   2. Logged-out pages are aggressively rate-limited and increasingly gated
 *      behind a login wall, so it fails from a datacentre IP even when the
 *      selectors are right.
 *   3. It violates the terms of every platform listed here, which matters when
 *      the output goes into a client invoice.
 *   4. A number you cannot source is a number you cannot defend. "Our scraper
 *      said so, last time it worked" is not an answer to a client.
 *
 * The adapters below use documented endpoints instead. Two of them work today
 * with nothing but an API key or an access token you already have if you run
 * social accounts. The rest degrade honestly: no credentials means the account
 * stays on manually entered stats, clearly labelled as such, rather than
 * quietly showing fiction.
 */

export type ProfileStats = {
  followerCount?: number | null;
  followingCount?: number | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  avgViews?: number | null;
  /** 0–1, computed from recent posts where the provider exposes them. */
  engagementRate?: number | null;
  /** Posts per week over the sampled window. */
  postFrequency?: number | null;
  isVerified?: boolean;
  displayName?: string | null;
  /** How many recent posts the averages were computed from. */
  sampleSize?: number;
};

export type ProfileResult =
  | { ok: true; stats: ProfileStats; source: string }
  | {
      ok: false;
      reason: "NO_CREDENTIALS" | "NOT_FOUND" | "RATE_LIMITED" | "AUTH" | "UNSUPPORTED" | "ERROR";
      message: string;
    };

export interface ProfileCollector {
  platform: PlatformName;
  /** Human-readable name shown next to the fetched numbers. */
  source: string;
  /** False when the required environment variables are missing. */
  isConfigured(): boolean;
  fetchProfile(handle: string): Promise<ProfileResult>;
}

const REGISTRY = new Map<PlatformName, ProfileCollector>();

export function registerProfileCollector(collector: ProfileCollector) {
  REGISTRY.set(collector.platform, collector);
}

export function getProfileCollector(platform: PlatformName): ProfileCollector | null {
  return REGISTRY.get(platform) ?? null;
}

export function configuredPlatforms(): PlatformName[] {
  return [...REGISTRY.values()].filter((c) => c.isConfigured()).map((c) => c.platform);
}

/** Averages from a list of posts, ignoring entries the provider left null. */
export function summarise(
  posts: { likes?: number | null; comments?: number | null; views?: number | null }[],
  followerCount: number | null,
): ProfileStats {
  if (posts.length === 0) return { sampleSize: 0 };

  const mean = (key: "likes" | "comments" | "views") => {
    const values = posts.map((p) => p[key]).filter((v): v is number => typeof v === "number");
    return values.length ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : null;
  };

  const avgLikes = mean("likes");
  const avgComments = mean("comments");
  const avgViews = mean("views");

  // Engagement rate is per follower, which is the convention every media kit
  // and every rate card uses. Reach-based rates are more truthful but are only
  // available to the account owner, so they aren't comparable across a roster.
  const engagementRate =
    followerCount && followerCount > 0 && (avgLikes != null || avgComments != null)
      ? ((avgLikes ?? 0) + (avgComments ?? 0)) / followerCount
      : null;

  return {
    avgLikes,
    avgComments,
    avgViews,
    engagementRate,
    sampleSize: posts.length,
  };
}
