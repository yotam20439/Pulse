import "server-only";
import {
  summarise,
  type ProfileCollector,
  type ProfileResult,
} from "./index";

/**
 * YouTube Data API v3.
 *
 * The easiest real one: a single API key from Google Cloud reads any public
 * channel — no OAuth, no creator involvement. Free tier is 10,000 quota units
 * a day, and a full profile refresh costs about 5, so a roster of a few hundred
 * channels can refresh daily without ever touching the limit.
 */

const BASE = "https://www.googleapis.com/youtube/v3";
const SAMPLE_SIZE = 10;

async function get(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", process.env.YOUTUBE_API_KEY!);

  const response = await fetch(url, { next: { revalidate: 0 } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw Object.assign(new Error(`YouTube ${response.status}: ${body.slice(0, 200)}`), {
      status: response.status,
    });
  }
  return response.json();
}

export const youtubeProfileCollector: ProfileCollector = {
  platform: "YOUTUBE",
  source: "youtube-data-api",

  isConfigured: () => Boolean(process.env.YOUTUBE_API_KEY),

  async fetchProfile(handle: string): Promise<ProfileResult> {
    if (!process.env.YOUTUBE_API_KEY) {
      return { ok: false, reason: "NO_CREDENTIALS", message: "YOUTUBE_API_KEY is not set." };
    }

    try {
      // Handles (@name) and legacy channel ids (UC…) resolve differently.
      const clean = handle.replace(/^@/, "");
      const lookup: Record<string, string> = handle.startsWith("UC")
        ? { id: handle }
        : { forHandle: `@${clean}` };

      const channel = await get("channels", {
        part: "snippet,statistics,contentDetails",
        ...lookup,
      });

      const item = channel.items?.[0];
      if (!item) {
        return { ok: false, reason: "NOT_FOUND", message: `No channel for @${clean}.` };
      }

      const followerCount = item.statistics?.hiddenSubscriberCount
        ? null
        : Number(item.statistics?.subscriberCount ?? 0) || null;

      // Recent uploads give real per-video engagement rather than the lifetime
      // channel totals, which are dominated by whatever went viral in 2019.
      const uploadsPlaylist = item.contentDetails?.relatedPlaylists?.uploads;
      let videos: { likes: number | null; comments: number | null; views: number | null }[] = [];
      let postFrequency: number | null = null;

      if (uploadsPlaylist) {
        const playlist = await get("playlistItems", {
          part: "contentDetails",
          playlistId: uploadsPlaylist,
          maxResults: String(SAMPLE_SIZE),
        });

        const ids = (playlist.items ?? [])
          .map((i: { contentDetails?: { videoId?: string } }) => i.contentDetails?.videoId)
          .filter(Boolean);

        const dates = (playlist.items ?? [])
          .map((i: { contentDetails?: { videoPublishedAt?: string } }) =>
            i.contentDetails?.videoPublishedAt,
          )
          .filter(Boolean)
          .map((d: string) => new Date(d).getTime());

        if (dates.length >= 2) {
          const spanDays = (Math.max(...dates) - Math.min(...dates)) / 86_400_000;
          postFrequency = spanDays > 0 ? (dates.length / spanDays) * 7 : null;
        }

        if (ids.length > 0) {
          const stats = await get("videos", { part: "statistics", id: ids.join(",") });
          videos = (stats.items ?? []).map(
            (v: { statistics?: { likeCount?: string; commentCount?: string; viewCount?: string } }) => ({
              likes: v.statistics?.likeCount ? Number(v.statistics.likeCount) : null,
              comments: v.statistics?.commentCount ? Number(v.statistics.commentCount) : null,
              views: v.statistics?.viewCount ? Number(v.statistics.viewCount) : null,
            }),
          );
        }
      }

      return {
        ok: true,
        source: "youtube-data-api",
        stats: {
          ...summarise(videos, followerCount),
          followerCount,
          postFrequency,
          displayName: item.snippet?.title ?? null,
        },
      };
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = err instanceof Error ? err.message : String(err);
      if (status === 403) return { ok: false, reason: "RATE_LIMITED", message };
      if (status === 400 || status === 401) return { ok: false, reason: "AUTH", message };
      return { ok: false, reason: "ERROR", message };
    }
  },
};
