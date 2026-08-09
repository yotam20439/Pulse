import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * neon-http is stateless: one HTTP round-trip per query, no connection to keep
 * warm. That is what makes it safe on Vercel's serverless + edge runtimes,
 * where a pooled TCP client would leak connections across invocations.
 *
 * If you later need interactive transactions, swap this file for
 * `drizzle-orm/neon-serverless` (WebSocket Pool) — the rest of the app is
 * written against the same `db` interface and will not change.
 */
type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: Db | null = null;

function getDb(): Db {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally: copy .env.example to .env.local. " +
        "On Vercel: Project → Settings → Environment Variables, then redeploy.",
    );
  }
  client = drizzle(neon(url), { schema, casing: "snake_case" });
  return client;
}

/**
 * Connected lazily, on first query.
 *
 * The eager version of this file threw at import time, which meant `next build`
 * crashed while collecting page data if DATABASE_URL wasn't present in the
 * build environment — and a failed build leaves the production domain serving
 * Vercel's own 404. A missing env var should surface as a runtime error on the
 * page that needed the database, not as a dead deployment.
 */
export const db = new Proxy({} as Db, {
  get: (_target, prop) => Reflect.get(getDb(), prop),
});

export { schema };
