import { asc, eq, sql } from "drizzle-orm";

import { BrandMark } from "@/components/brand-mark";
import { BrandForm } from "@/components/forms/entity-forms";
import { EditableCell, EditDrawer } from "@/components/forms/inline-edit";
import { OwnerBadge } from "@/components/owner-badge";
import { db } from "@/db";
import { brands, campaigns, users } from "@/db/schema";
import {
  createBrand,
  deleteBrand,
  setBrandActive,
  updateBrand,
  updateBrandField,
} from "@/lib/actions/entities";
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
      <div className="flex justify-end">
        <EditDrawer
          dict={dict}
          title={dict.brand.newBrand}
          trigger={
            <span className="btn-primary inline-flex h-9 cursor-pointer items-center rounded-md px-4 text-sm font-semibold">
              {dict.brand.newBrand}
            </span>
          }
        >
          <BrandForm action={createBrand} users={userOptions} dict={dict} />
        </EditDrawer>
      </div>

      <section className="space-y-3">
        <h2 className="section-head eyebrow">{dict.nav.brands}</h2>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="data-head">
                <th className="eyebrow px-4 text-start font-normal">{dict.brand.name}</th>
                <th className="eyebrow px-4 text-start font-normal">{dict.brand.industry}</th>
                <th className="eyebrow px-4 text-start font-normal">{dict.brand.owner}</th>
                <th className="eyebrow px-4 text-end font-normal">{dict.brand.campaignCount}</th>
                <th className="eyebrow px-4 text-end font-normal">{dict.brand.baseline}</th>
                <th className="w-20" />
              </tr>
            </thead>
            <tbody>
              {rows.map((brand) => (
                <tr key={brand.id} className="data-row group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <BrandMark
                        name={brand.name}
                        logoUrl={brand.logoUrl}
                        accentColor={brand.accentColor}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <EditableCell
                          action={updateBrandField}
                          hidden={{ brandId: brand.id }}
                          name="name"
                          value={brand.name}
                          className="font-medium"
                        />
                        {!brand.isActive && (
                          <p className="text-xs text-muted">{dict.brand.archived}</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3 text-ink-soft">
                    <EditableCell
                      action={updateBrandField}
                      hidden={{ brandId: brand.id }}
                      name="industry"
                      value={brand.industry}
                    />
                  </td>

                  <td className="px-4 py-3">
                    <OwnerBadge name={brand.ownerName} email={brand.ownerEmail} />
                  </td>

                  <td className="tnum px-4 py-3 text-end text-muted">{brand.campaignCount}</td>

                  <td className="tnum px-4 py-3 text-end">
                    <EditableCell
                      action={updateBrandField}
                      hidden={{ brandId: brand.id }}
                      name="baseline"
                      type="number"
                      align="end"
                      value={brand.baselineMonthlyImpressions}
                      format={(v) => formatCount(v as number)}
                    />
                  </td>

                  <td className="px-2 py-3">
                    <div className="row-actions flex items-center justify-end gap-1">
                      <EditDrawer
                        dict={dict}
                        title={brand.name}
                        subtitle={dict.brand.newBrand}
                        trigger={
                          <span className="inline-flex cursor-pointer items-center rounded px-2 py-1 text-xs text-brand hover:bg-brand/10">
                            {dict.campaign.edit}
                          </span>
                        }
                      >
                        <div className="space-y-6">
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
                            <span className="ms-3 text-xs text-muted">{dict.brand.archiveHint}</span>
                          </form>
                        </div>
                      </EditDrawer>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
