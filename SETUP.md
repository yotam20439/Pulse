# Setup — start here

Follow these in order. Each step has a check; don't move on until it passes.

## 1. Get the code running locally

```bash
cd pulse
npm install
```

Check: no errors, and a `node_modules` folder appears.

```bash
npm run build
```

Check: ends with `Compiled successfully`. If it doesn't, the problem is in the code and Vercel will fail the same way — fix it here, where the feedback loop is seconds instead of minutes.

## 2. Connect a database

Create a project at [neon.tech](https://neon.tech). From the dashboard, copy **both** connection strings — the pooled one (host contains `-pooler`) and the direct one.

```bash
cp .env.example .env.local
```

Open `.env.local` and set:

- `DATABASE_URL` — the **pooled** string
- `AUTH_SECRET` — generate with `npx auth secret`

Then create the tables and fill them with test data:

```bash
npm run db:push
npm run db:seed -- --reset
```

Check: the seed prints a row of counts (brands, users, campaigns, posts, snapshots). Use the **direct** string if `db:push` hangs — schema changes need a real session, which the pooler doesn't hold.

```bash
npm run dev
```

Check: [localhost:3000](http://localhost:3000) redirects you to the sign-in page.

## 3. Google sign-in

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an OAuth 2.0 Client ID (type: Web application). Add this authorised redirect URI:

```
http://localhost:3000/api/auth/callback/google
```

Put the client ID and secret into `.env.local` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

Sign-in only works for email addresses already in the `users` table — accounts are created by admins, not by signing up. The seed creates five; to sign in as yourself, add your own address first:

```sql
INSERT INTO users (email, name, system_role) VALUES ('you@example.com', 'You', 'SUPER_ADMIN');
```

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Check, on github.com, that `package.json` opens with `{` and `"name": "pulse"`. If it shows anything else, the file contents got crossed during upload — that is what caused the earlier `is not valid JSON` build failure.

Never paste files one by one into GitHub's web editor. Use `git push`, or GitHub's "upload files" with the whole folder dragged in at once.

## 5. Deploy

In Vercel: **Add New → Project → Import Git Repository**. Do not drag and drop a folder; that lands the project on the wrong framework preset.

Before the first build, add these under Settings → Environment Variables, ticked for Production, Preview, and Development:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled string |
| `AUTH_SECRET` | same as local |
| `AUTH_GOOGLE_ID` | from Google |
| `AUTH_GOOGLE_SECRET` | from Google |
| `CRON_SECRET` | any random string |

Do **not** set `AUTH_URL` — Auth.js reads the deployment URL itself.

Then deploy. Check: Deployments shows one marked **Ready** and **Production**.

Finally, add the deployed URL to Google's authorised redirect URIs:

```
https://<your-project>.vercel.app/api/auth/callback/google
```

## When something fails

Reproduce Vercel's build on your own machine before pushing again:

```bash
npx vercel build
```

This runs the identical build locally and shows the same error in seconds. Almost every failure in this project so far would have surfaced here first.

See `DEPLOYING.md` for specific errors — 404s, cron configuration, and what each one actually means.
