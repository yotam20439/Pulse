import { NextResponse, type NextRequest } from "next/server";

import { syncDueAccounts } from "@/lib/profile-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Nightly profile refresh. Add to Vercel Cron once deployed. */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await syncDueAccounts(100);
  return NextResponse.json({
    attempted: summary.attempted,
    updated: summary.updated,
    skipped: summary.skipped,
    failed: summary.failed,
  });
}
