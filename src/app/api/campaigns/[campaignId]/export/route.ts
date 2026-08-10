import { NextResponse } from "next/server";

import { getCampaign, getContribution, getPosts, getTotals } from "@/lib/queries/campaign";
import { requireBrandAccess } from "@/lib/rbac";

/**
 * CSV export of a campaign's post-level data.
 *
 * Agencies report to clients in spreadsheets, and a dashboard that can't hand
 * over its numbers gets screenshotted into one anyway — badly. Post level
 * rather than daily, because that is the grain people build client decks from.
 */
const escape = (value: unknown) => {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) return new NextResponse("Not found", { status: 404 });

  await requireBrandAccess(campaign.brandId);

  const totals = await getTotals(campaignId);
  const [posts, contribution] = await Promise.all([
    getPosts(campaignId),
    getContribution(campaignId, totals.reach),
  ]);

  const feeByCreator = new Map(contribution.map((c) => [c.handle, c.spend]));

  const header = [
    "campaign", "brand", "creator", "handle", "platform", "format", "url",
    "published", "views", "reach", "likes", "comments", "shares", "saves",
    "clicks", "engagements", "engagement_rate", "creator_total_cost", "currency",
    "collection_status", "last_collected",
  ];

  const lines = [
    header.join(","),
    ...posts.map((p) =>
      [
        campaign.name, campaign.brandName, p.name, p.handle, p.platform, p.postType, p.url,
        p.publishedAt ? new Date(p.publishedAt).toISOString().slice(0, 10) : "",
        p.views ?? "", p.reach ?? "", p.likes ?? "", p.comments ?? "", p.shares ?? "",
        p.saves ?? "", p.clicks ?? "", p.engagements,
        p.engagementRate != null ? (p.engagementRate * 100).toFixed(2) : "",
        feeByCreator.get(p.handle) ?? "", campaign.currency,
        p.collectionStatus,
        p.lastCollectedAt ? new Date(p.lastCollectedAt).toISOString() : "",
      ]
        .map(escape)
        .join(","),
    ),
  ];

  const slug = campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return new NextResponse(`\uFEFF${lines.join("\n")}`, {
    headers: {
      // The BOM makes Excel read UTF-8 correctly — without it, Hebrew creator
      // names arrive as mojibake in the one program clients actually open.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug || "campaign"}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
