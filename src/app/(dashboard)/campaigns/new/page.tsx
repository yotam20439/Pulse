import { CampaignForm } from "@/components/forms/campaign-form";
import { createCampaign } from "@/lib/actions/entities";
import { listAccessibleBrands, requireUser } from "@/lib/rbac";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const user = await requireUser();
  // Only brands the user can actually edit are offered.
  const brands = (await listAccessibleBrands(user)).filter((b) => b.role !== "VIEWER");

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New campaign</h1>
        <p className="mt-1 text-sm text-muted">
          Creators and posts are added once the campaign exists.
        </p>
      </header>
      <CampaignForm action={createCampaign} brands={brands} />
    </div>
  );
}
