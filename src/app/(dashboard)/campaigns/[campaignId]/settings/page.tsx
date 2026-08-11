import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";

import { CampaignForm } from "@/components/forms/campaign-form";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { CreatorLinkAdd } from "@/components/forms/creator-link-add";
import { PlatformBadge } from "@/components/platform-badge";
import { db } from "@/db";
import {
  campaignInfluencers,
  campaignKpis,
  influencerAccounts,
  influencers,
  posts,
  users,
} from "@/db/schema";
import { addCreatorByLink } from "@/lib/actions/creators";
import {
  deleteCampaign,
  removeParticipant,
  setKpi,
  updateCampaign,
} from "@/lib/actions/entities";
import { getDictionary } from "@/lib/i18n";
import { t } from "@/lib/i18n/dictionaries";
import { getCampaign } from "@/lib/queries/campaign";
import { rankCreatorsForCampaign } from "@/lib/queries/creators";
import { requireBrandAccess } from "@/lib/rbac";
import { formatCount, formatMoney } from "@/lib/utils";

export const metadata = { title: "Campaign settings" };

const METRICS = ["IMPRESSIONS", "REACH", "VIEWS", "ENGAGEMENT_RATE", "CLICKS", "CPE", "CPM"];

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  await requireBrandAccess(campaign.brandId, "EDITOR");
  const dict = await getDictionary();

  const [roster, kpis, ranked, staff] = await Promise.all([
    db
      .select({
        id: campaignInfluencers.id,
        name: influencers.displayName,
        handle: influencerAccounts.handle,
        platform: influencerAccounts.platform,
        followers: influencerAccounts.followerCount,
        fee: campaignInfluencers.fee,
        inKind: campaignInfluencers.inKindValue,
        planned: campaignInfluencers.deliverablesPlanned,
        published: sql<number>`count(${posts.id})`.mapWith(Number),
      })
      .from(campaignInfluencers)
      .innerJoin(influencers, eq(campaignInfluencers.influencerId, influencers.id))
      .innerJoin(influencerAccounts, eq(campaignInfluencers.accountId, influencerAccounts.id))
      .leftJoin(posts, eq(posts.campaignInfluencerId, campaignInfluencers.id))
      .where(eq(campaignInfluencers.campaignId, campaignId))
      .groupBy(campaignInfluencers.id, influencers.displayName, influencerAccounts.handle, influencerAccounts.platform, influencerAccounts.followerCount),

    db.select().from(campaignKpis).where(eq(campaignKpis.campaignId, campaignId)),

    rankCreatorsForCampaign(campaignId, 12),

    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.email)),
  ]);


  return (
    <div
      style={{ "--brand": campaign.brandAccent } as React.CSSProperties}
      className="max-w-4xl space-y-8"
    >
      <Link
        href={`/campaigns/${campaignId}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"
      >
        <ChevronLeft className="size-4" aria-hidden />
        {campaign.name}
      </Link>

      <section className="space-y-3">
        <h2 className="eyebrow">{dict.campaign.details}</h2>
        <CampaignForm
          action={updateCampaign}
          brands={[{ id: campaign.brandId, name: campaign.brandName }]}
          dict={dict}
          users={staff.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
          campaign={{
            id: campaign.id,
            brandId: campaign.brandId,
            name: campaign.name,
            objective: campaign.objective,
            status: campaign.status,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            budget: campaign.budget,
            currency: campaign.currency,
            ownerId: campaign.ownerId,
            notes: campaign.notes,
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">
          {dict.campaign.roster} ({roster.length})
        </h2>

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-sm text-muted">
            {dict.campaign.noCreators}
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {roster.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <PlatformBadge platform={r.platform} />
                <div className="min-w-0">
                  <p className="font-medium">{r.name}</p>
                  <p className="tnum text-xs text-muted">
                    @{r.handle} · {formatCount(r.followers)} followers
                  </p>
                </div>
                <span className="tnum ml-auto text-xs text-muted">
                  {formatMoney(Number(r.fee) + Number(r.inKind), campaign.currency)} ·{" "}
                  {r.published}/{r.planned} delivered
                </span>
                <form action={removeParticipant}>
                  <input type="hidden" name="participantId" value={r.id} />
                  <button
                    type="submit"
                    title={dict.campaign.removeHint}
                    className="text-xs text-critical hover:underline"
                  >
                    {dict.campaign.remove}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {/* Adding a creator never depends on them already existing. The ranked
            list below is a suggestion layer over the same paste-a-link form. */}
        <CreatorLinkAdd
          action={addCreatorByLink}
          campaignId={campaignId}
          dict={dict}
          compact
          suggestions={ranked
            .filter((r) => !r.alreadyBooked)
            .map((r) => ({
              id: r.id,
              displayName: r.displayName,
              handle: r.accounts[0]?.handle ?? "",
              platform: r.accounts[0]?.platform ?? "INSTAGRAM",
              followerCount: r.totalFollowers,
              score: r.score,
              workedWithBrand: r.workedWithBrand,
            }))}
        />

        {ranked.filter((r) => !r.alreadyBooked).length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium">
              {dict.creator.whyThese}
            </summary>
            <ul className="mt-4 space-y-2">
              {ranked
                .filter((r) => !r.alreadyBooked)
                .slice(0, 8)
                .map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="tnum w-8 shrink-0 font-medium">{r.score.toFixed(0)}</span>
                    <span className="w-40 shrink-0 truncate font-medium">{r.displayName}</span>
                    <span className="text-muted">
                      platform {Math.round(r.components.platform * 100)} · audience{" "}
                      {Math.round(r.components.audience * 100)} · track record{" "}
                      {Math.round(r.components.trackRecord * 100)} · category{" "}
                      {Math.round(r.components.category * 100)}
                    </span>
                    <span className="tnum ms-auto text-muted">
                      ~{formatMoney(r.expectedFee, campaign.currency)}
                    </span>
                    {r.workedWithBrand && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-brand">
                        {t(dict.creator.workedWith, { brand: campaign.brandName })}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{dict.creator.relevanceHint}</p>
          </details>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">{dict.campaign.targets}</h2>
        <p className="max-w-2xl text-sm text-muted">{dict.campaign.kpiHint}</p>

        {kpis.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {kpis.map((kpi) => (
              <li key={kpi.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="capitalize">{kpi.metric.replace(/_/g, " ").toLowerCase()}</span>
                <span className="tnum ml-auto text-muted">
                  target {Number(kpi.targetValue).toLocaleString()} · weight {kpi.weight}
                </span>
              </li>
            ))}
          </ul>
        )}

        <form
          action={setKpi}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4"
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <div className="min-w-44 flex-1">
            <label className="eyebrow">{dict.campaign.metric}</label>
            <select
              name="metric"
              className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m.replace(/_/g, " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="eyebrow">{dict.campaign.target}</label>
            <input
              name="targetValue"
              type="number"
              step="any"
              min={0}
              required
              className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
            />
          </div>
          <div className="w-24">
            <label className="eyebrow">{dict.campaign.weight}</label>
            <input
              name="weight"
              type="number"
              step="0.5"
              min="0.5"
              defaultValue={1}
              className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
            />
          </div>
          <button type="submit" className="h-9 rounded-md bg-ink px-4 text-sm font-medium text-white">
            {dict.campaign.setTarget}
          </button>
        </form>
      </section>
      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="eyebrow">{dict.danger.zone}</h2>
        <ConfirmDelete
          action={deleteCampaign}
          confirmValue={campaign.name}
          hidden={{ campaignId }}
          dict={dict}
          triggerLabel={dict.danger.deleteCampaign}
          title={t(dict.danger.deleteCampaignTitle, { name: campaign.name })}
          consequence={dict.danger.deleteCampaignWhat}
        />
      </section>

    </div>
  );
}