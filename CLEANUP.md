# Files to delete before building

Zips can only add and overwrite files — they never remove them. When a version
deletes a file, it survives on your machine and can break the build with an
error that has no obvious connection to the change that caused it.

Run this after unzipping any version:

```bash
rm -rf "src/app/(dashboard)/influencers/new"
```

That page was replaced in v4 by the paste-a-link flow on `/influencers`, and its
import of `InfluencerForm` is what broke the Vercel build for several versions
while local builds kept passing against stale `.next` output.

## Checking for others

If a build fails with "has no exported member" or "Module not found", something
deleted upstream is still present locally. This finds the orphans:

```bash
# Every @/ import that doesn't resolve to a real file
grep -rho 'from "@/[^"]*"' src/ | sort -u | sed 's|from "@/||;s|"||' | while read p; do
  [ -e "src/$p.ts" ] || [ -e "src/$p.tsx" ] || [ -e "src/$p" ] || echo "MISSING: src/$p"
done
```

Then delete whichever file does the importing, or ask for it to be restored.

## Always clear the build cache

```bash
rm -rf .next && npm run build
```

Next caches aggressively, and a stale `.next` can make a locally broken build
appear to pass — which is exactly how the orphaned page reached Vercel.
