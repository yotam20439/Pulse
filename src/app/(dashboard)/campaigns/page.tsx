import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";

import { BrandMark } from "@/components/brand-mark";
import { StatusPill } from "@/components/status-pill";
import { OwnerBadge } from "@/components/owner-badge";
import { db } from "@/db";
import { brands, campaignMetricsHistory, campaigns, users } from "@/db/schema";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Campaigns" };



export default async function CampaignsPage() {
  const [user, dict] = await Promise.all([requireUser(), getDictionary()]);
  const ids = accessibleBrandIds(user);

  const rows =
    ids !== null && ids.length === 0
      ? []
      : await db
          .select({
            id: campaigns.id,
            name: campaigns.name,
            status: campaigns.status,
            startDate: campaigns.startDate,
            endDate: campaigns.endDate,
            budget: campaigns.budget,
            currency: campaigns.currency,
            brandName: brands.name,
            accent: brands.accentColor,
            logoUrl: brands.logoUrl,
            ownerName: users.name,
            ownerEmail: users.email,
          })
          .from(campaigns)
          .innerJoin(brands, eq(campaigns.brandId, brands.id))
          .leftJoin(users, eq(campaigns.ownerId, users.id))
          .where(ids === null ? undefined : inArray(campaigns.brandId, ids))
          .orderBy(desc(campaigns.startDate));

  const scores = rows.length
    ? await db
        .selectDistinctOn([campaignMetricsHistory.campaignId], {
          campaignId: campaignMetricsHistory.campaignId,
          prominenceIndex: campaignMetricsHistory.prominenceIndex,
          effectivenessIndex: campaignMetricsHistory.effectivenessIndex,
        })
        .from(campaignMetricsHistory)
        .where(inArray(campaignMetricsHistory.campaignId, rows.map((r) => r.id)))
        .orderBy(campaignMetricsHistory.campaignId, desc(campaignMetricsHistory.day))
    : [];

  const scoreFor = new Map(scores.map((s) => [s.campaignId, s]));

  const GROUPS = [
    { key: "live", label: dict.campaign.live, statuses: ["ACTIVE", "PAUSED"] },
    { key: "upcoming", label: dict.campaign.upcoming, statuses: ["READY", "SCHEDULED", "DRAFT"] },
    { key: "done", label: dict.campaign.finished, statuses: ["COMPLETED", "ARCHIVED"] },
  ];

  if (rows.length === 0) {
    return (
      <div className="max-w-md py-16">
        <h1 className="text-2xl font-semibold tracking-tight">No campaigns you can see</h1>
        <p className="mt-2 text-sm text-muted">
          You&apos;re not assigned to any brand yet. An administrator grants brand access from
          Settings → People.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-2xl font-semibold">{dict.nav.campaigns}</h1>

      {GROUPS.map((group) => {
        const groupRows = rows.filter((r) => (group.statuses as readonly string[]).includes(r.status));
        if (groupRows.length === 0) return null;

        return (
          <section key={group.key} className="space-y-3">
            <h2 className="eyebrow">
              {group.label} ({groupRows.length})
            </h2>
            <div className="overflow-hidden card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="data-head">
                    <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.campaigns}</th>
                    <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.brands}</th>
                    <th className="eyebrow px-4 py-3 text-start font-normal">{dict.campaign.status}</th>
                    <th className="eyebrow px-4 py-3 text-start font-normal">{dict.brand.owner}</th>
                    <th className="eyebrow px-4 py-3 text-start font-normal">{dict.campaign.dates}</th>
                    <th className="eyebrow px-4 py-3 text-end font-normal">{dict.campaign.budget}</th>
                    <th className="eyebrow px-4 py-3 text-end font-normal">{dict.indices.prominence}</th>
                    <th className="eyebrow px-4 py-3 text-end font-normal">{dict.indices.effectiveness}</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => {
                    const score = scoreFor.get(row.id);
                    return (
                      <tr key={row.id} className="data-row transition-colors hover:bg-sunken/60">
                        <td className="px-4 py-3">
                          <Link href={`/campaigns/${row.id}`} className="font-medium hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          <span className="inline-flex items-center gap-2">
                            <BrandMark
                              name={row.brandName}
                              logoUrl={row.logoUrl}
                              accentColor={row.accent}
                              size="xs"
                            />
                            {row.brandName}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={row.status} dict={dict} />
                        </td>
                        <td className="px-4 py-3">
                          <OwnerBadge name={row.ownerName} email={row.ownerEmail} />
                        </td>
                        <td className="tnum px-4 py-3 text-xs text-muted">
                          {row.startDate} → {row.endDate ?? dict.campaign.open}
                        </td>
                        <td className="tnum px-4 py-3 text-end">
                          {formatMoney(row.budget, row.currency)}
                        </td>
                        <td className="tnum px-4 py-3 text-end">
                          {score?.prominenceIndex?.toFixed(0) ?? "—"}
                        </td>
                        <td className="tnum px-4 py-3 text-end">
                          {score?.effectivenessIndex?.toFixed(0) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
