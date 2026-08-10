import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";

import { PostForm } from "@/components/forms/entity-forms";
import { db } from "@/db";
import { campaignInfluencers, influencerAccounts, influencers } from "@/db/schema";
import { addPost } from "@/lib/actions/entities";
import { getCampaign } from "@/lib/queries/campaign";
import { requireBrandAccess } from "@/lib/rbac";

export const metadata = { title: "Add post" };

export default async function NewPostPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  await requireBrandAccess(campaign.brandId, "EDITOR");

  const roster = await db
    .select({
      id: campaignInfluencers.id,
      name: influencers.displayName,
      handle: influencerAccounts.handle,
      platform: influencerAccounts.platform,
    })
    .from(campaignInfluencers)
    .innerJoin(influencers, eq(campaignInfluencers.influencerId, influencers.id))
    .innerJoin(influencerAccounts, eq(campaignInfluencers.accountId, influencerAccounts.id))
    .where(eq(campaignInfluencers.campaignId, campaignId));

  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {campaign.name}
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Track a post</h1>
        <p className="mt-1 text-sm text-muted">
          Metrics are collected on the next run, then refreshed on a schedule.
        </p>
      </header>

      <PostForm
        action={addPost}
        campaignId={campaignId}
        participants={roster.map((r) => ({
          id: r.id,
          label: `${r.name} — @${r.handle} (${r.platform.toLowerCase()})`,
        }))}
      />
    </div>
  );
}
