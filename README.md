# Pulse — multi-brand influencer campaign analytics

Next.js (App Router) + Neon Postgres + Drizzle, deployed on Vercel.

## Getting it running

```bash
npm install
cp .env.example .env.local          # fill in DATABASE_URL from the Neon console
npx auth secret                     # writes AUTH_SECRET
npm run db:push                     # or: db:generate && db:migrate
npm run db:seed -- --reset          # 3 brands, 5 users, 8 campaigns, ~30 days of metrics
npm run dev
```

Seeded sign-ins (Google OAuth against these addresses):

| Email | System role | Brand access |
|---|---|---|
| dana@agency.test | SUPER_ADMIN | all brands |
| omer@agency.test | STAFF | Halva (admin), Terra (editor) |
| maya@agency.test | STAFF | Terra (admin), Nimbus (editor) |
| yael@nimbusbank.test | CLIENT | Nimbus (viewer) |
| tom@agency.test | STAFF | none — exercises the empty states |

## Decisions worth knowing about

**Drizzle over Prisma.** Neon's HTTP driver plus Drizzle keeps the serverless cold path to a single round-trip and no engine binary, which matters on Vercel. Prisma's newer driver adapters close much of the gap, so this is a preference rather than a hard requirement — but the time-series queries here are aggregate-heavy, and Drizzle lets you drop into raw SQL for a window function without leaving the type system.

**Auth.js over Clerk.** Permissions are per-brand rows in our own database and admins grant them inside the product, so the source of truth has to be local either way. Auth.js with the Drizzle adapter keeps identity and authorisation in one place; Clerk would mean syncing brand grants into an external org model. If you'd rather not run auth yourself, Clerk slots in behind the same `src/lib/rbac.ts` interface.

**JWT sessions, permissions cached for 5 minutes.** Middleware runs on the edge and can't reach the database, so brand grants ride in the token and refresh on a TTL. Revoking a grant therefore takes up to five minutes to bite. If that's too loose, drop `PERMISSIONS_TTL_MS` or move to database sessions and run middleware on the Node runtime.

**Authorisation lives in pages and actions, not middleware.** Middleware only knows the URL; brand ids arrive in path params, query strings, and request bodies. Every brand-scoped surface calls `requireBrandAccess(brandId, minRole)` and every list query is filtered with `accessibleBrandIds(user)`. The rule to keep: no query touches a brand-scoped table without one of those two.

**Snapshots are append-only.** `metrics_snapshots` is never updated, so trends, velocity, and "what did this look like on the 14th" are all reconstructable. `campaign_metrics_history` is the nightly rollup the dashboards read; deriving it from raw snapshots on every page load would not survive a campaign with a few hundred posts.

**No logged-out scraping.** `src/lib/collectors.ts` defines a per-platform interface with a deterministic mock behind it. Wire real providers in this order: official APIs with creator consent (Instagram Graph on connected Business accounts, TikTok Display, YouTube Data), then a licensed vendor for creators who won't connect, then manual CSV. HTML scraping breaks weekly and produces numbers you can't defend in a client report.

## The two indices

Both live in `src/lib/indices.ts`, both return 0–100, and both saturate rather than scale linearly so one viral post can't flatten every comparison.

**Prominence (מדד בולטות)** — how loud the campaign was: platform-weighted impressions against the brand's own monthly baseline (55%), roster and platform breadth (25%), and organic amplification, meaning shares and saves per unit of reach (20%).

**Effectiveness (מדד אפקטיביות)** — what that noise was worth: engagement quality as lift over the creators' own baseline engagement rate, plus how much of the engagement was comments and shares rather than taps (35%); cost per weighted engagement against target (35%); and weighted KPI attainment, capped at 120% (30%).

Every weight is a business assumption in one file. Changing one changes history — bump `INDEX_VERSION` and re-run the rollup so old scores stay comparable.

## Layout

```
src/
  auth.config.ts        edge-safe auth (no DB) — middleware uses only this
  auth.ts               Auth.js + Drizzle adapter, brand grants into the JWT
  db/
    schema.ts           all tables, enums, relations, inferred types
    seed.ts             deterministic dataset
  lib/
    rbac.ts             requireBrandAccess, accessibleBrandIds, brandScope
    indices.ts          prominence + effectiveness
    collectors.ts       per-platform metric providers
  app/
    (auth)/signin       admin-provisioned sign-in
    (dashboard)         shell, overview, brand pages, campaign pages
    api/cron/ingest     Vercel Cron, guarded by CRON_SECRET
```

## Built so far

Campaign detail (`/campaigns/[id]`) is complete: index tiles with component breakdowns and a 7-day delta, a two-view trend chart (indices on a fixed 0–100 axis, reach and engagement on their own), a sortable creator-contribution table, KPI progress, insights, and a post table that surfaces collection failures inline rather than burying them in a log.

Data access for it lives in `src/lib/queries/campaign.ts`. Note that campaign totals come from each post's `latest_snapshot_id`, not a sum over `metrics_snapshots` — summing the raw table counts every post once per collection run and inflates everything by roughly the number of runs.

## Next up

1. Server actions for campaign and post CRUD, each guarded with `requireBrandAccess(..., "EDITOR")` and writing to `audit_log`.
3. `/api/cron/rollup` — the nightly job that writes `campaign_metrics_history` (the seed script's rollup block is the reference implementation).
4. Settings → People: user creation and brand grant management, `SUPER_ADMIN` only.
5. AI insights job: feed the last 14 rollup days plus per-post deltas to the model, persist to `insights` with `confidence` and `evidence`.
6. Row-level security in Postgres as a second layer, so a query that forgets `brandScope` fails closed.
