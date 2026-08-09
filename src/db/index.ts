import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * neon-http is stateless: one HTTP round-trip per query, no connection to keep
 * warm. That is what makes it safe on Vercel's serverless and edge runtimes,
 * where a pooled TCP client would leak connections across invocations.
 *
 * If you later need interactive transactions, swap this file for
 * `drizzle-orm/neon-serverless` (WebSocket Pool) — the rest of the app is
 * written against the same `db` interface and will not change.
 */

const url = process.env.DATABASE_URL;

if (!url) {
  // A build must not die because of a missing env var: `next build` imports
  // every route to collect page data, and the Auth.js adapter inspects this
  // object as soon as src/auth.ts is loaded. Throwing here (or from a lazy
  // proxy) turns one missing variable into "Failed to collect page data".
  // Instead we build against a placeholder and let the failure surface at
  // query time, on the page that actually needed a database.
  console.warn(
    "[db] DATABASE_URL is not set — using a placeholder. " +
      "Queries will fail until it is configured in .env.local (locally) or " +
      "Project Settings → Environment Variables (Vercel).",
  );
}

const sql = neon(url ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder");

export const db = drizzle(sql, { schema, casing: "snake_case" });
export { schema };