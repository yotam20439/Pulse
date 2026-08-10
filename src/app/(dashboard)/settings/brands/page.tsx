import { asc } from "drizzle-orm";

import { BrandForm } from "@/components/forms/entity-forms";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { createBrand, updateBrand } from "@/lib/actions/entities";
import { formatCount } from "@/lib/utils";

export const metadata = { title: "Brands" };

export default async function BrandsSettingsPage() {
  const rows = await db.select().from(brands).orderBy(asc(brands.name));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="eyebrow">New brand</h2>
        <BrandForm action={createBrand} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">Existing brands ({rows.length})</h2>
        {rows.map((brand) => (
          <details key={brand.id} className="rounded-lg border border-line bg-surface">
            <summary className="flex cursor-pointer items-center gap-3 px-5 py-4 text-sm">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ background: brand.accentColor }}
              />
              <span className="font-medium">{brand.name}</span>
              <span className="text-muted">{brand.industry}</span>
              <span className="tnum ml-auto text-xs text-muted">
                baseline {formatCount(brand.baselineMonthlyImpressions)}
              </span>
            </summary>
            <div className="border-t border-line p-5">
              <BrandForm action={updateBrand} brand={brand} />
            </div>
          </details>
        ))}
      </section>
    </div>
  );
}
