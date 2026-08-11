import { asc, eq } from "drizzle-orm";

import { CampaignForm } from "@/components/forms/campaign-form";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getDictionary } from "@/lib/i18n";
import { createCampaign } from "@/lib/actions/entities";
import { listAccessibleBrands, requireUser } from "@/lib/rbac";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const [user, dict] = await Promise.all([requireUser(), getDictionary()]);
  const staff = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(eq(users.isActive, true))
    .orderBy(asc(users.email));
  // Only brands the user can actually edit are offered.
  const brands = (await listAccessibleBrands(user)).filter((b) => b.role !== "VIEWER");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{dict.campaign.newCampaign}</h1>
        <p className="mt-1 text-sm text-muted">{dict.campaign.createHint}</p>
      </header>
      <CampaignForm
        action={createCampaign}
        brands={brands}
        dict={dict}
        users={staff.map((u) => ({ id: u.id, label: u.name ?? u.email }))}
      />
    </div>
  );
}
