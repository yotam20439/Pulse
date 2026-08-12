import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";

import { BrandMark } from "@/components/brand-mark";
import { OwnerBadge } from "@/components/owner-badge";
import { StatusPill } from "@/components/status-pill";
import { db } from "@/db";
import { brands, campaignMetricsHistory, campaigns, users } from "@/db/schema";
import { requireBrandAccess } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { indexBand } from "@/lib/indices";
import { formatMoney, formatPercent } from "@/lib/utils";

export default async function BrandPage({ params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;

  // One line, and the whole page is authorised: throws 403 for anyone without
  // a grant on this brand (SUPER_ADMIN passes through).
  const { role } = await requireBrandAccess(brandId);
  const dict = await getDictionary();

  const [brand] = await db
    .select({
      id: brands.id,
      name: brands.name,
      industry: brands.industry,
      accentColor: brands.accentColor,
      logoUrl: brands.logoUrl,
      notes: brands.notes,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(brands)
    .leftJoin(users, eq(brands.ownerId, users.id))
    .where(eq(brands.id, brandId));
  if (!brand) notFound();

  const list = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.brandId, brandId), inArray(campaigns.status, ["ACTIVE", "PAUSED", "SCHEDULED", "READY"])))
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
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div className="flex items-start gap-4">
          <BrandMark
            name={brand.name}
            logoUrl={brand.logoUrl}
            accentColor={brand.accentColor}
            size="lg"
          />
          <div>
            <p className="eyebrow">
              {brand.industry ?? dict.nav.brands} · {dict.common.role}: {role.toLowerCase()}
            </p>
            <h1 className="mt-1 text-2xl font-semibold">{brand.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="eyebrow">{dict.brand.owner}</span>
              <OwnerBadge name={brand.ownerName} email={brand.ownerEmail} />
            </div>
          </div>
        </div>

        {role !== "VIEWER" && (
          <Link
            href={`/campaigns/new?brand=${brand.id}`}
            className="h-9 shrink-0 btn-primary rounded-md px-4 text-sm font-semibold leading-9"
          >
            {dict.campaign.newCampaign}
          </Link>
        )}
      </header>

      {brand.notes && (
        <p className="max-w-3xl rounded-md border-s-2 border-line-strong bg-sunken/60 px-4 py-3 text-sm text-ink-soft">
          {brand.notes}
        </p>
      )}

      <section>
        <h2 className="eyebrow mb-3">{dict.campaign.live}</h2>
        {list.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
            {dict.campaign.noCampaigns}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((campaign) => {
              const day = byCampaign.get(campaign.id);
              const band = indexBand(day?.prominenceIndex ?? 0);
              return (
                <li key={campaign.id} className="card card-interactive p-5">
                  <Link href={`/campaigns/${campaign.id}`} className="font-medium hover:underline">
                    {campaign.name}
                  </Link>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusPill status={campaign.status} dict={dict} />
                    <span className="tnum text-xs text-muted">
                      {formatMoney(campaign.budget, campaign.currency)}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <dt className="eyebrow">{dict.indices.prominence}</dt>
                      <dd className="tnum mt-1 text-2xl font-medium">
                        {day?.prominenceIndex?.toFixed(0) ?? "—"}
                      </dd>
                      <dd className="text-xs text-muted">{band.label}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">{dict.indices.effectiveness}</dt>
                      <dd className="tnum mt-1 text-2xl font-medium">
                        {day?.effectivenessIndex?.toFixed(0) ?? "—"}
                      </dd>
                      <dd className="text-xs text-muted">
                        {dict.metrics.engagementRate} {formatPercent(day?.engagementRate)}
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
