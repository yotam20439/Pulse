import "server-only";
import type { PlatformName } from "@/db/schema";
import { type ProfileCollector, type ProfileResult } from "./index";

/**
 * Licensed data vendor adapter.
 *
 * TikTok has no equivalent of Instagram's Business Discovery: its Display API
 * requires the creator to authorise your app, which is a non-starter when you
 * are evaluating someone you have not signed yet. The honest options are a
 * paid vendor (Modash, Phyllo, HypeAuditor, Creator.co all sell exactly this),
 * or manual entry.
 *
 * This adapter is deliberately generic — one env var for the endpoint, one for
 * the key, and a mapping step — so switching vendor is a config change rather
 * than a rewrite. Vendors change pricing and coverage often enough that
 * hard-coding one is a mistake you pay for later.
 *
 * Expected response shape (map yours to this in `mapResponse` below):
 *   { followers, avgLikes, avgComments, avgViews, engagementRate, verified }
 */

type VendorConfig = {
  platform: PlatformName;
  endpointEnv: string;
  keyEnv: string;
};

const CONFIGS: VendorConfig[] = [
  { platform: "TIKTOK", endpointEnv: "VENDOR_TIKTOK_ENDPOINT", keyEnv: "VENDOR_API_KEY" },
  { platform: "X", endpointEnv: "VENDOR_X_ENDPOINT", keyEnv: "VENDOR_API_KEY" },
  { platform: "FACEBOOK", endpointEnv: "VENDOR_FACEBOOK_ENDPOINT", keyEnv: "VENDOR_API_KEY" },
];

/** Adjust this to match your vendor's field names — the only thing that changes. */
function mapResponse(body: Record<string, unknown>) {
  const n = (key: string) => {
    const value = body[key];
    return typeof value === "number" ? value : null;
  };
  return {
    followerCount: n("followers") ?? n("followerCount") ?? n("subscriberCount"),
    avgLikes: n("avgLikes") ?? n("averageLikes"),
    avgComments: n("avgComments") ?? n("averageComments"),
    avgViews: n("avgViews") ?? n("averageViews"),
    engagementRate: n("engagementRate") ?? n("engagement_rate"),
    isVerified: Boolean(body.verified ?? body.isVerified),
  };
}

function makeVendorCollector(config: VendorConfig): ProfileCollector {
  return {
    platform: config.platform,
    source: "vendor",

    isConfigured: () => Boolean(process.env[config.endpointEnv] && process.env[config.keyEnv]),

    async fetchProfile(handle: string): Promise<ProfileResult> {
      const endpoint = process.env[config.endpointEnv];
      const key = process.env[config.keyEnv];

      if (!endpoint || !key) {
        return {
          ok: false,
          reason: "NO_CREDENTIALS",
          message: `${config.platform} has no public profile API. Set ${config.endpointEnv} and ${config.keyEnv} to use a licensed vendor, or enter stats manually.`,
        };
      }

      try {
        const url = new URL(endpoint);
        url.searchParams.set("handle", handle.replace(/^@/, ""));
        url.searchParams.set("platform", config.platform.toLowerCase());

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${key}` },
          next: { revalidate: 0 },
        });

        if (response.status === 404) {
          return { ok: false, reason: "NOT_FOUND", message: `Vendor has no record of @${handle}.` };
        }
        if (response.status === 429) {
          return { ok: false, reason: "RATE_LIMITED", message: "Vendor rate limit reached." };
        }
        if (response.status === 401 || response.status === 403) {
          return { ok: false, reason: "AUTH", message: "Vendor rejected the API key." };
        }
        if (!response.ok) {
          return { ok: false, reason: "ERROR", message: `Vendor returned ${response.status}.` };
        }

        return { ok: true, source: "vendor", stats: mapResponse(await response.json()) };
      } catch (err) {
        return {
          ok: false,
          reason: "ERROR",
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

export const vendorCollectors = CONFIGS.map(makeVendorCollector);
