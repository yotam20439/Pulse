"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  auditLog,
  brands,
  campaignInfluencers,
  campaignKpis,
  campaigns,
  influencerAccounts,
  influencers,
  posts,
  type BrandRole,
} from "@/db/schema";
import { isSuperAdmin, requireBrandAccess, requireUser } from "@/lib/rbac";

export type ActionState = { error?: string; ok?: string };

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

async function record(
  actorId: string,
  brandId: string | null,
  action: string,
  entity: string,
  entityId: string,
  diff?: unknown,
) {
  await db.insert(auditLog).values({ actorId, brandId, action, entity, entityId, diff: diff ?? null });
}

/* ------------------------------- brands ---------------------------------- */

export async function createBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) return { error: "Only administrators can create brands." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give the brand a name." };

  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const [clash] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, slug));
  if (clash) return { error: `The slug "${slug}" is already taken.` };

  const baseline = Number(formData.get("baseline") ?? 0);

  const [brand] = await db
    .insert(brands)
    .values({
      name,
      slug,
      industry: String(formData.get("industry") ?? "").trim() || null,
      accentColor: String(formData.get("accentColor") ?? "#6D4AFF"),
      // The Prominence Index is measured against this, so a wrong value here
      // skews every campaign the brand runs.
      baselineMonthlyImpressions: Number.isFinite(baseline) && baseline > 0 ? baseline : null,
    })
    .returning({ id: brands.id });

  await record(user.id, brand.id, "brand.create", "brand", brand.id, { name, slug });
  revalidatePath("/settings/brands");
  return { ok: `Created ${name}.` };
}

export async function updateBrand(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const brandId = String(formData.get("brandId") ?? "");
  if (!isSuperAdmin(user)) await requireBrandAccess(brandId, "BRAND_ADMIN");

  const baseline = Number(formData.get("baseline") ?? 0);
  await db
    .update(brands)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      industry: String(formData.get("industry") ?? "").trim() || null,
      accentColor: String(formData.get("accentColor") ?? "#6D4AFF"),
      baselineMonthlyImpressions: Number.isFinite(baseline) && baseline > 0 ? baseline : null,
    })
    .where(eq(brands.id, brandId));

  await record(user.id, brandId, "brand.update", "brand", brandId);
  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/settings/brands");
  return { ok: "Saved." };
}

/* ------------------------------ campaigns -------------------------------- */

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const brandId = String(formData.get("brandId") ?? "");
  if (!brandId) return { error: "Choose a brand." };

  // Authorisation is on the brand the campaign belongs to, not on the form.
  const { user } = await requireBrandAccess(brandId, "EDITOR");

  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  if (!name) return { error: "Give the campaign a name." };
  if (!startDate) return { error: "Set a start date." };

  const endDate = String(formData.get("endDate") ?? "") || null;
  if (endDate && endDate < startDate) return { error: "The end date is before the start date." };

  const budget = Number(formData.get("budget") ?? 0);

  const [campaign] = await db
    .insert(campaigns)
    .values({
      brandId,
      name,
      objective: String(formData.get("objective") ?? "").trim() || null,
      status: (formData.get("status") as never) ?? "DRAFT",
      startDate,
      endDate,
      budget: String(Number.isFinite(budget) ? budget : 0),
      currency: String(formData.get("currency") ?? "ILS"),
      createdById: user.id,
      meta: {
        hashtags: String(formData.get("hashtags") ?? "")
          .split(/[\s,]+/)
          .filter(Boolean),
      },
    })
    .returning({ id: campaigns.id });

  // Targets are what make the Effectiveness Index meaningful, so they are set
  // at creation rather than left for later.
  const kpiRows = (
    [
      ["IMPRESSIONS", formData.get("targetImpressions"), 1],
      ["ENGAGEMENT_RATE", formData.get("targetEngagementRate"), 1.5],
      ["CLICKS", formData.get("targetClicks"), 1],
    ] as const
  )
    .map(([metric, raw, weight]) => ({ metric, value: Number(raw ?? 0), weight }))
    .filter((k) => Number.isFinite(k.value) && k.value > 0)
    .map((k) => ({
      campaignId: campaign.id,
      metric: k.metric as never,
      targetValue: String(k.value),
      weight: k.weight,
    }));

  if (kpiRows.length) await db.insert(campaignKpis).values(kpiRows);

  await record(user.id, brandId, "campaign.create", "campaign", campaign.id, { name });
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const campaignId = String(formData.get("campaignId") ?? "");
  const [existing] = await db
    .select({ brandId: campaigns.brandId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (!existing) return { error: "Campaign not found." };

  const { user } = await requireBrandAccess(existing.brandId, "EDITOR");

  const budget = Number(formData.get("budget") ?? 0);
  await db
    .update(campaigns)
    .set({
      name: String(formData.get("name") ?? "").trim(),
      objective: String(formData.get("objective") ?? "").trim() || null,
      status: (formData.get("status") as never) ?? "DRAFT",
      startDate: String(formData.get("startDate") ?? ""),
      endDate: String(formData.get("endDate") ?? "") || null,
      budget: String(Number.isFinite(budget) ? budget : 0),
      currency: String(formData.get("currency") ?? "ILS"),
      updatedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId));

  await record(user.id, existing.brandId, "campaign.update", "campaign", campaignId);
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: "Saved." };
}

export async function setKpi(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const [existing] = await db
    .select({ brandId: campaigns.brandId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (!existing) return;

  await requireBrandAccess(existing.brandId, "EDITOR");

  const metric = String(formData.get("metric") ?? "") as never;
  const value = Number(formData.get("targetValue") ?? 0);
  const weight = Number(formData.get("weight") ?? 1);

  await db
    .insert(campaignKpis)
    .values({ campaignId, metric, targetValue: String(value), weight })
    .onConflictDoUpdate({
      target: [campaignKpis.campaignId, campaignKpis.metric],
      set: { targetValue: String(value), weight },
    });

  revalidatePath(`/campaigns/${campaignId}/settings`);
}

/* ------------------------------- roster ---------------------------------- */

export async function addParticipant(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const accountId = String(formData.get("accountId") ?? "");
  if (!campaignId || !accountId) return;

  const [campaign] = await db
    .select({ brandId: campaigns.brandId })
    .from(campaigns)
    .where(eq(campaigns.id, campaignId));
  if (!campaign) return;

  const { user } = await requireBrandAccess(campaign.brandId, "EDITOR");

  const [account] = await db
    .select({ influencerId: influencerAccounts.influencerId })
    .from(influencerAccounts)
    .where(eq(influencerAccounts.id, accountId));
  if (!account) return;

  const fee = Number(formData.get("fee") ?? 0);
  const inKind = Number(formData.get("inKindValue") ?? 0);
  const deliverables = Number(formData.get("deliverablesPlanned") ?? 1);

  await db
    .insert(campaignInfluencers)
    .values({
      campaignId,
      accountId,
      influencerId: account.influencerId,
      fee: String(Number.isFinite(fee) ? fee : 0),
      inKindValue: String(Number.isFinite(inKind) ? inKind : 0),
      deliverablesPlanned: Number.isFinite(deliverables) ? deliverables : 1,
      contractedAt: new Date(),
    })
    .onConflictDoNothing();

  await record(user.id, campaign.brandId, "campaign.participant_add", "campaign", campaignId, {
    accountId,
  });
  revalidatePath(`/campaigns/${campaignId}/settings`);
}

export async function removeParticipant(formData: FormData) {
  const participantId = String(formData.get("participantId") ?? "");
  const [row] = await db
    .select({ campaignId: campaignInfluencers.campaignId, brandId: campaigns.brandId })
    .from(campaignInfluencers)
    .innerJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
    .where(eq(campaignInfluencers.id, participantId));
  if (!row) return;

  await requireBrandAccess(row.brandId, "EDITOR");
  // Cascades to that creator's posts and their snapshot history.
  await db.delete(campaignInfluencers).where(eq(campaignInfluencers.id, participantId));
  revalidatePath(`/campaigns/${row.campaignId}/settings`);
}

/* -------------------------------- posts ---------------------------------- */

const PLATFORM_FROM_URL: [RegExp, string][] = [
  [/instagram\.com/i, "INSTAGRAM"],
  [/tiktok\.com/i, "TIKTOK"],
  [/(youtube\.com|youtu\.be)/i, "YOUTUBE"],
  [/facebook\.com/i, "FACEBOOK"],
  [/(twitter\.com|x\.com)/i, "X"],
  [/linkedin\.com/i, "LINKEDIN"],
  [/(t\.me|telegram\.me)/i, "TELEGRAM"],
];

export async function addPost(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const campaignId = String(formData.get("campaignId") ?? "");
  const participantId = String(formData.get("participantId") ?? "");
  const url = String(formData.get("url") ?? "").trim();

  if (!participantId) return { error: "Choose which creator published this." };
  if (!/^https?:\/\//i.test(url)) return { error: "Paste the full post URL, including https://" };

  const [participant] = await db
    .select({ brandId: campaigns.brandId, accountId: campaignInfluencers.accountId })
    .from(campaignInfluencers)
    .innerJoin(campaigns, eq(campaignInfluencers.campaignId, campaigns.id))
    .where(
      and(eq(campaignInfluencers.id, participantId), eq(campaignInfluencers.campaignId, campaignId)),
    );
  if (!participant) return { error: "That creator isn't on this campaign." };

  const { user } = await requireBrandAccess(participant.brandId, "EDITOR");

  const [clash] = await db.select({ id: posts.id }).from(posts).where(eq(posts.url, url));
  if (clash) return { error: "That URL is already being tracked." };

  const platform =
    (formData.get("platform") as string) ||
    PLATFORM_FROM_URL.find(([re]) => re.test(url))?.[1] ||
    "INSTAGRAM";

  const publishedAt = String(formData.get("publishedAt") ?? "");

  const [post] = await db
    .insert(posts)
    .values({
      campaignId,
      campaignInfluencerId: participantId,
      platform: platform as never,
      postType: (formData.get("postType") as never) ?? "POST",
      url,
      caption: String(formData.get("caption") ?? "").trim() || null,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      collectionStatus: "PENDING",
    })
    .returning({ id: posts.id });

  await record(user.id, participant.brandId, "post.create", "post", post.id, { url, platform });
  revalidatePath(`/campaigns/${campaignId}`);
  return { ok: "Tracking started. Metrics appear after the next collection run." };
}

export async function setPostTracking(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const isTracked = formData.get("isTracked") === "true";

  const [row] = await db
    .select({ campaignId: posts.campaignId, brandId: campaigns.brandId })
    .from(posts)
    .innerJoin(campaigns, eq(posts.campaignId, campaigns.id))
    .where(eq(posts.id, postId));
  if (!row) return;

  await requireBrandAccess(row.brandId, "EDITOR");
  await db.update(posts).set({ isTracked }).where(eq(posts.id, postId));
  revalidatePath(`/campaigns/${row.campaignId}`);
}

/* ----------------------------- influencers -------------------------------- */

export async function createInfluencer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  // The roster is shared across brands, so any user with a brand may add to it.
  if (Object.keys(user.brands).length === 0 && !isSuperAdmin(user)) {
    return { error: "You need access to at least one brand." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const handle = String(formData.get("handle") ?? "").trim().replace(/^@/, "");
  const platform = String(formData.get("platform") ?? "INSTAGRAM");
  const profileUrl = String(formData.get("profileUrl") ?? "").trim();

  if (!displayName) return { error: "Give the creator a name." };
  if (!handle) return { error: "Add their handle." };
  if (!/^https?:\/\//i.test(profileUrl)) return { error: "Add the full profile URL." };

  const [clash] = await db
    .select({ id: influencerAccounts.id })
    .from(influencerAccounts)
    .where(
      and(
        eq(influencerAccounts.platform, platform as never),
        eq(influencerAccounts.handle, handle),
      ),
    );
  if (clash) return { error: "That handle is already in the roster for this platform." };

  const [influencer] = await db
    .insert(influencers)
    .values({
      displayName,
      email: String(formData.get("email") ?? "").trim() || null,
      agency: String(formData.get("agency") ?? "").trim() || null,
      country: String(formData.get("country") ?? "").trim() || null,
    })
    .returning({ id: influencers.id });

  const followers = Number(formData.get("followerCount") ?? 0);
  const baselineEr = Number(formData.get("baselineEngagementRate") ?? 0);

  await db.insert(influencerAccounts).values({
    influencerId: influencer.id,
    platform: platform as never,
    handle,
    profileUrl,
    followerCount: Number.isFinite(followers) && followers > 0 ? followers : null,
    // Effectiveness is measured as lift over this, so a missing value falls
    // back to a flat 4% rather than flattering the creator.
    baselineEngagementRate: baselineEr > 0 && baselineEr < 1 ? baselineEr : null,
  });

  revalidatePath("/influencers");
  return { ok: `Added ${displayName}.` };
}
