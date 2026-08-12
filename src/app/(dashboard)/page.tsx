import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { db } from "@/db";
import { brands, campaigns } from "@/db/schema";
import { accessibleBrandIds, requireUser } from "@/lib/rbac";
import { getDictionary } from "@/lib/i18n";
import { t } from "@/lib/i18n/dictionaries";
import { formatMoney } from "@/lib/utils";

export default async function OverviewPage() {
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
            budget: campaigns.budget,
            currency: campaigns.currency,
            brandName: brands.name,
            accent: brands.accentColor,
          })
          .from(campaigns)
          .innerJoin(brands, eq(campaigns.brandId, brands.id))
          .where(ids === null ? undefined : inArray(campaigns.brandId, ids))
          .orderBy(desc(campaigns.startDate))
          .limit(20);

  if (rows.length === 0) {
    return (
      <div className="max-w-md">
        <h1 className="text-2xl font-semibold tracking-tight">No campaigns yet</h1>
        <p className="mt-2 text-sm text-muted">
          Campaigns appear here once a brand you can access has one. Ask an admin for brand
          access, or create the first campaign.
        </p>
        <Link
          href="/campaigns/new"
          className="mt-5 inline-flex h-9 items-center btn-primary rounded-md px-4 text-sm font-semibold"
        >
          Create campaign
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{t(dict.common.across, { n: new Set(rows.map((r) => r.brandName)).size })}</p>
        <h1 className="mt-1 text-2xl font-semibold">{dict.nav.campaigns}</h1>
      </header>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="data-head">
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.campaigns}</th>
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.nav.brands}</th>
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.campaign.status}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.campaign.budget}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="data-row transition-colors hover:bg-sunken/60">
                <td className="px-4 py-3">
                  <Link href={`/campaigns/${r.id}`} className="font-medium hover:underline">
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: r.accent }}
                    />
                    {r.brandName}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={r.status} dict={dict} />
                </td>
                <td className="tnum px-4 py-3 text-end">
                  {formatMoney(r.budget, r.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
