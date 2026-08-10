import "server-only";
import { and, asc, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "@/db";
import { accountSnapshots, influencerAccounts } from "@/db/schema";
import { getProfileCollector } from "@/lib/profile-collectors";
import { registerAllProfileCollectors } from "@/lib/profile-collectors/register";

/**
 * Refreshing profile stats.
 *
 * Every successful fetch writes two things: the current values on the account,
 * and an immutable row in `account_snapshots`. The snapshot is what makes
 * follower growth computable later — without it you only ever know today's
 * number, and "is this creator growing or coasting" becomes unanswerable.
 */

export type SyncOutcome = {
  accountId: string;
  handle: string;
  platform: string;
  status: "updated" | "skipped" | "failed";
  reason?: string;
  followerDelta?: number | null;
};

export async function syncAccount(accountId: string): Promise<SyncOutcome> {
  registerAllProfileCollectors();

  const [account] = await db
    .select()
    .from(influencerAccounts)
    .where(eq(influencerAccounts.id, accountId));

  if (!account) {
    return { accountId, handle: "", platform: "", status: "failed", reason: "Account not found." };
  }

  const base = { accountId, handle: account.handle, platform: account.platform };
  const collector = getProfileCollector(account.platform);

  if (!collector || !collector.isConfigured()) {
    return {
      ...base,
      status: "skipped",
      reason: `No configured provider for ${account.platform.toLowerCase()}. Stats stay as entered.`,
    };
  }

  const result = await collector.fetchProfile(account.handle);

  if (!result.ok) {
    return { ...base, status: "failed", reason: result.message };
  }

  const stats = result.stats;
  const previous = account.followerCount;

  await db
    .update(influencerAccounts)
    .set({
      // Only overwrite what the provider actually returned. A vendor that
      // omits avgViews must not wipe a figure someone entered by hand.
      followerCount: stats.followerCount ?? account.followerCount,
      followingCount: stats.followingCount ?? account.followingCount,
      avgLikes: stats.avgLikes ?? account.avgLikes,
      avgComments: stats.avgComments ?? account.avgComments,
      avgViews: stats.avgViews ?? account.avgViews,
      postFrequency: stats.postFrequency ?? account.postFrequency,
      baselineEngagementRate: stats.engagementRate ?? account.baselineEngagementRate,
      isVerified: stats.isVerified ?? account.isVerified,
      statsSource: result.source === "vendor" ? "vendor" : "api",
      followersSyncedAt: new Date(),
    })
    .where(eq(influencerAccounts.id, accountId));

  await db.insert(accountSnapshots).values({
    accountId,
    followerCount: stats.followerCount ?? null,
    avgLikes: stats.avgLikes ?? null,
    avgViews: stats.avgViews ?? null,
    engagementRate: stats.engagementRate ?? null,
    source: result.source,
  });

  return {
    ...base,
    status: "updated",
    followerDelta:
      stats.followerCount != null && previous != null ? stats.followerCount - previous : null,
  };
}

/** Accounts due a refresh, oldest first. */
export async function accountsDueSync(maxAgeHours = 24, limit = 100) {
  const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000);
  return db
    .select({ id: influencerAccounts.id })
    .from(influencerAccounts)
    .where(
      or(
        isNull(influencerAccounts.followersSyncedAt),
        lt(influencerAccounts.followersSyncedAt, cutoff),
      ),
    )
    .orderBy(asc(influencerAccounts.followersSyncedAt))
    .limit(limit);
}

export async function syncDueAccounts(limit = 100) {
  const due = await accountsDueSync(24, limit);
  const results: SyncOutcome[] = [];

  for (const account of due) {
    results.push(await syncAccount(account.id));
    // Gentle pacing. Graph and YouTube both tolerate bursts, but a roster
    // refresh is not urgent and being a good client costs nothing.
    await new Promise((r) => setTimeout(r, 120));
  }

  return {
    attempted: results.length,
    updated: results.filter((r) => r.status === "updated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
