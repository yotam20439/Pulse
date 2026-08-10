import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";

import { CampaignForm } from "@/components/forms/campaign-form";
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
import {
  addParticipant,
  removeParticipant,
  setKpi,
  updateCampaign,
} from "@/lib/actions/entities";
import { getDictionary } from "@/lib/i18n";
import { getCampaign } from "@/lib/queries/campaign";
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

  const [roster, kpis, accounts, staff] = await Promise.all([
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

    db
      .select({
        id: influencerAccounts.id,
        name: influencers.displayName,
        handle: influencerAccounts.handle,
        platform: influencerAccounts.platform,
      })
      .from(influencerAccounts)
      .innerJoin(influencers, eq(influencerAccounts.influencerId, influencers.id))
      .orderBy(asc(influencers.displayName)),

    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.email)),
  ]);

  const booked = new Set(roster.map((r) => `${r.handle}:${r.platform}`));
  const available = accounts.filter((a) => !booked.has(`${a.handle}:${a.platform}`));

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
        <h2 className="eyebrow">Campaign details</h2>
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
        <h2 className="eyebrow">Roster ({roster.length})</h2>

        {roster.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-6 text-sm text-muted">
            No creators booked yet.
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
                  <button type="submit" className="text-xs text-critical hover:underline">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 ? (
          <form
            action={addParticipant}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <input type="hidden" name="campaignId" value={campaignId} />
            <div className="min-w-56 flex-1">
              <label className="eyebrow">Add creator</label>
              <select
                name="accountId"
                className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
              >
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — @{a.handle} ({a.platform.toLowerCase()})
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="eyebrow">Fee</label>
              <input
                name="fee"
                type="number"
                min={0}
                defaultValue={0}
                className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
              />
            </div>
            <div className="w-28">
              <label className="eyebrow">In-kind</label>
              <input
                name="inKindValue"
                type="number"
                min={0}
                defaultValue={0}
                className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="eyebrow">Posts</label>
              <input
                name="deliverablesPlanned"
                type="number"
                min={1}
                defaultValue={1}
                className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
              />
            </div>
            <button type="submit" className="h-9 rounded-md bg-ink px-4 text-sm font-medium text-white">
              Add
            </button>
          </form>
        ) : (
          <p className="text-sm text-muted">
            Every creator in the roster is already on this campaign.{" "}
            <Link href="/influencers/new" className="underline">
              Add a new one
            </Link>
            .
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Targets</h2>
        <p className="max-w-2xl text-sm text-muted">
          Weight sets how much each target counts toward KPI attainment, which is 30% of the
          Effectiveness Index. For cost metrics, coming in under target scores above par.
        </p>

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
            <label className="eyebrow">Metric</label>
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
            <label className="eyebrow">Target</label>
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
            <label className="eyebrow">Weight</label>
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
            Set target
          </button>
        </form>
      </section>
    </div>
  );
}
