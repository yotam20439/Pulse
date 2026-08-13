"use client";

import { useActionState } from "react";

import { CAMPAIGN_STATUSES } from "@/components/status-pill";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import type { Dictionary } from "@/lib/i18n";
import type { ActionState } from "@/lib/actions/entities";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;



export function CampaignForm({
  action,
  brands,
  users,
  dict,
  campaign,
}: {
  action: Action;
  brands: { id: string; name: string }[];
  users: { id: string; label: string }[];
  dict: Dictionary;
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
    ownerId: string | null;
    notes: string | null;
  };
}) {
  const [state, formAction] = useActionState(action, {});
  const editing = Boolean(campaign);

  if (brands.length === 0) {
    return (
      <p className="empty text-sm text-muted">
        {dict.campaign.noEditableBrands}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-line bg-surface p-5">
      {editing && <input type="hidden" name="campaignId" value={campaign!.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        {editing ? (
          <Field label={dict.nav.brands} hint={dict.campaign.brandLocked}>
            <Input value={brands.find((b) => b.id === campaign!.brandId)?.name ?? ""} disabled />
          </Field>
        ) : (
          <Field label={dict.nav.brands} htmlFor="brandId">
            <Select id="brandId" name="brandId" required>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label={dict.campaign.name} htmlFor="name">
          <Input id="name" name="name" required defaultValue={campaign?.name} />
        </Field>

        <Field label={dict.campaign.objective} className="sm:col-span-2">
          <Input
            name="objective"
            defaultValue={campaign?.objective ?? ""}
            placeholder={dict.campaign.objectivePlaceholder}
          />
        </Field>

        <Field label={dict.campaign.startDate}>
          <Input name="startDate" type="date" required defaultValue={campaign?.startDate} />
        </Field>
        <Field label={dict.campaign.endDate} hint={dict.campaign.endDateHint}>
          <Input name="endDate" type="date" defaultValue={campaign?.endDate ?? ""} />
        </Field>

        <Field label={dict.campaign.budget}>
          <Input
            name="budget"
            type="number"
            min={0}
            step={100}
            defaultValue={campaign?.budget ?? "0"}
          />
        </Field>
        <Field label={dict.campaign.currency}>
          <Select name="currency" defaultValue={campaign?.currency ?? "ILS"}>
            {["ILS", "USD", "EUR", "GBP"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={dict.campaign.status}>
          <Select name="status" defaultValue={campaign?.status ?? "DRAFT"}>
            {CAMPAIGN_STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.status[s]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={dict.brand.owner} hint={dict.campaign.ownerHint}>
          <Select name="ownerId" defaultValue={campaign?.ownerId ?? ""}>
            <option value="">{dict.brand.unassigned}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={dict.brand.notes} className="sm:col-span-2">
          <Textarea name="notes" defaultValue={campaign?.notes ?? ""} rows={2} />
        </Field>

        {!editing && (
          <Field label={dict.campaign.hashtags} hint={dict.campaign.hashtagsHint}>
            <Input name="hashtags" placeholder="#summer #brandname" />
          </Field>
        )}
      </div>

      {!editing && (
        <fieldset className="space-y-4 border-t border-line pt-5">
          <legend className="eyebrow">{dict.campaign.targets}</legend>
          <p className="text-xs text-muted">{dict.campaign.targetsHint}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={dict.metrics.impressions}>
              <Input name="targetImpressions" type="number" min={0} step={1000} />
            </Field>
            <Field label={dict.metrics.engagementRate} hint={dict.creator.erHint}>
              <Input name="targetEngagementRate" type="number" step="0.001" min="0" max="1" />
            </Field>
            <Field label={dict.metrics.clicks}>
              <Input name="targetClicks" type="number" min={0} />
            </Field>
          </div>
        </fieldset>
      )}

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton pendingLabel={dict.common.working}>
        {editing ? dict.campaign.save : dict.campaign.create}
      </SubmitButton>
    </form>
  );
}
