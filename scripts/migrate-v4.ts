import { neon } from "@neondatabase/serverless";

/** v4 — creator profiles, stats history, and scores. Run: npm run db:migrate-v4 */
const STATEMENTS: [string, string][] = [
  ["accounts: following_count", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "following_count" integer`],
  ["accounts: avg_likes", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "avg_likes" integer`],
  ["accounts: avg_comments", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "avg_comments" integer`],
  ["accounts: post_frequency", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "post_frequency" real`],
  ["accounts: is_verified", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false`],
  ["accounts: stats_source", `ALTER TABLE "influencer_accounts" ADD COLUMN IF NOT EXISTS "stats_source" text NOT NULL DEFAULT 'manual'`],
  [
    "account_snapshots table",
    `CREATE TABLE IF NOT EXISTS "account_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "account_id" uuid NOT NULL REFERENCES "influencer_accounts"("id") ON DELETE CASCADE,
      "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
      "follower_count" integer,
      "avg_views" integer,
      "avg_likes" integer,
      "engagement_rate" real,
      "source" text DEFAULT 'manual' NOT NULL
    )`,
  ],
  [
    "account_snapshots index",
    `CREATE UNIQUE INDEX IF NOT EXISTS "account_snapshots_time_key" ON "account_snapshots" ("account_id","captured_at")`,
  ],
  [
    "creator_scores table",
    `CREATE TABLE IF NOT EXISTS "creator_scores" (
      "influencer_id" uuid PRIMARY KEY REFERENCES "influencers"("id") ON DELETE CASCADE,
      "quality_score" real,
      "confidence" real,
      "components" jsonb,
      "campaigns_run" integer DEFAULT 0 NOT NULL,
      "posts_tracked" integer DEFAULT 0 NOT NULL,
      "computed_at" timestamp with time zone DEFAULT now() NOT NULL
    )`,
  ],
];

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log(`applying ${STATEMENTS.length} statements`);
  for (const [label, statement] of STATEMENTS) {
    try {
      await sql(statement);
      console.log("  ok:", label);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/already exists|duplicate/i.test(message)) console.log("  skip:", label);
      else throw new Error(`${label} → ${message}`);
    }
  }
  console.log("migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
