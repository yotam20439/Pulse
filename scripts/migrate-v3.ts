import { neon } from "@neondatabase/serverless";

/**
 * v3 migration — run with: npm run db:migrate-v3
 *
 * Written as explicit, idempotent statements rather than a generated diff, for
 * two reasons: `ALTER TYPE ... ADD VALUE` cannot run inside a transaction, so a
 * generated migration would need splitting anyway; and every statement here can
 * be re-run safely, which matters when the only way to apply schema on this
 * setup is a script someone runs by hand.
 */

const STATEMENTS: [string, string][] = [
  [
    "campaign_status: add READY",
    `ALTER TYPE "campaign_status" ADD VALUE IF NOT EXISTS 'READY' AFTER 'DRAFT'`,
  ],
  [
    "brands: owner_id",
    `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
  ],
  ["brands: notes", `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "notes" text`],
  [
    "campaigns: owner_id",
    `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL`,
  ],
  ["campaigns: notes", `ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "notes" text`],
  [
    "brands: owner index",
    `CREATE INDEX IF NOT EXISTS "brands_owner_idx" ON "brands" ("owner_id")`,
  ],
  [
    "campaigns: owner index",
    `CREATE INDEX IF NOT EXISTS "campaigns_owner_idx" ON "campaigns" ("owner_id")`,
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
      // Already-applied changes are a success condition here, not a failure.
      if (/already exists|duplicate/i.test(message)) {
        console.log("  skip (already applied):", label);
      } else {
        throw new Error(`${label} → ${message}`);
      }
    }
  }

  console.log("migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
