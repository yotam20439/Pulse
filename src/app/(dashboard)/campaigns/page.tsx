import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { brands, campaignMetricsHistory, campaigns } from "@/db/schema";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Campaigns" };

const GROUPS = [
  { key: "live", label: "Running now", statuses: ["ACTIVE", "PAUSED"] },
  { key: "upcoming", label: "Not started", statuses: ["SCHEDULED", "DRAFT"] },
  { key: "done", label: "Finished", statuses: ["COMPLETED", "ARCHIVED"] },
] as const;

export default async function CampaignsPage() {
  const user = await requireUser();
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
          })
          .from(campaigns)
          .innerJoin(brands, eq(campaigns.brandId, brands.id))
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
      <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>

      {GROUPS.map((group) => {
        const groupRows = rows.filter((r) => (group.statuses as readonly string[]).includes(r.status));
        if (groupRows.length === 0) return null;

        return (
          <section key={group.key} className="space-y-3">
            <h2 className="eyebrow">
              {group.label} ({groupRows.length})
            </h2>
            <div className="overflow-hidden rounded-lg border border-line bg-surface">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className="eyebrow px-4 py-3 text-left font-normal">Campaign</th>
                    <th className="eyebrow px-4 py-3 text-left font-normal">Brand</th>
                    <th className="eyebrow px-4 py-3 text-left font-normal">Dates</th>
                    <th className="eyebrow px-4 py-3 text-right font-normal">Budget</th>
                    <th className="eyebrow px-4 py-3 text-right font-normal">Prom.</th>
                    <th className="eyebrow px-4 py-3 text-right font-normal">Eff.</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((row) => {
                    const score = scoreFor.get(row.id);
                    return (
                      <tr key={row.id} className="border-b border-line last:border-0 hover:bg-sunken">
                        <td className="px-4 py-3">
                          <Link href={`/campaigns/${row.id}`} className="font-medium hover:underline">
                            {row.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-soft">
                          <span className="inline-flex items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2 rounded-full"
                              style={{ background: row.accent }}
                            />
                            {row.brandName}
                          </span>
                        </td>
                        <td className="tnum px-4 py-3 text-xs text-muted">
                          {row.startDate} → {row.endDate ?? "open"}
                        </td>
                        <td className="tnum px-4 py-3 text-right">
                          {formatMoney(row.budget, row.currency)}
                        </td>
                        <td className="tnum px-4 py-3 text-right">
                          {score?.prominenceIndex?.toFixed(0) ?? "—"}
                        </td>
                        <td className="tnum px-4 py-3 text-right">
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
