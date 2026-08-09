import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { brands, campaignMetricsHistory, campaigns } from "@/db/schema";
import { requireBrandAccess } from "@/lib/rbac";
import { indexBand } from "@/lib/indices";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  // One line, and the whole page is authorised: throws 403 for anyone without
  // a grant on this brand (SUPER_ADMIN passes through).
  const { role } = await requireBrandAccess(brandId);

  const [brand] = await db.select().from(brands).where(eq(brands.id, brandId));
  if (!brand) notFound();

  const list = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.brandId, brandId), inArray(campaigns.status, ["ACTIVE", "PAUSED", "SCHEDULED"])))
    .orderBy(desc(campaigns.startDate));

  const latest = list.length
    ? await db
        .select()
        .from(campaignMetricsHistory)
        .where(inArray(campaignMetricsHistory.campaignId, list.map((c) => c.id)))
        .orderBy(desc(campaignMetricsHistory.day))
        .limit(list.length)
    : [];

  const byCampaign = new Map(latest.map((h) => [h.campaignId, h]));

  return (
    // Re-binding --brand here is what tints the accent rail, the active nav
    // item, and every primary chart series on this page.
    <div style={{ "--brand": brand.accentColor } as React.CSSProperties} className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">{brand.industry ?? "Brand"} · your role: {role.toLowerCase()}</p>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span aria-hidden className="size-3 rounded-full bg-brand" />
            {brand.name}
          </h1>
        </div>
        {role !== "VIEWER" && (
          <Link
            href={`/campaigns/new?brand=${brand.id}`}
            className="h-9 shrink-0 rounded-md bg-brand px-4 text-sm font-medium leading-9 text-brand-contrast"
          >
            New campaign
          </Link>
        )}
      </header>

      <section>
        <h2 className="eyebrow mb-3">Live campaigns</h2>
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            Nothing running for {brand.name} right now.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((campaign) => {
              const day = byCampaign.get(campaign.id);
              const band = indexBand(day?.prominenceIndex ?? 0);
              return (
                <li key={campaign.id} className="rounded-lg border border-line bg-surface p-5">
                  <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                    {campaign.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {campaign.status.toLowerCase()} · {formatMoney(campaign.budget, campaign.currency)}
                  </p>

                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="eyebrow">Prominence</dt>
                      <dd className="tnum mt-1 text-2xl font-medium">
                        {day?.prominenceIndex?.toFixed(0) ?? "—"}
                      </dd>
                      <dd className="text-xs text-muted">{band.label}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Effectiveness</dt>
                      <dd className="tnum mt-1 text-2xl font-medium">
                        {day?.effectivenessIndex?.toFixed(0) ?? "—"}
                      </dd>
                      <dd className="text-xs text-muted">
                        ER {formatPercent(day?.engagementRate)}
                      </dd>
                    </div>
                  </dl>

                  {/* Score bar: the one piece of chrome that carries the brand colour. */}
                  <div className="mt-4 h-1 w-full rounded-full bg-sunken">
                    <div
                      className="h-1 rounded-full bg-brand"
                      style={{ width: `${day?.prominenceIndex ?? 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
