import { asc, eq, sql } from "drizzle-orm";

import { BrandMark } from "@/components/brand-mark";
import { BrandForm } from "@/components/forms/entity-forms";
import { OwnerBadge } from "@/components/owner-badge";
import { db } from "@/db";
import { brands, campaigns, users } from "@/db/schema";
import { createBrand, deleteBrand, setBrandActive, updateBrand } from "@/lib/actions/entities";
import { getDictionary } from "@/lib/i18n";
import { formatCount } from "@/lib/utils";

export const metadata = { title: "Brands" };

export default async function BrandsSettingsPage() {
  const dict = await getDictionary();

  const [rows, staff] = await Promise.all([
    db
      .select({
        id: brands.id,
        name: brands.name,
        slug: brands.slug,
        industry: brands.industry,
        accentColor: brands.accentColor,
        logoUrl: brands.logoUrl,
        ownerId: brands.ownerId,
        notes: brands.notes,
        isActive: brands.isActive,
        baselineMonthlyImpressions: brands.baselineMonthlyImpressions,
        ownerName: users.name,
        ownerEmail: users.email,
        campaignCount: sql<number>`(select count(*) from ${campaigns} where ${campaigns.brandId} = ${brands.id})`.mapWith(Number),
      })
      .from(brands)
      .leftJoin(users, eq(brands.ownerId, users.id))
      .orderBy(asc(brands.name)),

    db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.email)),
  ]);

  const userOptions = staff.map((u) => ({ id: u.id, label: u.name ?? u.email }));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="eyebrow">{dict.brand.newBrand}</h2>
        <BrandForm action={createBrand} users={userOptions} dict={dict} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">
          {dict.nav.brands} ({rows.length})
        </h2>

        {rows.map((brand) => (
          <details key={brand.id} className="card overflow-hidden">
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 p-4 text-sm">
              <BrandMark
                name={brand.name}
                logoUrl={brand.logoUrl}
                accentColor={brand.accentColor}
              />
              <div className="min-w-0">
                <p className="font-medium">
                  {brand.name}
                  {!brand.isActive && (
                    <span className="ms-2 text-xs font-normal text-muted">
                      · {dict.brand.archived}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">{brand.industry ?? "—"}</p>
              </div>

              <div className="ms-auto flex items-center gap-5">
                <OwnerBadge name={brand.ownerName} email={brand.ownerEmail} />
                <span className="tnum text-xs text-muted">
                  {brand.campaignCount} {dict.brand.campaignCount}
                </span>
                <span className="tnum hidden text-xs text-muted sm:inline">
                  {formatCount(brand.baselineMonthlyImpressions)}
                </span>
              </div>
            </summary>

            <div className="space-y-4 border-t border-line p-5">
              <BrandForm
                action={updateBrand}
                deleteAction={deleteBrand}
                users={userOptions}
                dict={dict}
                brand={brand}
                campaignCount={brand.campaignCount}
              />

              <form action={setBrandActive} className="border-t border-line pt-4">
                <input type="hidden" name="brandId" value={brand.id} />
                <input type="hidden" name="isActive" value={String(!brand.isActive)} />
                <button
                  type="submit"
                  className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken"
                >
                  {brand.isActive ? dict.brand.archive : dict.brand.unarchive}
                </button>
                <span className="ms-3 text-xs text-muted">
                  {dict.brand.archiveHint}
                </span>
              </form>
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
