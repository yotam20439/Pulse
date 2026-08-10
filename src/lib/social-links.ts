import type { PlatformName } from "@/db/schema";

/**
 * Turns a pasted link into a platform and a handle.
 *
 * People paste whatever is in their clipboard: a profile, a specific post, a
 * share link with tracking parameters, a bare @handle, sometimes with the
 * mobile app's `?igsh=` cruft attached. All of those identify the same creator,
 * so all of them should work. Rejecting a link because it points at a Reel
 * rather than a profile is the kind of pedantry that makes people keep using a
 * spreadsheet instead.
 */

export type ParsedLink = {
  platform: PlatformName;
  handle: string;
  /** Canonical profile URL, rebuilt rather than echoed back. */
  profileUrl: string;
  /** True when the link pointed at a specific post rather than the profile. */
  wasPostLink: boolean;
};

type Matcher = {
  platform: PlatformName;
  host: RegExp;
  /** Path segments that are never a handle. */
  reserved: string[];
  /** Extracts the handle from the path, or null if it can't. */
  extract: (path: string[]) => string | null;
  profile: (handle: string) => string;
};

const MATCHERS: Matcher[] = [
  {
    platform: "INSTAGRAM",
    host: /(^|\.)instagram\.com$/i,
    reserved: ["p", "reel", "reels", "tv", "stories", "explore", "accounts"],
    extract: (path) => {
      // instagram.com/p/ABC → the post id, not a handle. But
      // instagram.com/stories/name/123 puts the handle second.
      if (path[0] === "stories" && path[1]) return path[1];
      return path[0] ?? null;
    },
    profile: (h) => `https://www.instagram.com/${h}/`,
  },
  {
    platform: "TIKTOK",
    host: /(^|\.)tiktok\.com$/i,
    reserved: ["video", "t", "discover", "tag", "music"],
    extract: (path) => {
      const at = path.find((s) => s.startsWith("@"));
      return at ? at.slice(1) : null;
    },
    profile: (h) => `https://www.tiktok.com/@${h}`,
  },
  {
    platform: "YOUTUBE",
    host: /(^|\.)(youtube\.com|youtu\.be)$/i,
    reserved: ["watch", "shorts", "playlist", "results", "feed", "channel", "embed"],
    extract: (path) => {
      const at = path.find((s) => s.startsWith("@"));
      if (at) return at;
      if (path[0] === "channel" && path[1]) return path[1];
      if (path[0] === "c" && path[1]) return path[1];
      return null;
    },
    profile: (h) => `https://www.youtube.com/${h.startsWith("@") ? h : `@${h}`}`,
  },
  {
    platform: "FACEBOOK",
    host: /(^|\.)(facebook\.com|fb\.com)$/i,
    reserved: ["posts", "photo", "watch", "groups", "events", "share"],
    extract: (path) => path[0] ?? null,
    profile: (h) => `https://www.facebook.com/${h}`,
  },
  {
    platform: "X",
    host: /(^|\.)(twitter\.com|x\.com)$/i,
    reserved: ["status", "i", "home", "search", "hashtag"],
    extract: (path) => path[0] ?? null,
    profile: (h) => `https://x.com/${h}`,
  },
  {
    platform: "LINKEDIN",
    host: /(^|\.)linkedin\.com$/i,
    reserved: ["feed", "posts", "pulse"],
    extract: (path) => {
      if ((path[0] === "in" || path[0] === "company") && path[1]) return path[1];
      return null;
    },
    profile: (h) => `https://www.linkedin.com/in/${h}`,
  },
  {
    platform: "TELEGRAM",
    host: /(^|\.)(t\.me|telegram\.me)$/i,
    reserved: ["s", "joinchat"],
    extract: (path) => (path[0] === "s" ? (path[1] ?? null) : (path[0] ?? null)),
    profile: (h) => `https://t.me/${h}`,
  },
];

export function parseSocialLink(input: string): ParsedLink | null {
  const raw = input.trim();
  if (!raw) return null;

  // A bare "@handle" can't be resolved to a platform on its own.
  if (/^@?[\w.]+$/.test(raw) && !raw.includes(".com") && !raw.includes("t.me")) return null;

  let url: URL;
  try {
    url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const matcher = MATCHERS.find((m) => m.host.test(url.hostname));
  if (!matcher) return null;

  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) return null;

  const handle = matcher.extract(segments);
  if (!handle) return null;

  const cleaned = handle.replace(/^@/, "").trim();
  if (!cleaned || matcher.reserved.includes(cleaned.toLowerCase())) return null;

  const wasPostLink = segments.some((s) => matcher.reserved.includes(s.toLowerCase()));

  return {
    platform: matcher.platform,
    handle: matcher.platform === "YOUTUBE" && handle.startsWith("@") ? handle : cleaned,
    profileUrl: matcher.profile(matcher.platform === "YOUTUBE" ? handle : cleaned),
    wasPostLink,
  };
}

/** Splits a pasted block into individual links — people paste several at once. */
export function parseMany(input: string): ParsedLink[] {
  const seen = new Set<string>();
  const out: ParsedLink[] = [];

  for (const token of input.split(/[\s,;]+/).filter(Boolean)) {
    const parsed = parseSocialLink(token);
    if (!parsed) continue;
    const key = `${parsed.platform}:${parsed.handle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
  }

  return out;
}

/** A guess at the creator's name, used to prefill the form. */
export function suggestName(handle: string) {
  return handle
    .replace(/^@/, "")
    .replace(/[._-]+/g, " ")
    .replace(/\d+$/, "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
