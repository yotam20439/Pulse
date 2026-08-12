"use client";

import { useActionState, useState } from "react";

import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LogoUpload } from "@/components/forms/logo-upload";
import { t } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n";
import type { ActionState } from "@/lib/actions/entities";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "TELEGRAM"];
const POST_TYPES = ["POST", "REEL", "STORY", "CAROUSEL", "TIKTOK", "SHORT", "VIDEO", "LIVE"];

/* --------------------------------- users ---------------------------------- */

export function NewUserForm({ action, dict }: { action: Action; dict: Dictionary }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.auth.email} htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label={dict.people.name} htmlFor="name">
          <Input id="name" name="name" autoComplete="off" />
        </Field>
        <Field
          label={dict.people.systemRole}
          htmlFor="systemRole"
          hint={dict.people.systemRoleHint}
        >
          <Select id="systemRole" name="systemRole" defaultValue="STAFF">
            <option value="STAFF">{dict.people.staff}</option>
            <option value="CLIENT">{dict.people.client}</option>
            <option value="SUPER_ADMIN">{dict.people.superAdmin}</option>
          </Select>
        </Field>
        <Field label={dict.people.tempPassword} htmlFor="password" hint={dict.people.tempPasswordHint}>
          <Input id="password" name="password" type="text" required minLength={8} autoComplete="off" />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton pendingLabel={dict.common.working}>{dict.people.createUser}</SubmitButton>
    </form>
  );
}

export function PasswordForm({
  action,
  userId,
  dict,
}: {
  action: Action;
  userId: string;
  dict: Dictionary;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Field label={dict.people.newPassword} className="flex-1">
        <Input name="password" type="text" minLength={8} placeholder="min 8 characters" />
      </Field>
      <SubmitButton variant="ghost" pendingLabel={dict.common.working}>{dict.people.reset}</SubmitButton>
      {state.error && <span className="pb-2 text-xs text-critical">{state.error}</span>}
      {state.ok && <span className="pb-2 text-xs text-positive">{state.ok}</span>}
    </form>
  );
}

/* --------------------------------- brands --------------------------------- */

export function BrandForm({
  action,
  deleteAction,
  users,
  dict,
  brand,
  campaignCount = 0,
}: {
  action: Action;
  deleteAction?: Action;
  users: { id: string; label: string }[];
  dict: Dictionary;
  campaignCount?: number;
  brand?: {
    id: string;
    name: string;
    industry: string | null;
    accentColor: string;
    logoUrl: string | null;
    ownerId: string | null;
    notes: string | null;
    baselineMonthlyImpressions: number | null;
  };
}) {
  const [state, formAction] = useActionState(action, {});
  const [colour, setColour] = useState(brand?.accentColor ?? "#6D28D9");
  const [name, setName] = useState(brand?.name ?? "");

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-5 p-5">
        {brand && <input type="hidden" name="brandId" value={brand.id} />}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={dict.brand.name}>
            <Input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label={dict.brand.industry}>
            <Input name="industry" defaultValue={brand?.industry ?? ""} />
          </Field>

          <div className="sm:col-span-2">
            <LogoUpload
              brandId={brand?.id}
              brandName={name || "??"}
              initialUrl={brand?.logoUrl}
              accentColor={colour}
              label={dict.brand.logo}
              hint={dict.brand.logoHint}
            />
          </div>

          <Field label={dict.brand.owner}>
            <Select name="ownerId" defaultValue={brand?.ownerId ?? ""}>
              <option value="">{dict.brand.unassigned}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={dict.brand.accent} hint={dict.brand.accentHint}>
            <Input
              name="accentColor"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-10 px-1"
            />
          </Field>

          {!brand && (
            <Field label={dict.brand.slug} hint={dict.brand.slugHint}>
              <Input name="slug" placeholder="auto" />
            </Field>
          )}

          <Field
            label={dict.brand.baseline}
            hint={dict.brand.baselineHint}
            className={brand ? "sm:col-span-2" : ""}
          >
            <Input
              name="baseline"
              type="number"
              min={0}
              step={10000}
              defaultValue={brand?.baselineMonthlyImpressions ?? ""}
              placeholder="e.g. 1500000"
            />
          </Field>

          <Field label={dict.brand.notes} className="sm:col-span-2">
            <Textarea name="notes" defaultValue={brand?.notes ?? ""} rows={2} />
          </Field>
        </div>

        <FormMessage error={state.error} ok={state.ok} />
        <SubmitButton pendingLabel={dict.common.working}>
          {brand ? dict.brand.save : dict.brand.create}
        </SubmitButton>
      </form>

      {brand && deleteAction && (
        <DeleteBrandForm
          action={deleteAction}
          brand={brand}
          dict={dict}
          campaignCount={campaignCount}
        />
      )}
    </div>
  );
}

/**
 * Deletion sits behind typing the brand name. It cascades through campaigns,
 * posts, and every snapshot ever collected — a confirm dialog is too easy to
 * click through for something with no undo.
 */
function DeleteBrandForm({
  action,
  brand,
  dict,
  campaignCount,
}: {
  action: Action;
  brand: { id: string; name: string };
  dict: Dictionary;
  campaignCount: number;
}) {
  const [state, formAction] = useActionState(action, {});
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-critical hover:underline"
      >
        {dict.brand.delete}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-critical/30 bg-surface p-4">
      <input type="hidden" name="brandId" value={brand.id} />
      <p className="text-sm text-ink-soft">{dict.brand.deleteBlocked}</p>

      {campaignCount > 0 && (
        <label className="flex items-start gap-2.5 rounded-md border border-line bg-sunken/50 p-3 text-sm">
          <input type="checkbox" name="force" value="on" className="mt-0.5 size-4 shrink-0" />
          <span className="text-ink-soft">
            {t(dict.danger.forceBrand, { count: campaignCount })}
          </span>
        </label>
      )}
      <Field label={`Type "${brand.name}" to confirm`}>
        <Input name="confirm" autoComplete="off" />
      </Field>
      <FormMessage error={state.error} ok={state.ok} />
      <div className="flex gap-2">
        <SubmitButton variant="danger">{dict.brand.delete}</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/* --------------------------------- posts ---------------------------------- */

export function PostForm({
  action,
  campaignId,
  participants,
  dict,
}: {
  action: Action;
  campaignId: string;
  participants: { id: string; label: string }[];
  dict: Dictionary;
}) {
  const [state, formAction] = useActionState(action, {});

  if (participants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
        {dict.campaign.noRosterYet}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="campaignId" value={campaignId} />

      <Field label={dict.campaign.postUrl} hint={dict.campaign.postUrlHint}>
        <Input name="url" type="url" required placeholder="https://www.instagram.com/p/…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={dict.metrics.creators}>
          <Select name="participantId" required>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.campaign.format}>
          <Select name="postType" defaultValue="REEL">
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={dict.campaign.published} hint={dict.campaign.publishedHint}>
          <Input name="publishedAt" type="datetime-local" />
        </Field>
        <Field label={dict.campaign.caption}>
          <Input name="caption" />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton pendingLabel={dict.common.working}>{dict.campaign.startTracking}</SubmitButton>
    </form>
  );
}
