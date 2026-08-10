import { InfluencerForm } from "@/components/forms/entity-forms";
import { createInfluencer } from "@/lib/actions/entities";

export const metadata = { title: "Add creator" };

export default function NewInfluencerPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Add creator</h1>
        <p className="mt-1 text-sm text-muted">
          The roster is shared across brands — add a creator once, book them on any campaign. One
          row per platform account.
        </p>
      </header>
      <InfluencerForm action={createInfluencer} />
    </div>
  );
}
