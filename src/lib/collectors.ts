import "server-only";
import type { PlatformName, Post } from "@/db/schema";

/**
 * One interface per platform, so the ingestion job never knows whether a number
 * came from an official API, a licensed data vendor, or a manual CSV upload.
 *
 * Order of preference when wiring a real provider:
 *   1. Official APIs with the creator's consent (Instagram Graph via a
 *      connected Business account, TikTok Display API, YouTube Data API).
 *      These give owned-media metrics — impressions, reach, saves — that no
 *      third party can see.
 *   2. A licensed vendor for creators who won't connect their accounts.
 *   3. Manual entry / CSV import as the honest fallback.
 *
 * Scraping logged-out HTML is not implemented here on purpose: it breaks
 * weekly, violates most platform terms, and produces figures you can't put in
 * front of a client. The interface leaves room for a vendor adapter instead.
 */

export type RawMetrics = {
  impressions?: number;
  reach?: number;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  watchTimeSeconds?: number;
  raw?: unknown;
};

export type CollectResult =
  | { ok: true; metrics: RawMetrics; source: string }
  | { ok: false; reason: "UNAVAILABLE" | "RATE_LIMITED" | "AUTH" | "ERROR"; message: string };

export interface Collector {
  platform: PlatformName;
  collect(post: Pick<Post, "id" | "url" | "externalId" | "postType">): Promise<CollectResult>;
}

/**
 * Deterministic stand-in used until credentials are configured. Produces a
 * plausible growth curve from the post id so the dashboard has moving data on
 * every run without hitting a network.
 */
export function mockCollector(platform: PlatformName): Collector {
  return {
    platform,
    async collect(post) {
      const seed = [...post.id].reduce((a, c) => a + c.charCodeAt(0), 0);
      const drift = (Date.now() / 3_600_000) % 720; // hours since an arbitrary epoch
      const base = 4_000 + (seed % 90_000);
      const views = Math.round(base * (1 + Math.log1p(drift) / 4));
      const engRate = 0.02 + ((seed % 40) / 1000);

      return {
        ok: true,
        source: "mock",
        metrics: {
          views,
          impressions: Math.round(views * 1.18),
          reach: Math.round(views * 0.82),
          likes: Math.round(views * engRate),
          comments: Math.round(views * engRate * 0.07),
          shares: Math.round(views * engRate * 0.05),
          saves: Math.round(views * engRate * 0.09),
          clicks: Math.round(views * 0.004),
        },
      };
    },
  };
}

const REGISTRY = new Map<PlatformName, Collector>();

export function getCollector(platform: PlatformName): Collector {
  if (!REGISTRY.has(platform)) REGISTRY.set(platform, mockCollector(platform));
  return REGISTRY.get(platform)!;
}

/** Swap in a real adapter at boot: registerCollector(instagramGraphCollector). */
export function registerCollector(collector: Collector) {
  REGISTRY.set(collector.platform, collector);
}
