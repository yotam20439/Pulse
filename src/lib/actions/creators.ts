"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  accountSnapshots,
  auditLog,
  campaignInfluencers,
  campaigns,
  influencerAccounts,
  influencers,
} from "@/db/schema";
import { isSuperAdmin, requireBrandAccess, requireUser } from "@/lib/rbac";
import { parseMany, parseSocialLink, suggestName } from "@/lib/social-links";

export type ActionState = { error?: string; ok?: string; createdId?: string };

/**
 * Creators are added by pasting a link, at the moment someone needs them —
 * not selected from a list curated in advance.
 *
 * The old flow made the roster authoritative: you could only book someone who
 * had already been entered, which meant the tool blocked the exact thing it
 * exists to support. Now the roster is a memory of who you've worked with, and
 * a paste is always available.
 */

async function assertCanEditRoster() {
  const user = await requireUser();
  if (!isSuperAdmin(user) && Object.keys(user.brands).length === 0) {
    throw new Error("You need access to at least one brand.");
  }
  return user;
}

/**
 * Paste one or more profile links. Handles that already exist attach to the
 * existing creator rather than creating a duplicate, because the same person
 * legitimately appears on four platforms.
 */
export async function addCreatorByLink(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await assertCanEditRoster();

  const links = parseMany(String(formData.get("links") ?? ""));
  if (links.length === 0) {
    return {
      error:
        "No usable link found. Paste a profile or post URL from Instagram, TikTok, YouTube, Facebook, X, LinkedIn, or Telegram.",
    };
  }

  const providedName = String(formData.get("displayName") ?? "").trim();
  const existingId = String(formData.get("influencerId") ?? "").trim();

  // If any pasted handle is already known, attach everything to that creator.
  let influencerId = existingId || null;
  if (!influencerId) {
    for (const link of links) {
      const [match] = await db
        .select({ influencerId: influencerAccounts.influencerId })
        .from(influencerAccounts)
        .where(
          and(
            eq(influencerAccounts.platform, link.platform),
            eq(influencerAccounts.handle, link.handle),
          ),
        );
      if (match) {
        influencerId = match.influencerId;
        break;
      }
    }
  }

  let created = false;
  if (!influencerId) {
    const [creator] = await db
      .insert(influencers)
      .values({
        displayName: providedName || suggestName(links[0].handle),
        email: String(formData.get("email") ?? "").trim() || null,
        agency: String(formData.get("agency") ?? "").trim() || null,
        country: String(formData.get("country") ?? "").trim() || null,
        tags: String(formData.get("tags") ?? "")
          .split(/[,\s]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      })
      .returning({ id: influencers.id });
    influencerId = creator.id;
    created = true;
  } else if (providedName) {
    await db.update(influencers).set({ displayName: providedName }).where(eq(influencers.id, influencerId));
  }

  const followers = Number(formData.get("followerCount") ?? 0);
  const er = Number(formData.get("baselineEngagementRate") ?? 0);

  let attached = 0;
  for (const link of links) {
    const [clash] = await db
      .select({ id: influencerAccounts.id })
      .from(influencerAccounts)
      .where(
        and(
          eq(influencerAccounts.platform, link.platform),
          eq(influencerAccounts.handle, link.handle),
        ),
      );
    if (clash) continue;

    // Stats entered here apply to the first account only — a follower count
    // typed once shouldn't be silently copied onto three other platforms.
    const isFirst = attached === 0 && links.length === 1;

    await db.insert(influencerAccounts).values({
      influencerId,
      platform: link.platform,
      handle: link.handle,
      profileUrl: link.profileUrl,
      followerCount: isFirst && followers > 0 ? followers : null,
      baselineEngagementRate: isFirst && er > 0 && er < 1 ? er : null,
      statsSource: "manual",
      followersSyncedAt: isFirst && followers > 0 ? new Date() : null,
    });
    attached += 1;
  }

  await db.insert(auditLog).values({
    actorId: user.id,
    action: created ? "creator.create" : "creator.link_add",
    entity: "influencer",
    entityId: influencerId,
    diff: { links: links.map((l) => `${l.platform}:${l.handle}`) },
  });

  // Optionally book them onto a campaign in the same step — the common case is
  // "I found someone, put them on this campaign".
  const campaignId = String(formData.get("campaignId") ?? "");
  if (campaignId) {
    const [campaign] = await db
      .select({ brandId: campaigns.brandId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId));

    if (campaign) {
      await requireBrandAccess(campaign.brandId, "EDITOR");
      const [account] = await db
        .select({ id: influencerAccounts.id })
        .from(influencerAccounts)
        .where(
          and(
            eq(influencerAccounts.influencerId, influencerId),
            eq(influencerAccounts.platform, links[0].platform),
          ),
        );

      if (account) {
        const fee = Number(formData.get("fee") ?? 0);
        await db
          .insert(campaignInfluencers)
          .values({
            campaignId,
            influencerId,
            accountId: account.id,
            fee: String(Number.isFinite(fee) ? fee : 0),
            deliverablesPlanned: Number(formData.get("deliverablesPlanned") ?? 1) || 1,
            contractedAt: new Date(),
          })
          .onConflictDoNothing();
      }
      revalidatePath(`/campaigns/${campaignId}/settings`);
    }
  }

  revalidatePath("/influencers");
  revalidatePath(`/influencers/${influencerId}`);

  const skipped = links.length - attached;
  return {
    ok:
      attached === 0
        ? "Those accounts were already in the roster."
        : `${created ? "Added" : "Updated"} creator with ${attached} account${attached === 1 ? "" : "s"}${
            skipped > 0 ? ` (${skipped} already known)` : ""
          }.`,
    createdId: influencerId,
  };
}

/** Adds one more platform to a creator who already exists. */
export async function addAccountToCreator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertCanEditRoster();

  const influencerId = String(formData.get("influencerId") ?? "");
  const link = parseSocialLink(String(formData.get("url") ?? ""));
  if (!link) return { error: "That link wasn't recognised as a social profile." };

  const [clash] = await db
    .select({ id: influencerAccounts.id })
    .from(influencerAccounts)
    .where(
      and(eq(influencerAccounts.platform, link.platform), eq(influencerAccounts.handle, link.handle)),
    );
  if (clash) return { error: `@${link.handle} on ${link.platform.toLowerCase()} is already in the roster.` };

  await db.insert(influencerAccounts).values({
    influencerId,
    platform: link.platform,
    handle: link.handle,
    profileUrl: link.profileUrl,
    statsSource: "manual",
  });

  revalidatePath(`/influencers/${influencerId}`);
  return { ok: `Added ${link.platform.toLowerCase()} account @${link.handle}.` };
}

/**
 * Updating profile stats also writes a snapshot, so follower growth becomes
 * visible over time rather than only ever showing the latest figure.
 */
export async function updateAccountStats(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertCanEditRoster();

  const accountId = String(formData.get("accountId") ?? "");
  const [account] = await db
    .select()
    .from(influencerAccounts)
    .where(eq(influencerAccounts.id, accountId));
  if (!account) return { error: "Account not found." };

  const number = (key: string) => {
    const value = Number(formData.get(key) ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
  };
  const er = Number(formData.get("baselineEngagementRate") ?? 0);
  const engagementRate = er > 0 && er < 1 ? er : null;

  await db
    .update(influencerAccounts)
    .set({
      followerCount: number("followerCount") ?? account.followerCount,
      avgLikes: number("avgLikes") ?? account.avgLikes,
      avgComments: number("avgComments") ?? account.avgComments,
      avgViews: number("avgViews") ?? account.avgViews,
      baselineEngagementRate: engagementRate ?? account.baselineEngagementRate,
      statsSource: "manual",
      followersSyncedAt: new Date(),
    })
    .where(eq(influencerAccounts.id, accountId));

  await db.insert(accountSnapshots).values({
    accountId,
    followerCount: number("followerCount"),
    avgLikes: number("avgLikes"),
    avgViews: number("avgViews"),
    engagementRate,
    source: "manual",
  });

  revalidatePath(`/influencers/${account.influencerId}`);
  return { ok: "Stats updated." };
}

export async function removeAccount(formData: FormData) {
  await assertCanEditRoster();
  const accountId = String(formData.get("accountId") ?? "");
  const influencerId = String(formData.get("influencerId") ?? "");

  // Refuses if the account is booked — deleting it would orphan tracked posts.
  const [booked] = await db
    .select({ id: campaignInfluencers.id })
    .from(campaignInfluencers)
    .where(eq(campaignInfluencers.accountId, accountId));
  if (booked) return;

  await db.delete(influencerAccounts).where(eq(influencerAccounts.id, accountId));
  revalidatePath(`/influencers/${influencerId}`);
}

/**
 * Manual refresh from the creator page. Returns the provider's own message on
 * failure rather than a generic error — "that account is personal, so Graph
 * can't read it" is actionable; "sync failed" is not.
 */
export async function refreshAccountStats(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertCanEditRoster();

  const accountId = String(formData.get("accountId") ?? "");
  const influencerId = String(formData.get("influencerId") ?? "");

  const { syncAccount } = await import("@/lib/profile-sync");
  const outcome = await syncAccount(accountId);

  revalidatePath(`/influencers/${influencerId}`);

  if (outcome.status === "updated") {
    const delta = outcome.followerDelta;
    return {
      ok:
        delta != null && delta !== 0
          ? `Updated from the platform. Followers ${delta > 0 ? "+" : ""}${delta.toLocaleString()} since last check.`
          : "Updated from the platform.",
    };
  }

  return { error: outcome.reason ?? "Could not refresh." };
}
