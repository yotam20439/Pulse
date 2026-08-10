import { readdirSync, readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

/**
 * Applies the generated migration over Neon's HTTP driver.
 *
 * drizzle-kit's own `push` needs a WebSocket, which some networks block, and
 * pasting a 260-line script into a browser SQL editor gets truncated. This uses
 * the exact transport the app itself uses, one statement at a time.
 *
 * Run with: npm run db:schema
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const file = readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()[0];
  if (!file) throw new Error("No migration found. Run `npm run db:generate` first.");

  const statements = readFileSync(`drizzle/${file}`, "utf8")
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`applying ${statements.length} statements from ${file}`);
  for (const statement of statements) {
    await sql(statement);
    console.log("  ok:", statement.split("\n")[0].slice(0, 60));
  }
  console.log("schema applied");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
