/**
 * Seed script — `npm run db:seed` (add `--reset` to wipe first).
 *
 * Generates a realistic multi-brand dataset: three brands with different access
 * patterns, campaigns at every lifecycle stage, posts across four platforms,
 * and 30 days of cumulative metric snapshots following a decay curve (most of a
 * post's reach lands in its first 48 hours). Daily rollups are computed with
 * the real index functions, so the dashboard shows the same numbers production
 * would.
 *
 * Deterministic: same seed, same data, so screenshots and tests stay stable.
 */
import "dotenv/config";
import { sql } from "drizzle-orm";
import { hashSync } from "bcryptjs";

import { db } from "./index";
import {
  accountSnapshots,
  auditLog,
  brandMembers,
  brands,
  campaignInfluencers,
  campaignKpis,
  campaignMetricsHistory,
  campaigns,
  collectionRuns,
  influencerAccounts,
  influencers,
  insights,
  metricsSnapshots,
  posts,
  users,
  type PlatformName,
} from "./schema";
import {
  effectivenessIndex,
  kpiAttainment,
  prominenceIndex,
  rawEngagements,
} from "../lib/indices";

/* ---------------------------------- rng ---------------------------------- */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260809);

/** Every seeded account shares this password. Change it before any real use. */
const SEED_PASSWORD = "pulse2026";
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
const dayOffset = (days: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/* --------------------------------- fixtures -------------------------------- */

const BRANDS = [
  {
    name: "Halva & Co",
    slug: "halva",
    accentColor: "#E4572E",
    industry: "Food & beverage",
    baselineMonthlyImpressions: 1_800_000,
  },
  {
    name: "Terra Athletics",
    slug: "terra",
    accentColor: "#1B998B",
    industry: "Sportswear",
    baselineMonthlyImpressions: 4_200_000,
  },
  {
    name: "Nimbus Bank",
    slug: "nimbus",
    accentColor: "#3D5AFE",
    industry: "Fintech",
    baselineMonthlyImpressions: 900_000,
  },
] as const;

const PEOPLE = [
  { name: "Dana Levi", email: "dana@agency.test", systemRole: "SUPER_ADMIN" as const, grants: [] },
  {
    name: "Omer Katz",
    email: "omer@agency.test",
    systemRole: "STAFF" as const,
    grants: [["halva", "BRAND_ADMIN"], ["terra", "EDITOR"]] as const,
  },
  {
    name: "Maya Ronen",
    email: "maya@agency.test",
    systemRole: "STAFF" as const,
    grants: [["terra", "BRAND_ADMIN"], ["nimbus", "EDITOR"]] as const,
  },
  {
    name: "Yael Barak",
    email: "yael@nimbusbank.test",
    systemRole: "CLIENT" as const,
    grants: [["nimbus", "VIEWER"]] as const,
  },
  {
    name: "Tom Adler",
    email: "tom@agency.test",
    systemRole: "STAFF" as const,
    grants: [] as const, // deliberately access-less: exercises the empty states
  },
];

const CREATORS = [
  ["Noa Shani", "INSTAGRAM", "noashani", 184_000, 0.041],
  ["Noa Shani", "TIKTOK", "noa.shani", 312_000, 0.058],
  ["Ariel Mor", "INSTAGRAM", "arielmor", 62_000, 0.052],
  ["Ariel Mor", "YOUTUBE", "@arielmorcooks", 91_000, 0.031],
  ["Liron Peled", "TIKTOK", "lironpeled", 1_100_000, 0.067],
  ["Gal Ovadia", "INSTAGRAM", "galovadia", 27_500, 0.074],
  ["Gal Ovadia", "TIKTOK", "gal.ovadia", 44_000, 0.061],
  ["Shira Ben-Ami", "YOUTUBE", "@shirabenami", 240_000, 0.028],
  ["Shira Ben-Ami", "INSTAGRAM", "shirabenami", 130_000, 0.036],
  ["Ido Frisch", "INSTAGRAM", "idofrisch", 410_000, 0.023],
  ["Ido Frisch", "X", "idofrisch", 88_000, 0.017],
  ["Rotem Azulay", "TIKTOK", "rotemazulay", 76_000, 0.069],
] as const;

const CAMPAIGN_BLUEPRINTS = [
  { brand: "halva", name: "Halva Summer Jars", status: "COMPLETED", start: -75, end: -45, budget: 68_000, objective: "Drive trial of the new jar format" },
  { brand: "halva", name: "Back to School Snack Box", status: "ACTIVE", start: -18, end: 12, budget: 92_000, objective: "Own the lunchbox conversation" },
  { brand: "halva", name: "Ramadan Gifting", status: "READY", start: 40, end: 70, budget: 55_000, objective: "Seasonal gifting awareness" },
  { brand: "terra", name: "Trail Series Launch", status: "ACTIVE", start: -26, end: 6, budget: 240_000, objective: "Launch the Trail 2 shoe" },
  { brand: "terra", name: "Winter Layers", status: "COMPLETED", start: -120, end: -80, budget: 150_000, objective: "Clear winter inventory" },
  { brand: "terra", name: "Run Club Ambassadors", status: "PAUSED", start: -40, end: 20, budget: 60_000, objective: "Build the local run-club community" },
  { brand: "nimbus", name: "First Salary Account", status: "ACTIVE", start: -12, end: 18, budget: 130_000, objective: "Acquire 18–24 first-job customers" },
  { brand: "nimbus", name: "Savings Challenge", status: "SCHEDULED", start: 14, end: 45, budget: 75_000, objective: "Drive savings-product signups" },
] as const;

const POST_TYPE_BY_PLATFORM: Record<string, readonly string[]> = {
  INSTAGRAM: ["REEL", "POST", "STORY", "CAROUSEL"],
  TIKTOK: ["TIKTOK"],
  YOUTUBE: ["SHORT", "VIDEO"],
  X: ["POST"],
};

/* ---------------------------------- reset ---------------------------------- */

async function reset() {
  console.log("· truncating");
  await db.execute(sql`
    TRUNCATE TABLE
      ${auditLog}, ${insights}, ${campaignMetricsHistory}, ${metricsSnapshots},
      ${posts}, ${campaignInfluencers}, ${campaignKpis}, ${campaigns},
      ${influencerAccounts}, ${influencers}, ${brandMembers}, ${brands},
      ${collectionRuns}, ${users}
    RESTART IDENTITY CASCADE
  `);
}

/* ----------------------------------- run ----------------------------------- */

async function main() {
  if (process.argv.includes("--reset")) await reset();

  console.log("· brands");
  const brandRows = await db.insert(brands).values([...BRANDS]).returning();
  const brandBySlug = new Map(brandRows.map((b) => [b.slug, b]));

  console.log("· users and brand grants");
  const userRows = await db
    .insert(users)
    .values(
      PEOPLE.map((p) => ({
        name: p.name,
        email: p.email,
        systemRole: p.systemRole,
        passwordHash: hashSync(SEED_PASSWORD, 10),
        emailVerified: dayOffset(-90),
      })),
    )
    .returning();
  const admin = userRows[0];

  // Person in charge per brand: the staff member with the strongest grant.
  const OWNER_BY_SLUG: Record<string, string> = {
    halva: "omer@agency.test",
    terra: "maya@agency.test",
    nimbus: "maya@agency.test",
  };
  for (const [slug, email] of Object.entries(OWNER_BY_SLUG)) {
    const owner = userRows.find((u) => u.email === email);
    const brand = brandBySlug.get(slug);
    if (owner && brand) {
      await db.update(brands).set({ ownerId: owner.id }).where(sql`${brands.id} = ${brand.id}`);
    }
  }

  const grants = PEOPLE.flatMap((p, i) =>
    p.grants.map(([slug, role]) => ({
      userId: userRows[i].id,
      brandId: brandBySlug.get(slug)!.id,
      role,
      grantedById: admin.id,
    })),
  );
  if (grants.length) await db.insert(brandMembers).values(grants);

  console.log("· influencers");
  const creatorNames = [...new Set(CREATORS.map(([name]) => name))];
  const influencerRows = await db
    .insert(influencers)
    .values(
      creatorNames.map((name) => ({
        displayName: name,
        email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}@creators.test`,
        country: "IL",
        tags: [pick(["lifestyle", "food", "fitness", "finance", "family"])],
      })),
    )
    .returning();
  const influencerByName = new Map(influencerRows.map((i) => [i.displayName, i]));

  const accountRows = await db
    .insert(influencerAccounts)
    .values(
      CREATORS.map(([name, platform, handle, followers, er]) => ({
        influencerId: influencerByName.get(name)!.id,
        platform: platform as PlatformName,
        handle,
        profileUrl:
          platform === "YOUTUBE"
            ? `https://youtube.com/${handle}`
            : platform === "TIKTOK"
              ? `https://tiktok.com/@${handle}`
              : `https://instagram.com/${handle}`,
        followerCount: followers,
        avgViews: Math.round(followers * (0.2 + rand() * 0.5)),
        baselineEngagementRate: er,
        followersSyncedAt: dayOffset(-1),
      })),
    )
    .returning();

  // Follower history so the growth component of the creator score has
  // something to read on day one.
  console.log("· account snapshots");
  for (const account of accountRows) {
    const base = account.followerCount ?? 50_000;
    const readings = [90, 60, 30, 0].map((daysAgo, i) => ({
      accountId: account.id,
      capturedAt: dayOffset(-daysAgo),
      followerCount: Math.round(base * (0.88 + i * 0.04 + rand() * 0.02)),
      avgLikes: Math.round(base * (account.baselineEngagementRate ?? 0.04)),
      avgViews: account.avgViews,
      engagementRate: account.baselineEngagementRate,
      source: "seed",
    }));
    await db.insert(accountSnapshots).values(readings);
  }

  console.log("· campaigns, posts, and 30 days of snapshots");
  for (const blueprint of CAMPAIGN_BLUEPRINTS) {
    const brand = brandBySlug.get(blueprint.brand)!;
    const startDate = dayOffset(blueprint.start);
    const endDate = dayOffset(blueprint.end);

    const [campaign] = await db
      .insert(campaigns)
      .values({
        brandId: brand.id,
        name: blueprint.name,
        objective: blueprint.objective,
        status: blueprint.status,
        startDate: isoDay(startDate),
        endDate: isoDay(endDate),
        budget: String(blueprint.budget),
        currency: "ILS",
        meta: {
          hashtags: [`#${blueprint.name.toLowerCase().replace(/\s+/g, "")}`, `#${brand.slug}`],
          utmCampaign: blueprint.name.toLowerCase().replace(/\s+/g, "-"),
        },
        createdById: admin.id,
      })
      .returning();

    await db.insert(campaignKpis).values([
      { campaignId: campaign.id, metric: "IMPRESSIONS", targetValue: String(blueprint.budget * 22), weight: 1 },
      { campaignId: campaign.id, metric: "ENGAGEMENT_RATE", targetValue: "0.045", weight: 1.5 },
      { campaignId: campaign.id, metric: "CLICKS", targetValue: String(Math.round(blueprint.budget / 12)), weight: 1 },
    ]);

    // Roster: 3–5 accounts, no creator twice on the same platform.
    const roster = [...accountRows].sort(() => rand() - 0.5).slice(0, int(3, 5));
    const participants = await db
      .insert(campaignInfluencers)
      .values(
        roster.map((account) => ({
          campaignId: campaign.id,
          influencerId: account.influencerId,
          accountId: account.id,
          fee: String(Math.round((blueprint.budget / roster.length) * (0.6 + rand() * 0.5))),
          inKindValue: String(int(0, 3_000)),
          deliverablesPlanned: int(1, 3),
          contractedAt: dayOffset(blueprint.start - 7),
        })),
      )
      .returning();

    // Draft and scheduled campaigns have no live posts yet — that is the point
    // of seeding them: the UI has to handle a campaign with zero data.
    if (blueprint.status === "DRAFT" || blueprint.status === "SCHEDULED") continue;

    const daysLive = Math.min(30, Math.max(1, Math.floor((Date.now() - startDate.getTime()) / 86_400_000)));
    const campaignDaily = new Map<string, {
      impressionsByPlatform: Record<string, number>;
      reach: number;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      clicks: number;
      creators: Set<string>;
      platforms: Set<string>;
    }>();

    for (const participant of participants) {
      const account = accountRows.find((a) => a.id === participant.accountId)!;
      const deliverables = participant.deliverablesPlanned;

      for (let d = 0; d < deliverables; d++) {
        const publishedAt = dayOffset(blueprint.start + int(0, Math.max(1, Math.floor(daysLive / 2))));
        const platform = account.platform;
        const type = pick(POST_TYPE_BY_PLATFORM[platform] ?? ["POST"]);

        const [post] = await db
          .insert(posts)
          .values({
            campaignInfluencerId: participant.id,
            campaignId: campaign.id,
            platform,
            postType: type as never,
            url: `${account.profileUrl}/p/${campaign.id.slice(0, 6)}-${participant.id.slice(0, 4)}-${d}`,
            caption: `${blueprint.name} — ${account.handle}`,
            publishedAt,
            collectionStatus: "OK",
            lastCollectedAt: dayOffset(0),
          })
          .returning();

        // Reach ceiling for this post, then a saturating curve toward it.
        const ceiling = Math.round(
          (account.avgViews ?? 20_000) * (0.5 + rand() * 1.4) * (type === "STORY" ? 0.35 : 1),
        );
        const er = (account.baselineEngagementRate ?? 0.04) * (0.7 + rand() * 0.8);
        let lastSnapshotId: string | null = null;
        let prevViews = 0;
        let prevEng = 0;

        for (let day = 0; day <= daysLive; day++) {
          const at = dayOffset(blueprint.start + day);
          if (at < publishedAt) continue;
          const age = (at.getTime() - publishedAt.getTime()) / 86_400_000;

          // ~60% of lifetime views in the first two days.
          const progress = 1 - Math.exp(-age / 1.6);
          const views = Math.round(ceiling * progress);
          const reach = Math.round(views * 0.84);
          const likes = Math.round(views * er);
          const comments = Math.round(likes * (0.05 + rand() * 0.05));
          const shares = Math.round(likes * (0.03 + rand() * 0.05));
          const saves = Math.round(likes * (0.06 + rand() * 0.06));
          const clicks = Math.round(views * (0.002 + rand() * 0.004));
          const engagements = likes + comments + shares + saves;

          const [snapshot] = await db
            .insert(metricsSnapshots)
            .values({
              postId: post.id,
              capturedAt: at,
              impressions: Math.round(views * 1.16),
              reach,
              views,
              likes,
              comments,
              shares,
              saves,
              clicks,
              source: "seed",
              deltaViews: views - prevViews,
              deltaEngagements: engagements - prevEng,
            })
            .returning({ id: metricsSnapshots.id });

          lastSnapshotId = snapshot.id;
          prevViews = views;
          prevEng = engagements;

          const key = isoDay(at);
          const bucket = campaignDaily.get(key) ?? {
            impressionsByPlatform: {},
            reach: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0,
            creators: new Set<string>(), platforms: new Set<string>(),
          };
          bucket.impressionsByPlatform[platform] =
            (bucket.impressionsByPlatform[platform] ?? 0) + Math.round(views * 1.16);
          bucket.reach += reach;
          bucket.views += views;
          bucket.likes += likes;
          bucket.comments += comments;
          bucket.shares += shares;
          bucket.saves += saves;
          bucket.clicks += clicks;
          bucket.creators.add(participant.influencerId);
          bucket.platforms.add(platform);
          campaignDaily.set(key, bucket);
        }

        if (lastSnapshotId) {
          await db.update(posts).set({ latestSnapshotId: lastSnapshotId }).where(sql`${posts.id} = ${post.id}`);
        }
      }
    }

    // Daily rollup with the real index functions.
    const days = [...campaignDaily.keys()].sort();
    const history = days.map((day, i) => {
      const b = campaignDaily.get(day)!;
      const spend = (blueprint.budget * (i + 1)) / Math.max(days.length, 1);
      const engagements = rawEngagements(b);
      const engagementRate = b.reach > 0 ? engagements / b.reach : 0;
      const impressions = Object.values(b.impressionsByPlatform).reduce((s, v) => s + v, 0);

      const prom = prominenceIndex({
        impressionsByPlatform: b.impressionsByPlatform as never,
        baselineMonthlyImpressions: brand.baselineMonthlyImpressions ?? 1_000_000,
        activeCreators: b.creators.size,
        plannedCreators: participants.length,
        platformsCovered: b.platforms.size,
        amplifications: b.shares + b.saves,
        totalReach: b.reach,
      });

      const attainment = kpiAttainment([
        { metric: "IMPRESSIONS", target: blueprint.budget * 22, actual: impressions, weight: 1 },
        { metric: "ENGAGEMENT_RATE", target: 0.045, actual: engagementRate, weight: 1.5 },
        { metric: "CLICKS", target: Math.round(blueprint.budget / 12), actual: b.clicks, weight: 1 },
      ]);

      const eff = effectivenessIndex({
        engagements: b,
        reach: b.reach,
        spend,
        baselineEngagementRate: 0.04,
        kpiAttainment: attainment,
      });

      return {
        campaignId: campaign.id,
        day,
        impressions,
        reach: b.reach,
        views: b.views,
        engagements,
        clicks: b.clicks,
        spend: spend.toFixed(2),
        engagementRate,
        cpm: impressions > 0 ? (spend / impressions) * 1000 : null,
        cpe: engagements > 0 ? spend / engagements : null,
        prominenceIndex: prom.score,
        effectivenessIndex: eff.score,
        indexInputs: { prominence: prom.components, effectiveness: eff.components, attainment },
      };
    });

    if (history.length) {
      await db.insert(campaignMetricsHistory).values(history);

      const last = history.at(-1)!;
      await db.insert(insights).values([
        {
          campaignId: campaign.id,
          kind: "SUMMARY",
          title: `Prominence at ${last.prominenceIndex?.toFixed(0)} on ${last.day}`,
          body: `The campaign reached ${last.reach.toLocaleString()} accounts across ${
            new Set(participants.map((p) => p.influencerId)).size
          } creators. Engagement rate sits at ${(last.engagementRate! * 100).toFixed(1)}%, against a 4.5% target.`,
          confidence: 0.9,
          model: "seed",
        },
        {
          campaignId: campaign.id,
          kind: "RECOMMENDATION",
          title: "Shift budget toward short-form video",
          body: "Short-form posts are returning a lower cost per weighted engagement than static formats in this campaign. Consider moving the next allocation toward Reels and TikToks, and renegotiating static-only deliverables.",
          confidence: 0.62,
          model: "seed",
        },
      ]);
    }
  }

  await db.insert(collectionRuns).values({
    trigger: "backfill",
    finishedAt: new Date(),
    postsAttempted: 0,
    postsSucceeded: 0,
  });

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM ${brands}) AS brands,
      (SELECT count(*) FROM ${users}) AS users,
      (SELECT count(*) FROM ${campaigns}) AS campaigns,
      (SELECT count(*) FROM ${posts}) AS posts,
      (SELECT count(*) FROM ${metricsSnapshots}) AS snapshots
  `);
  console.log("✓ seeded", counts.rows?.[0] ?? counts);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("seed failed:", err);
    process.exit(1);
  });
