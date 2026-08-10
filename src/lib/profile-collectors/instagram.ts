import "server-only";
import {
  summarise,
  type ProfileCollector,
  type ProfileResult,
} from "./index";

/**
 * Instagram Graph API — Business Discovery.
 *
 * This is the one people don't realise exists. If *you* have an Instagram
 * Business or Creator account linked to a Facebook Page, you can read public
 * stats for any other Business or Creator account by username: followers, media
 * count, and per-post likes and comments. The creator does not authorise
 * anything, and nothing is scraped.
 *
 * Setup, once:
 *   1. Instagram account → Business or Creator, linked to a Facebook Page.
 *   2. Create an app at developers.facebook.com, add Instagram Graph API.
 *   3. Generate a long-lived Page access token (60 days, refreshable).
 *   4. Set INSTAGRAM_GRAPH_TOKEN and INSTAGRAM_BUSINESS_ID.
 *
 * The limitation worth knowing: personal accounts are invisible to this
 * endpoint. Most working creators run Creator accounts, so coverage is good,
 * but it is not universal — and when it fails the account stays on manual
 * stats rather than guessing.
 */

const VERSION = "v21.0";
const SAMPLE_SIZE = 12;

export const instagramProfileCollector: ProfileCollector = {
  platform: "INSTAGRAM",
  source: "instagram-graph",

  isConfigured: () =>
    Boolean(process.env.INSTAGRAM_GRAPH_TOKEN && process.env.INSTAGRAM_BUSINESS_ID),

  async fetchProfile(handle: string): Promise<ProfileResult> {
    const token = process.env.INSTAGRAM_GRAPH_TOKEN;
    const businessId = process.env.INSTAGRAM_BUSINESS_ID;

    if (!token || !businessId) {
      return {
        ok: false,
        reason: "NO_CREDENTIALS",
        message: "INSTAGRAM_GRAPH_TOKEN and INSTAGRAM_BUSINESS_ID are not set.",
      };
    }

    const username = handle.replace(/^@/, "");
    const fields = `business_discovery.username(${username}){username,name,followers_count,media_count,media.limit(${SAMPLE_SIZE}){like_count,comments_count,media_product_type,timestamp}}`;

    const url = new URL(`https://graph.facebook.com/${VERSION}/${businessId}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", token);

    try {
      const response = await fetch(url, { next: { revalidate: 0 } });
      const body = await response.json();

      if (!response.ok) {
        const error = body?.error ?? {};
        // Code 110 / subcode 2207013: the account is personal or doesn't exist,
        // which is expected often enough that it isn't worth alarming about.
        if (error.code === 110 || /does not exist|cannot be found/i.test(error.message ?? "")) {
          return {
            ok: false,
            reason: "NOT_FOUND",
            message: `@${username} isn't a Business or Creator account, so Graph can't read it.`,
          };
        }
        if (response.status === 401 || error.code === 190) {
          return { ok: false, reason: "AUTH", message: "Token expired — regenerate the long-lived token." };
        }
        if (response.status === 429 || error.code === 4 || error.code === 32) {
          return { ok: false, reason: "RATE_LIMITED", message: "Graph API rate limit reached." };
        }
        return { ok: false, reason: "ERROR", message: error.message ?? `HTTP ${response.status}` };
      }

      const profile = body?.business_discovery;
      if (!profile) {
        return { ok: false, reason: "NOT_FOUND", message: `No profile returned for @${username}.` };
      }

      const media = (profile.media?.data ?? []) as {
        like_count?: number;
        comments_count?: number;
        timestamp?: string;
      }[];

      const posts = media.map((m) => ({
        likes: m.like_count ?? null,
        comments: m.comments_count ?? null,
        views: null,
      }));

      const dates = media
        .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : null))
        .filter((d): d is number => d != null);
      const spanDays =
        dates.length >= 2 ? (Math.max(...dates) - Math.min(...dates)) / 86_400_000 : 0;

      return {
        ok: true,
        source: "instagram-graph",
        stats: {
          ...summarise(posts, profile.followers_count ?? null),
          followerCount: profile.followers_count ?? null,
          displayName: profile.name ?? null,
          postFrequency: spanDays > 0 ? (dates.length / spanDays) * 7 : null,
        },
      };
    } catch (err) {
      return {
        ok: false,
        reason: "ERROR",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
