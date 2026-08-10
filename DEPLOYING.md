# Deploying to Vercel

## If you see `404: NOT_FOUND` on the deployment URL

That is Vercel's own 404, served when **no production deployment exists** — not a Next.js route miss (a Next 404 renders your app shell and says "This page could not be found"). Open the **Deployments** tab. If the most recent one is red, the build failed and the domain has nothing to serve.

Four things cause this on a fresh project, in rough order of likelihood:

**1. Environment variables aren't set.** `DATABASE_URL` and `AUTH_SECRET` are needed at build time, not just runtime. Set them under Settings → Environment Variables for **Production, Preview, and Development**, then redeploy — Vercel does not rebuild automatically when you add a variable.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string (the one with `-pooler` in the host) |
| `AUTH_SECRET` | `npx auth secret`, or any 32-byte random string |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | from Google Cloud Console |
| `CRON_SECRET` | any random string; Vercel Cron sends it as a Bearer token |

Do **not** set `AUTH_URL` on Vercel. Auth.js reads the deployment URL itself, and a value copied from `.env.local` points production at `localhost:3000`.

**2. Root Directory is wrong.** If the repo has the app inside a folder (`pulse/`), set Settings → General → Root Directory to that folder. Otherwise Vercel builds at the repo root, finds no `package.json` with Next, and produces nothing.

**3. Framework Preset isn't Next.js.** Should be auto-detected; if the project was created by dragging a folder rather than importing a git repo, it sometimes lands on "Other", which deploys the files statically and yields exactly this 404.

**4. The build genuinely failed.** Open the failed deployment and read the log from the top. The first error is the real one; everything after it is fallout.

## Fixes applied after the first deploy

- **`src/db/index.ts` no longer throws at import time.** It threw if `DATABASE_URL` was absent, which crashed `next build` during page-data collection rather than failing the one page that needed a database. The client is now created lazily on first query.
- **`middleware.ts` moved to `src/middleware.ts`.** With a `src/` directory, Next only picks up middleware from inside `src/`. At the repo root it is silently ignored, so every route was unauthenticated.
- **`experimental.typedRoutes` turned off.** It rejects template-literal hrefs like `` `/campaigns/${id}` ``, which this app uses throughout, and fails the build on a type error.
- **`server-only` and `dotenv` added to `package.json`.** Both were imported but never declared. They often resolve locally through hoisting and then fail on a clean CI install.

## Cron jobs (there is deliberately no `vercel.json`)

This project ships **without** a `vercel.json`. Next.js needs no configuration file to deploy on Vercel, and the one originally included here did nothing except declare cron schedules — which Vercel rejected with `Invalid vercel.json file provided`, blocking the deploy for no benefit.

It was rejected on meaning, not syntax (the file parsed fine). Two causes, both of which applied:

**A cron path that doesn't exist.** `vercel.json` listed `/api/cron/rollup` as a placeholder for the nightly rollup job, which hasn't been written yet. Vercel validates every cron path against a real route in the deployment and fails the whole file if one is missing. Only add a cron entry once its route handler exists.

**Cron frequency above the plan limit.** Hobby accounts allow up to 2 cron jobs, each triggered **once per day**; `0 */4 * * *` (every four hours) is a Pro-tier schedule and is refused. The file now uses `0 3 * * *` — daily at 03:00 UTC.

### Getting collection running anyway

Two options, neither of which needs `vercel.json`:

**Vercel dashboard.** Once the app is deployed and `/api/cron/ingest` exists in production, add the schedule under Settings → Cron Jobs. Same feature, but a bad entry can't block a deploy.

**External scheduler** — better on Hobby, since it isn't capped at once a day. GitHub Actions on a schedule, or cron-job.org, sending a request to `https://<your-app>/api/cron/ingest` with the header `Authorization: Bearer <CRON_SECRET>`. The route already checks that header, so no code changes.

```yaml
# .github/workflows/ingest.yml
name: Collect metrics
on:
  schedule: [{ cron: "0 */4 * * *" }]
  workflow_dispatch:
jobs:
  ingest:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -f -X GET "$URL/api/cron/ingest" \
            -H "Authorization: Bearer $CRON_SECRET"
        env:
          URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
```

If you later re-add `vercel.json`, add a cron entry only after its route handler exists in the deployment — that is what broke it the first time.

## Google OAuth callback

Add both to Authorised redirect URIs in the Google Cloud console:

```
http://localhost:3000/api/auth/callback/google
https://<your-project>.vercel.app/api/auth/callback/google
```

Preview deployments get a new URL per commit, so OAuth won't work on them unless you assign a stable preview domain.

## Migrations and seeding

Neither runs on Vercel. Run them from your machine against the Neon branch:

```bash
DATABASE_URL="<neon direct, non-pooled>" npm run db:push
DATABASE_URL="<neon direct, non-pooled>" npm run db:seed -- --reset
```

Use the **direct** (non-pooled) string for schema changes; the pooler doesn't hold the session state DDL needs. If the deployed app returns database errors, that usually means the schema was never pushed — the build can succeed against an empty database.

## Node version

`package.json` targets Next 15 and React 19, which need Node 18.18+. Set Settings → General → Node.js Version to 22.x.


## Creator profile data — what actually works

Followers, average likes, and engagement rate can be fetched automatically for some platforms and not others. The app is explicit about which is which: every account shows its `statsSource` as `manual`, `api`, or `vendor`, and the creator score weights observed post metrics above anything self-reported.

### Works today, free

**YouTube** — one API key. Google Cloud → enable *YouTube Data API v3* → create an API key → set `YOUTUBE_API_KEY`. Reads any public channel: subscribers, and per-video likes, comments, and views from the last 10 uploads. A full refresh costs ~5 of your 10,000 daily quota units.

### Works today, some setup

**Instagram** — the Business Discovery endpoint reads followers and per-post likes and comments for any Business or Creator account, *without that creator authorising anything*. You need:

1. Your own Instagram account switched to Business or Creator, linked to a Facebook Page
2. A Meta app (developers.facebook.com) with the Instagram Graph API product
3. A long-lived Page access token — 60 days, refreshable
4. `INSTAGRAM_GRAPH_TOKEN` and `INSTAGRAM_BUSINESS_ID`

Limitation: personal accounts are invisible to this endpoint. Most working creators run Creator accounts, so coverage is good but not universal.

### Needs a paid vendor

**TikTok, X, Facebook** — no public API returns profile stats for an account that hasn't authorised your app. TikTok's Display API requires creator OAuth, which is useless for evaluating someone you haven't signed. The realistic options are a licensed vendor (Modash, Phyllo, HypeAuditor, Creator.co) or manual entry.

`src/lib/profile-collectors/vendor.ts` is a generic adapter: set the endpoint and key, map the response fields in `mapResponse`, done. Deliberately vendor-agnostic — pricing and coverage change often enough that hard-coding one is a mistake you pay for later.

### Why there is no HTML scraper

The obvious approach is fetching a public profile page and parsing the numbers out. It isn't built that way because:

- Markup changes every few weeks, and each change silently turns follower counts into nulls or leaves stale numbers looking fine
- Logged-out pages are rate-limited and increasingly gated behind a login wall, so it fails from a datacentre IP even when the selectors are correct
- It breaches the terms of every platform involved, which matters when the output goes into a client invoice
- A number you cannot source is a number you cannot defend

The strongest data in the system isn't fetched from a profile at all: it's computed from posts the app tracked itself, on the creator page under *Measured from tracked posts*. Those numbers are yours, they're auditable, and no platform can take them away.

### Scheduling

`/api/cron/profiles` refreshes accounts not synced in 24 hours, 100 at a time. Add it under Settings → Cron Jobs once deployed, or drive it from GitHub Actions with the `CRON_SECRET` bearer token.
