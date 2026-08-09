import { NextResponse, type NextRequest } from "next/server";
import { and, asc, desc, eq, isNull, or, lt } from "drizzle-orm";

import { db } from "@/db";
import { collectionRuns, metricsSnapshots, posts } from "@/db/schema";
import { getCollector } from "@/lib/collectors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Refresh a post at most every 3 hours, and stop chasing posts older than 45 days. */
const REFRESH_AFTER_MS = 3 * 60 * 60 * 1000;
const BATCH_SIZE = 150;

export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - REFRESH_AFTER_MS);
  const [run] = await db.insert(collectionRuns).values({ trigger: "cron" }).returning();

  const due = await db
    .select()
    .from(posts)
    .where(
      and(
        eq(posts.isTracked, true),
        or(isNull(posts.lastCollectedAt), lt(posts.lastCollectedAt, cutoff)),
      ),
    )
    .orderBy(asc(posts.lastCollectedAt))
    .limit(BATCH_SIZE);

  let succeeded = 0;
  const errors: { postId: string; message: string }[] = [];

  for (const post of due) {
    const result = await getCollector(post.platform).collect(post);

    if (!result.ok) {
      errors.push({ postId: post.id, message: result.message });
      await db
        .update(posts)
        .set({
          lastCollectedAt: new Date(),
          collectionStatus: result.reason === "UNAVAILABLE" ? "UNAVAILABLE" : "FAILED",
          collectionError: result.message,
          // A deleted post stops costing us API quota.
          isTracked: result.reason !== "UNAVAILABLE",
        })
        .where(eq(posts.id, post.id));
      continue;
    }

    // Deltas are computed against the previous snapshot at write time, so the
    // velocity charts never have to diff rows at read time.
    const [previous] = await db
      .select({
        views: metricsSnapshots.views,
        likes: metricsSnapshots.likes,
        comments: metricsSnapshots.comments,
        shares: metricsSnapshots.shares,
        saves: metricsSnapshots.saves,
      })
      .from(metricsSnapshots)
      .where(eq(metricsSnapshots.postId, post.id))
      .orderBy(desc(metricsSnapshots.capturedAt))
      .limit(1);

    const m = result.metrics;
    const engagements = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const prevEngagements = previous
      ? (previous.likes ?? 0) + (previous.comments ?? 0) + (previous.shares ?? 0) + (previous.saves ?? 0)
      : 0;

    const [snapshot] = await db
      .insert(metricsSnapshots)
      .values({
        postId: post.id,
        ...m,
        raw: m.raw ?? null,
        source: result.source,
        deltaViews: previous ? (m.views ?? 0) - (previous.views ?? 0) : (m.views ?? 0),
        deltaEngagements: engagements - prevEngagements,
      })
      .returning({ id: metricsSnapshots.id });

    await db
      .update(posts)
      .set({
        latestSnapshotId: snapshot.id,
        lastCollectedAt: new Date(),
        collectionStatus: "OK",
        collectionError: null,
      })
      .where(eq(posts.id, post.id));

    succeeded += 1;
  }

  await db
    .update(collectionRuns)
    .set({
      finishedAt: new Date(),
      postsAttempted: due.length,
      postsSucceeded: succeeded,
      postsFailed: errors.length,
      errors: errors.length ? errors : null,
    })
    .where(eq(collectionRuns.id, run.id));

  return NextResponse.json({
    runId: run.id,
    attempted: due.length,
    succeeded,
    failed: errors.length,
  });
}
