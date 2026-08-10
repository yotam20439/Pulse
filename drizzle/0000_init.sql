CREATE TYPE "public"."brand_role" AS ENUM('BRAND_ADMIN', 'EDITOR', 'VIEWER');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."collection_status" AS ENUM('PENDING', 'OK', 'PARTIAL', 'FAILED', 'UNAVAILABLE');--> statement-breakpoint
CREATE TYPE "public"."insight_kind" AS ENUM('TREND', 'ANOMALY', 'RECOMMENDATION', 'SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."metric_kind" AS ENUM('IMPRESSIONS', 'REACH', 'VIEWS', 'LIKES', 'COMMENTS', 'SHARES', 'SAVES', 'CLICKS', 'ENGAGEMENT_RATE', 'CPM', 'CPE', 'PROMINENCE_INDEX', 'EFFECTIVENESS_INDEX');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'FACEBOOK', 'X', 'LINKEDIN', 'TELEGRAM');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('POST', 'REEL', 'STORY', 'CAROUSEL', 'TIKTOK', 'SHORT', 'VIDEO', 'LIVE');--> statement-breakpoint
CREATE TYPE "public"."system_role" AS ENUM('SUPER_ADMIN', 'STAFF', 'CLIENT');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"brand_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"diff" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_members" (
	"user_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"role" "brand_role" DEFAULT 'VIEWER' NOT NULL,
	"granted_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_members_user_id_brand_id_pk" PRIMARY KEY("user_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo_url" text,
	"accent_color" text DEFAULT '#6D4AFF' NOT NULL,
	"industry" text,
	"baseline_monthly_impressions" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_influencers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"influencer_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"in_kind_value" numeric(12, 2) DEFAULT '0' NOT NULL,
	"deliverables_planned" integer DEFAULT 1 NOT NULL,
	"contracted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campaign_kpis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"metric" "metric_kind" NOT NULL,
	"target_value" numeric(14, 4) NOT NULL,
	"weight" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_metrics_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"day" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"engagements" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(12, 2) DEFAULT '0' NOT NULL,
	"engagement_rate" real,
	"cpm" real,
	"cpe" real,
	"prominence_index" real,
	"effectiveness_index" real,
	"index_inputs" jsonb
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"status" "campaign_status" DEFAULT 'DRAFT' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"budget" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'ILS' NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text DEFAULT 'cron' NOT NULL,
	"posts_attempted" integer DEFAULT 0 NOT NULL,
	"posts_succeeded" integer DEFAULT 0 NOT NULL,
	"posts_failed" integer DEFAULT 0 NOT NULL,
	"errors" jsonb
);
--> statement-breakpoint
CREATE TABLE "influencer_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"influencer_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"handle" text NOT NULL,
	"profile_url" text NOT NULL,
	"external_id" text,
	"follower_count" integer,
	"avg_views" integer,
	"baseline_engagement_rate" real,
	"followers_synced_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "influencers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"email" text,
	"agency" text,
	"country" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"kind" "insight_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"confidence" real,
	"evidence" jsonb,
	"model" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"dismissed_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"impressions" integer,
	"reach" integer,
	"views" integer,
	"likes" integer,
	"comments" integer,
	"shares" integer,
	"saves" integer,
	"clicks" integer,
	"watch_time_seconds" integer,
	"delta_views" integer,
	"delta_engagements" integer,
	"source" text DEFAULT 'api' NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_influencer_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"platform" "platform" NOT NULL,
	"post_type" "post_type" NOT NULL,
	"url" text NOT NULL,
	"external_id" text,
	"caption" text,
	"thumbnail_url" text,
	"published_at" timestamp with time zone,
	"latest_snapshot_id" uuid,
	"last_collected_at" timestamp with time zone,
	"collection_status" "collection_status" DEFAULT 'PENDING' NOT NULL,
	"collection_error" text,
	"is_tracked" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"system_role" "system_role" DEFAULT 'STAFF' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_granted_by_id_users_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_influencers" ADD CONSTRAINT "campaign_influencers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_influencers" ADD CONSTRAINT "campaign_influencers_influencer_id_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."influencers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_influencers" ADD CONSTRAINT "campaign_influencers_account_id_influencer_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."influencer_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_kpis" ADD CONSTRAINT "campaign_kpis_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_metrics_history" ADD CONSTRAINT "campaign_metrics_history_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "influencer_accounts" ADD CONSTRAINT "influencer_accounts_influencer_id_influencers_id_fk" FOREIGN KEY ("influencer_id") REFERENCES "public"."influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insights" ADD CONSTRAINT "insights_dismissed_by_id_users_id_fk" FOREIGN KEY ("dismissed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metrics_snapshots" ADD CONSTRAINT "metrics_snapshots_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_influencer_id_campaign_influencers_id_fk" FOREIGN KEY ("campaign_influencer_id") REFERENCES "public"."campaign_influencers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_brand_idx" ON "audit_log" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "brand_members_brand_idx" ON "brand_members" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_key" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_influencers_account_key" ON "campaign_influencers" USING btree ("campaign_id","account_id");--> statement-breakpoint
CREATE INDEX "campaign_influencers_influencer_idx" ON "campaign_influencers" USING btree ("influencer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_kpis_metric_key" ON "campaign_kpis" USING btree ("campaign_id","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_metrics_history_day_key" ON "campaign_metrics_history" USING btree ("campaign_id","day");--> statement-breakpoint
CREATE INDEX "campaign_metrics_history_day_idx" ON "campaign_metrics_history" USING btree ("day");--> statement-breakpoint
CREATE INDEX "campaigns_brand_idx" ON "campaigns" USING btree ("brand_id","status");--> statement-breakpoint
CREATE INDEX "campaigns_dates_idx" ON "campaigns" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "influencer_accounts_platform_handle_key" ON "influencer_accounts" USING btree ("platform","handle");--> statement-breakpoint
CREATE INDEX "influencer_accounts_influencer_idx" ON "influencer_accounts" USING btree ("influencer_id");--> statement-breakpoint
CREATE INDEX "insights_campaign_idx" ON "insights" USING btree ("campaign_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "metrics_snapshots_post_time_key" ON "metrics_snapshots" USING btree ("post_id","captured_at");--> statement-breakpoint
CREATE INDEX "metrics_snapshots_time_idx" ON "metrics_snapshots" USING btree ("captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_url_key" ON "posts" USING btree ("url");--> statement-breakpoint
CREATE INDEX "posts_campaign_idx" ON "posts" USING btree ("campaign_id","published_at");--> statement-breakpoint
CREATE INDEX "posts_tracking_idx" ON "posts" USING btree ("is_tracked","last_collected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree ("email");