import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import type { AdapterAccountType } from "next-auth/adapters";

/* -------------------------------------------------------------------------- */
/*  Enums                                                                      */
/* -------------------------------------------------------------------------- */

/** Platform-wide role. Brand-level access is granted separately (brandMembers). */
export const systemRole = pgEnum("system_role", [
  "SUPER_ADMIN", // full access to every brand, manages users
  "STAFF", // internal team member; sees only assigned brands
  "CLIENT", // external brand-side user; read-mostly, assigned brands only
]);

/** Role a user holds *within one brand*. */
export const brandRole = pgEnum("brand_role", [
  "BRAND_ADMIN", // manage campaigns, influencers, and brand members
  "EDITOR", // create/edit campaigns and posts
  "VIEWER", // read-only dashboards and exports
]);

export const platform = pgEnum("platform", [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "FACEBOOK",
  "X",
  "LINKEDIN",
  "TELEGRAM",
]);

export const postType = pgEnum("post_type", [
  "POST",
  "REEL",
  "STORY",
  "CAROUSEL",
  "TIKTOK",
  "SHORT",
  "VIDEO",
  "LIVE",
]);

export const campaignStatus = pgEnum("campaign_status", [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
]);

export const metricKind = pgEnum("metric_kind", [
  "IMPRESSIONS",
  "REACH",
  "VIEWS",
  "LIKES",
  "COMMENTS",
  "SHARES",
  "SAVES",
  "CLICKS",
  "ENGAGEMENT_RATE",
  "CPM",
  "CPE",
  "PROMINENCE_INDEX",
  "EFFECTIVENESS_INDEX",
]);

export const collectionStatus = pgEnum("collection_status", [
  "PENDING",
  "OK",
  "PARTIAL",
  "FAILED",
  "UNAVAILABLE", // post deleted or went private
]);

export const insightKind = pgEnum("insight_kind", [
  "TREND",
  "ANOMALY",
  "RECOMMENDATION",
  "SUMMARY",
]);

/* -------------------------------------------------------------------------- */
/*  Auth.js (NextAuth) core tables                                             */
/* -------------------------------------------------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  /** bcrypt hash. Null means the account cannot sign in with a password yet. */
  passwordHash: text("password_hash"),
  systemRole: systemRole("system_role").notNull().default("STAFF"),
  isActive: boolean("is_active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_key").on(t.email)]);

export const accounts = pgTable("accounts", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").$type<AdapterAccountType>().notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })]);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
}, (t) => [primaryKey({ columns: [t.identifier, t.token] })]);

/* -------------------------------------------------------------------------- */
/*  Brands + per-brand access control                                          */
/* -------------------------------------------------------------------------- */

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  logoUrl: text("logo_url"),
  /** Hex accent used to tint the brand's dashboard. */
  accentColor: text("accent_color").notNull().default("#6D28D9"),
  industry: text("industry"),
  /** Person accountable for this brand. Shown everywhere the brand appears. */
  ownerId: uuid("owner_id"),
  notes: text("notes"),
  /** Follower/impression baseline used to normalise the Prominence Index. */
  baselineMonthlyImpressions: integer("baseline_monthly_impressions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("brands_slug_key").on(t.slug)]);

/**
 * The RBAC join table. A user sees a brand only if a row exists here
 * (SUPER_ADMIN bypasses this check in `src/lib/rbac.ts`).
 */
export const brandMembers = pgTable("brand_members", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  role: brandRole("role").notNull().default("VIEWER"),
  grantedById: uuid("granted_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.brandId] }),
  index("brand_members_brand_idx").on(t.brandId),
]);

/* -------------------------------------------------------------------------- */
/*  Influencers (global directory, reusable across brands)                     */
/* -------------------------------------------------------------------------- */

export const influencers = pgTable("influencers", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  agency: text("agency"),
  country: text("country"),
  tags: text("tags").array().notNull().default(sql`ARRAY[]::text[]`),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per platform handle. An influencer may have several. */
export const influencerAccounts = pgTable("influencer_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  influencerId: uuid("influencer_id").notNull().references(() => influencers.id, { onDelete: "cascade" }),
  platform: platform("platform").notNull(),
  handle: text("handle").notNull(),
  profileUrl: text("profile_url").notNull(),
  externalId: text("external_id"),
  followerCount: integer("follower_count"),
  followingCount: integer("following_count"),
  avgViews: integer("avg_views"),
  avgLikes: integer("avg_likes"),
  avgComments: integer("avg_comments"),
  /** Posts per week, from the profile. Feeds the consistency component. */
  postFrequency: real("post_frequency"),
  /** Rolling 90-day engagement rate, 0–1. Used as the influencer's own baseline. */
  baselineEngagementRate: real("baseline_engagement_rate"),
  isVerified: boolean("is_verified").notNull().default(false),
  /**
   * Where the profile numbers came from. "manual" is a person typing what the
   * creator told them; "api" is the platform; "observed" is derived from posts
   * we tracked ourselves. They deserve different levels of trust and the score
   * weights them accordingly.
   */
  statsSource: text("stats_source").notNull().default("manual"),
  followersSyncedAt: timestamp("followers_synced_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("influencer_accounts_platform_handle_key").on(t.platform, t.handle),
  index("influencer_accounts_influencer_idx").on(t.influencerId),
]);

/**
 * Profile stats over time. Follower growth separates a creator who is climbing
 * from one who peaked two years ago, and no single reading can show it.
 */
export const accountSnapshots = pgTable("account_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => influencerAccounts.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  followerCount: integer("follower_count"),
  avgViews: integer("avg_views"),
  avgLikes: integer("avg_likes"),
  engagementRate: real("engagement_rate"),
  source: text("source").notNull().default("manual"),
}, (t) => [
  uniqueIndex("account_snapshots_time_key").on(t.accountId, t.capturedAt),
]);

/* -------------------------------------------------------------------------- */
/*  Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: uuid("brand_id").notNull().references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  objective: text("objective"),
  status: campaignStatus("status").notNull().default("DRAFT"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  budget: numeric("budget", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("ILS"),
  /** Free-form campaign config: hashtags, UTM prefixes, tracked links. */
  meta: jsonb("meta").$type<{
    hashtags?: string[];
    mentions?: string[];
    utmCampaign?: string;
    landingUrls?: string[];
  }>().notNull().default({}),
  /** Who runs this campaign day to day — distinct from who created the row. */
  ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("campaigns_brand_idx").on(t.brandId, t.status),
  index("campaigns_dates_idx").on(t.startDate, t.endDate),
]);

/** Target values the campaign is measured against. */
export const campaignKpis = pgTable("campaign_kpis", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  metric: metricKind("metric").notNull(),
  targetValue: numeric("target_value", { precision: 14, scale: 4 }).notNull(),
  /** Relative importance when rolling KPIs into the Effectiveness Index. */
  weight: real("weight").notNull().default(1),
}, (t) => [uniqueIndex("campaign_kpis_metric_key").on(t.campaignId, t.metric)]);

/** An influencer's participation in one campaign, on one platform account. */
export const campaignInfluencers = pgTable("campaign_influencers", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  influencerId: uuid("influencer_id").notNull().references(() => influencers.id, { onDelete: "restrict" }),
  accountId: uuid("account_id").notNull().references(() => influencerAccounts.id, { onDelete: "restrict" }),
  /** Cost attributed to this influencer — the denominator of cost-per-X. */
  fee: numeric("fee", { precision: 12, scale: 2 }).notNull().default("0"),
  /** Non-cash cost (product value, hosting, travel) folded into effort. */
  inKindValue: numeric("in_kind_value", { precision: 12, scale: 2 }).notNull().default("0"),
  deliverablesPlanned: integer("deliverables_planned").notNull().default(1),
  contractedAt: timestamp("contracted_at", { withTimezone: true }),
}, (t) => [
  uniqueIndex("campaign_influencers_account_key").on(t.campaignId, t.accountId),
  index("campaign_influencers_influencer_idx").on(t.influencerId),
]);

/* -------------------------------------------------------------------------- */
/*  Posts + metrics                                                            */
/* -------------------------------------------------------------------------- */

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignInfluencerId: uuid("campaign_influencer_id").notNull()
    .references(() => campaignInfluencers.id, { onDelete: "cascade" }),
  /** Denormalised for fast brand-scoped queries and RBAC filtering. */
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  platform: platform("platform").notNull(),
  postType: postType("post_type").notNull(),
  url: text("url").notNull(),
  externalId: text("external_id"),
  caption: text("caption"),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  /** Latest snapshot, mirrored here so list views need no aggregate join. */
  latestSnapshotId: uuid("latest_snapshot_id"),
  lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }),
  collectionStatus: collectionStatus("collection_status").notNull().default("PENDING"),
  collectionError: text("collection_error"),
  isTracked: boolean("is_tracked").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("posts_url_key").on(t.url),
  index("posts_campaign_idx").on(t.campaignId, t.publishedAt),
  index("posts_tracking_idx").on(t.isTracked, t.lastCollectedAt),
]);

/**
 * Time-series metrics. One row per post per collection run — never updated,
 * only appended, so trends and velocity are always reconstructable.
 */
export const metricsSnapshots = pgTable("metrics_snapshots", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  impressions: integer("impressions"),
  reach: integer("reach"),
  views: integer("views"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  saves: integer("saves"),
  clicks: integer("clicks"),
  /** Cumulative watch seconds, where the platform exposes it. */
  watchTimeSeconds: integer("watch_time_seconds"),
  /** Deltas vs. the previous snapshot — precomputed for velocity charts. */
  deltaViews: integer("delta_views"),
  deltaEngagements: integer("delta_engagements"),
  source: text("source").notNull().default("api"), // api | scraper | manual | csv
  raw: jsonb("raw"),
}, (t) => [
  uniqueIndex("metrics_snapshots_post_time_key").on(t.postId, t.capturedAt),
  index("metrics_snapshots_time_idx").on(t.capturedAt),
]);

/**
 * Daily rollup per campaign. Written by the nightly job; this is what the
 * dashboards read, and where the two custom indices are persisted over time.
 */
export const campaignMetricsHistory = pgTable("campaign_metrics_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  impressions: integer("impressions").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  views: integer("views").notNull().default(0),
  engagements: integer("engagements").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: numeric("spend", { precision: 12, scale: 2 }).notNull().default("0"),
  engagementRate: real("engagement_rate"),
  cpm: real("cpm"),
  cpe: real("cpe"),
  /** מדד בולטות — 0–100, share of voice / visibility. */
  prominenceIndex: real("prominence_index"),
  /** מדד אפקטיביות — 0–100, engagement quality vs. cost. */
  effectivenessIndex: real("effectiveness_index"),
  /** Inputs behind the scores, kept for auditability of the formula. */
  indexInputs: jsonb("index_inputs"),
}, (t) => [
  uniqueIndex("campaign_metrics_history_day_key").on(t.campaignId, t.day),
  index("campaign_metrics_history_day_idx").on(t.day),
]);

/* -------------------------------------------------------------------------- */
/*  Ingestion + insights + audit                                               */
/* -------------------------------------------------------------------------- */

export const collectionRuns = pgTable("collection_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  trigger: text("trigger").notNull().default("cron"), // cron | manual | backfill
  postsAttempted: integer("posts_attempted").notNull().default(0),
  postsSucceeded: integer("posts_succeeded").notNull().default(0),
  postsFailed: integer("posts_failed").notNull().default(0),
  errors: jsonb("errors"),
});

export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
  kind: insightKind("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  /** 0–1 model confidence; low-confidence insights render muted. */
  confidence: real("confidence"),
  /** Metric ids and post ids the insight was derived from. */
  evidence: jsonb("evidence"),
  model: text("model"),
  isPinned: boolean("is_pinned").notNull().default(false),
  dismissedById: uuid("dismissed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("insights_campaign_idx").on(t.campaignId, t.createdAt)]);

/**
 * Cached creator quality scores. Recomputed on demand and written here so lists
 * can sort by score without recalculating for every row.
 */
export const creatorScores = pgTable("creator_scores", {
  influencerId: uuid("influencer_id").primaryKey().references(() => influencers.id, { onDelete: "cascade" }),
  qualityScore: real("quality_score"),
  /** 0–1: how much evidence sits behind the score. */
  confidence: real("confidence"),
  components: jsonb("components"),
  campaignsRun: integer("campaigns_run").notNull().default(0),
  postsTracked: integer("posts_tracked").notNull().default(0),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  brandId: uuid("brand_id").references(() => brands.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // e.g. "campaign.create", "member.grant"
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  diff: jsonb("diff"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_log_brand_idx").on(t.brandId, t.createdAt)]);

/* -------------------------------------------------------------------------- */
/*  Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(brandMembers),
}));

export const brandsRelations = relations(brands, ({ many }) => ({
  members: many(brandMembers),
  campaigns: many(campaigns),
}));

export const brandMembersRelations = relations(brandMembers, ({ one }) => ({
  user: one(users, { fields: [brandMembers.userId], references: [users.id] }),
  brand: one(brands, { fields: [brandMembers.brandId], references: [brands.id] }),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  brand: one(brands, { fields: [campaigns.brandId], references: [brands.id] }),
  kpis: many(campaignKpis),
  participants: many(campaignInfluencers),
  posts: many(posts),
  history: many(campaignMetricsHistory),
  insights: many(insights),
}));

export const influencersRelations = relations(influencers, ({ many }) => ({
  accounts: many(influencerAccounts),
  participations: many(campaignInfluencers),
}));

export const influencerAccountsRelations = relations(influencerAccounts, ({ one }) => ({
  influencer: one(influencers, {
    fields: [influencerAccounts.influencerId],
    references: [influencers.id],
  }),
}));

export const campaignInfluencersRelations = relations(campaignInfluencers, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [campaignInfluencers.campaignId], references: [campaigns.id] }),
  influencer: one(influencers, { fields: [campaignInfluencers.influencerId], references: [influencers.id] }),
  account: one(influencerAccounts, { fields: [campaignInfluencers.accountId], references: [influencerAccounts.id] }),
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [posts.campaignId], references: [campaigns.id] }),
  participant: one(campaignInfluencers, {
    fields: [posts.campaignInfluencerId],
    references: [campaignInfluencers.id],
  }),
  snapshots: many(metricsSnapshots),
}));

export const metricsSnapshotsRelations = relations(metricsSnapshots, ({ one }) => ({
  post: one(posts, { fields: [metricsSnapshots.postId], references: [posts.id] }),
}));

/* -------------------------------------------------------------------------- */
/*  Inferred types                                                             */
/* -------------------------------------------------------------------------- */

export type User = typeof users.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type BrandMember = typeof brandMembers.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type CampaignInfluencer = typeof campaignInfluencers.$inferSelect;
export type Influencer = typeof influencers.$inferSelect;
export type InfluencerAccount = typeof influencerAccounts.$inferSelect;
export type AccountSnapshot = typeof accountSnapshots.$inferSelect;
export type CreatorScore = typeof creatorScores.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type MetricsSnapshot = typeof metricsSnapshots.$inferSelect;
export type CampaignDay = typeof campaignMetricsHistory.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type BrandRole = (typeof brandRole.enumValues)[number];
export type SystemRole = (typeof systemRole.enumValues)[number];
export type PlatformName = (typeof platform.enumValues)[number];
