"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  accountSnapshots,
  auditLog,
  campaignInfluencers,
  campaigns,
  influencerAccounts,
  influencers,
  posts,
} from "@/db/schema";
import { getDictionary, t } from "@/lib/i18n";
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
  const d = await getDictionary();
  const user = await assertCanEditRoster();

  const links = parseMany(String(formData.get("links") ?? ""));
  if (links.length === 0) {
    return { error: d.errors.noUsableLink };
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
  const newAccountIds: { id: string; platform: string; handle: string }[] = [];

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

    const [inserted] = await db
      .insert(influencerAccounts)
      .values({
        influencerId,
        platform: link.platform,
        handle: link.handle,
        profileUrl: link.profileUrl,
        followerCount: isFirst && followers > 0 ? followers : null,
        baselineEngagementRate: isFirst && er > 0 && er < 1 ? er : null,
        statsSource: "manual",
        followersSyncedAt: isFirst && followers > 0 ? new Date() : null,
      })
      .returning({ id: influencerAccounts.id });

    newAccountIds.push({ id: inserted.id, platform: link.platform, handle: link.handle });
    attached += 1;
  }

  /**
   * Pull live stats for every account just created, so a pasted link produces
   * numbers immediately rather than after a separate Refresh click.
   *
   * Failures are collected and reported, never thrown: a TikTok link with no
   * vendor configured should still add the creator, just without stats. The
   * whole batch is capped so one slow provider can't hang the form.
   */
  const fetched: string[] = [];
  const unfetched: string[] = [];

  if (newAccountIds.length > 0) {
    const { syncAccount } = await import("@/lib/profile-sync");

    const outcomes = await Promise.allSettled(
      newAccountIds.map(async (account) => {
        const result = await Promise.race([
          syncAccount(account.id),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
        ]);
        return { account, result };
      }),
    );

    for (const outcome of outcomes) {
      if (outcome.status !== "fulfilled" || !outcome.value.result) continue;
      const { account, result } = outcome.value;
      if (result.status === "updated") fetched.push(`@${account.handle}`);
      else unfetched.push(account.platform.toLowerCase());
    }
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

  if (attached === 0) {
    return { ok: d.ok.alreadyInRoster, createdId: influencerId };
  }

  const parts = [
    t(d.ok.creatorAdded, {
      verb: created ? d.ok.verbAdded : d.ok.verbUpdated,
      n: attached,
    }),
  ];
  if (skipped > 0) parts.push(t(d.ok.alreadyKnown, { n: skipped }));
  if (fetched.length > 0) parts.push(t(d.ok.statsPulled, { handles: fetched.join(", ") }));
  if (unfetched.length > 0) {
    parts.push(t(d.ok.noProviderFor, { platforms: [...new Set(unfetched)].join(", ") }));
  }

  return { ok: `${parts.join(" · ")}.`, createdId: influencerId };
}

/** Adds one more platform to a creator who already exists. */
export async function addAccountToCreator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const d = await getDictionary();
  await assertCanEditRoster();

  const influencerId = String(formData.get("influencerId") ?? "");
  const link = parseSocialLink(String(formData.get("url") ?? ""));
  if (!link) return { error: d.errors.linkNotRecognised };

  const [clash] = await db
    .select({ id: influencerAccounts.id })
    .from(influencerAccounts)
    .where(
      and(eq(influencerAccounts.platform, link.platform), eq(influencerAccounts.handle, link.handle)),
    );
  if (clash) return { error: t(d.errors.handleExists, { handle: link.handle, platform: link.platform.toLowerCase() }) };

  const [inserted] = await db
    .insert(influencerAccounts)
    .values({
      influencerId,
      platform: link.platform,
      handle: link.handle,
      profileUrl: link.profileUrl,
      statsSource: "manual",
    })
    .returning({ id: influencerAccounts.id });

  const { syncAccount } = await import("@/lib/profile-sync");
  const outcome = await syncAccount(inserted.id);

  revalidatePath(`/influencers/${influencerId}`);

  return {
    ok:
      outcome.status === "updated"
        ? t(d.ok.accountAdded, {
            handle: `@${link.handle}`,
            platform: link.platform.toLowerCase(),
          })
        : t(d.ok.accountAddedNoStats, {
            handle: `@${link.handle}`,
            reason: outcome.reason ?? "",
          }),
  };
}

/**
 * Updating profile stats also writes a snapshot, so follower growth becomes
 * visible over time rather than only ever showing the latest figure.
 */
export async function updateAccountStats(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const d = await getDictionary();
  await assertCanEditRoster();

  const accountId = String(formData.get("accountId") ?? "");
  const [account] = await db
    .select()
    .from(influencerAccounts)
    .where(eq(influencerAccounts.id, accountId));
  if (!account) return { error: d.errors.accountNotFound };

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
  return { ok: d.ok.statsUpdated };
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
  const d = await getDictionary();
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
          ? t(d.ok.refreshedDelta, {
              delta: `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`,
            })
          : d.ok.refreshed,
    };
  }

  return { error: outcome.reason ?? d.errors.couldNotRefresh };
}

/**
 * Permanently deletes a creator and every account, booking, post, and metric
 * snapshot attached to them.
 *
 * Refuses while they have tracked posts. Those posts are the campaign record —
 * removing a creator would silently reduce reach and engagement totals on
 * campaigns that already happened, changing history that someone may have
 * reported to a client. Unbook them from the campaign instead, which keeps the
 * numbers intact.
 */
export async function deleteCreator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const d = await getDictionary();
  const user = await assertCanEditRoster();
  const influencerId = String(formData.get("influencerId") ?? "");

  const [creator] = await db.select().from(influencers).where(eq(influencers.id, influencerId));
  if (!creator) return { error: d.errors.notFound };

  if (String(formData.get("confirm") ?? "").trim() !== creator.displayName) {
    return { error: t(d.errors.typeNameToConfirm, { name: creator.displayName }) };
  }

  const [{ postCount }] = await db
    .select({ postCount: sql<number>`count(*)`.mapWith(Number) })
    .from(posts)
    .innerJoin(campaignInfluencers, eq(posts.campaignInfluencerId, campaignInfluencers.id))
    .where(eq(campaignInfluencers.influencerId, influencerId));

  const force = formData.get("force") === "on";

  if (postCount > 0 && !force) {
    const [{ campaignCount }] = await db
      .select({ campaignCount: sql<number>`count(distinct ${campaignInfluencers.campaignId})`.mapWith(Number) })
      .from(campaignInfluencers)
      .where(eq(campaignInfluencers.influencerId, influencerId));

    return {
      error: t(d.errors.creatorHasPosts, {
        name: creator.displayName,
        posts: postCount,
        campaigns: campaignCount,
      }),
    };
  }

  // Bookings cascade to posts and their snapshots; accounts cascade from the
  // creator row.
  await db.delete(campaignInfluencers).where(eq(campaignInfluencers.influencerId, influencerId));
  await db.delete(influencers).where(eq(influencers.id, influencerId));

  await db.insert(auditLog).values({
    actorId: user.id,
    action: "creator.delete",
    entity: "influencer",
    entityId: influencerId,
    diff: { displayName: creator.displayName },
  });

  revalidatePath("/influencers");
  redirect("/influencers");
}

/**
 * Single-field edits from a list row. Kept separate from the full form so an
 * inline save can't accidentally blank the fields it doesn't include — a
 * partial FormData through the main update path would do exactly that.
 */
export async function updateCreatorField(formData: FormData) {
  await assertCanEditRoster();

  const influencerId = String(formData.get("influencerId") ?? "");
  if (!influencerId) return;

  const displayName = formData.get("displayName");
  const tags = formData.get("tags");

  const patch: Record<string, unknown> = {};
  if (typeof displayName === "string" && displayName.trim()) {
    patch.displayName = displayName.trim();
  }
  if (typeof tags === "string") {
    patch.tags = tags.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  }

  if (Object.keys(patch).length === 0) return;

  await db.update(influencers).set(patch).where(eq(influencers.id, influencerId));
  revalidatePath("/influencers");
  revalidatePath(`/influencers/${influencerId}`);
}

/** Inline stats edit from the roster list. */
export async function updateAccountField(formData: FormData) {
  await assertCanEditRoster();

  const accountId = String(formData.get("accountId") ?? "");
  const [account] = await db
    .select()
    .from(influencerAccounts)
    .where(eq(influencerAccounts.id, accountId));
  if (!account) return;

  const patch: Record<string, unknown> = {};

  const followers = Number(formData.get("followerCount"));
  if (Number.isFinite(followers) && followers > 0) patch.followerCount = Math.round(followers);

  const er = Number(formData.get("baselineEngagementRate"));
  if (Number.isFinite(er) && er > 0 && er < 1) patch.baselineEngagementRate = er;

  if (Object.keys(patch).length === 0) return;

  // A hand edit downgrades the source: these numbers are no longer whatever
  // the platform last returned, and the score weights them accordingly.
  patch.statsSource = "manual";
  patch.followersSyncedAt = new Date();

  await db.update(influencerAccounts).set(patch).where(eq(influencerAccounts.id, accountId));
  revalidatePath("/influencers");
  revalidatePath(`/influencers/${account.influencerId}`);
}
