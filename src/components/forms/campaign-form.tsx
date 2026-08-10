"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
import type { ActionState } from "@/lib/actions/entities";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const STATUSES = ["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

export function CampaignForm({
  action,
  brands,
  campaign,
}: {
  action: Action;
  brands: { id: string; name: string }[];
  campaign?: {
    id: string;
    brandId: string;
    name: string;
    objective: string | null;
    status: string;
    startDate: string;
    endDate: string | null;
    budget: string;
    currency: string;
  };
}) {
  const [state, formAction] = useActionState(action, {});
  const editing = Boolean(campaign);

  if (brands.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
        You need edit access to at least one brand before you can create a campaign.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-line bg-surface p-5">
      {editing && <input type="hidden" name="campaignId" value={campaign!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {editing ? (
          <Field label="Brand" hint="A campaign can't move between brands.">
            <Input value={brands.find((b) => b.id === campaign!.brandId)?.name ?? ""} disabled />
          </Field>
        ) : (
          <Field label="Brand" htmlFor="brandId">
            <Select id="brandId" name="brandId" required>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Campaign name" htmlFor="name">
          <Input id="name" name="name" required defaultValue={campaign?.name} />
        </Field>

        <Field label="Objective" className="sm:col-span-2">
          <Input
            name="objective"
            defaultValue={campaign?.objective ?? ""}
            placeholder="What is this campaign for?"
          />
        </Field>

        <Field label="Start date">
          <Input name="startDate" type="date" required defaultValue={campaign?.startDate} />
        </Field>
        <Field label="End date" hint="Leave blank for open-ended.">
          <Input name="endDate" type="date" defaultValue={campaign?.endDate ?? ""} />
        </Field>

        <Field label="Budget">
          <Input
            name="budget"
            type="number"
            min={0}
            step={100}
            defaultValue={campaign?.budget ?? "0"}
          />
        </Field>
        <Field label="Currency">
          <Select name="currency" defaultValue={campaign?.currency ?? "ILS"}>
            {["ILS", "USD", "EUR", "GBP"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status">
          <Select name="status" defaultValue={campaign?.status ?? "DRAFT"}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>

        {!editing && (
          <Field label="Hashtags" hint="Space or comma separated.">
            <Input name="hashtags" placeholder="#summer #brandname" />
          </Field>
        )}
      </div>

      {!editing && (
        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="eyebrow">Targets</legend>
          <p className="text-xs text-muted">
            The Effectiveness Index scores delivery against these. Without targets it falls back to
            a neutral 50%, so the score tells you far less.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Impressions">
              <Input name="targetImpressions" type="number" min={0} step={1000} />
            </Field>
            <Field label="Engagement rate" hint="0.045 = 4.5%">
              <Input name="targetEngagementRate" type="number" step="0.001" min="0" max="1" />
            </Field>
            <Field label="Clicks">
              <Input name="targetClicks" type="number" min={0} />
            </Field>
          </div>
        </fieldset>
      )}

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton>{editing ? "Save campaign" : "Create campaign"}</SubmitButton>
    </form>
  );
}
