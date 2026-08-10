"use client";

import { useActionState, useState } from "react";

import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { BrandMark } from "@/components/brand-mark";
import type { Dictionary } from "@/lib/i18n";
import type { ActionState } from "@/lib/actions/entities";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

const PLATFORMS = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "TELEGRAM"];
const POST_TYPES = ["POST", "REEL", "STORY", "CAROUSEL", "TIKTOK", "SHORT", "VIDEO", "LIVE"];

/* --------------------------------- users ---------------------------------- */

export function NewUserForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" required autoComplete="off" />
        </Field>
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" autoComplete="off" />
        </Field>
        <Field
          label="System role"
          htmlFor="systemRole"
          hint="SUPER_ADMIN bypasses brand permissions entirely."
        >
          <Select id="systemRole" name="systemRole" defaultValue="STAFF">
            <option value="STAFF">Staff — assigned brands only</option>
            <option value="CLIENT">Client — assigned brands, read-mostly</option>
            <option value="SUPER_ADMIN">Super admin — every brand</option>
          </Select>
        </Field>
        <Field label="Temporary password" htmlFor="password" hint="At least 8 characters.">
          <Input id="password" name="password" type="text" required minLength={8} autoComplete="off" />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton>Create user</SubmitButton>
    </form>
  );
}

export function PasswordForm({ action, userId }: { action: Action; userId: string }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Field label="New password" className="flex-1">
        <Input name="password" type="text" minLength={8} placeholder="min 8 characters" />
      </Field>
      <SubmitButton variant="ghost">Reset</SubmitButton>
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
}: {
  action: Action;
  deleteAction?: Action;
  users: { id: string; label: string }[];
  dict: Dictionary;
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
  const [logo, setLogo] = useState(brand?.logoUrl ?? "");
  const [colour, setColour] = useState(brand?.accentColor ?? "#6D4AFF");
  const [name, setName] = useState(brand?.name ?? "");

  return (
    <div className="space-y-4">
      <form action={formAction} className="card space-y-5 p-5">
        {brand && <input type="hidden" name="brandId" value={brand.id} />}

        {/* Live preview: the mark is what appears in the sidebar and every
            list, so showing it while editing beats saving to find out. */}
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <BrandMark name={name || "??"} logoUrl={logo || null} accentColor={colour} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-medium">{name || "—"}</p>
            <p className="text-xs text-muted">
              {logo ? "Logo" : "Monogram fallback"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand name">
            <Input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Industry">
            <Input name="industry" defaultValue={brand?.industry ?? ""} />
          </Field>

          <Field label={dict.brand.logo} hint={dict.brand.logoHint} className="sm:col-span-2">
            <Input
              name="logoUrl"
              type="url"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://…/logo.png"
            />
          </Field>

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

          <Field label="Accent colour">
            <Input
              name="accentColor"
              type="color"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="h-10 px-1"
            />
          </Field>

          {!brand && (
            <Field label="Slug" hint="Left blank, it's derived from the name.">
              <Input name="slug" placeholder="auto" />
            </Field>
          )}

          <Field
            label="Baseline monthly impressions"
            hint="The Prominence Index scores campaigns against this."
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
        <SubmitButton>{brand ? "Save brand" : "Create brand"}</SubmitButton>
      </form>

      {brand && deleteAction && <DeleteBrandForm action={deleteAction} brand={brand} dict={dict} />}
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
}: {
  action: Action;
  brand: { id: string; name: string };
  dict: Dictionary;
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

/* ------------------------------ influencers ------------------------------- */

export function InfluencerForm({ action }: { action: Action }) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Creator name" htmlFor="displayName">
          <Input id="displayName" name="displayName" required />
        </Field>
        <Field label="Platform">
          <Select name="platform" defaultValue="INSTAGRAM">
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Handle" hint="Without the @.">
          <Input name="handle" required placeholder="creatorname" />
        </Field>
        <Field label="Profile URL">
          <Input name="profileUrl" type="url" required placeholder="https://instagram.com/…" />
        </Field>
        <Field label="Followers">
          <Input name="followerCount" type="number" min={0} />
        </Field>
        <Field
          label="Baseline engagement rate"
          hint="As a decimal — 0.045 for 4.5%. Effectiveness is measured as lift over this."
        >
          <Input name="baselineEngagementRate" type="number" step="0.001" min="0" max="1" />
        </Field>
        <Field label="Contact email">
          <Input name="email" type="email" />
        </Field>
        <Field label="Agency">
          <Input name="agency" />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton>Add creator</SubmitButton>
    </form>
  );
}

/* --------------------------------- posts ---------------------------------- */

export function PostForm({
  action,
  campaignId,
  participants,
}: {
  action: Action;
  campaignId: string;
  participants: { id: string; label: string }[];
}) {
  const [state, formAction] = useActionState(action, {});

  if (participants.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
        Add creators to this campaign first — a post has to belong to someone on the roster.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      <input type="hidden" name="campaignId" value={campaignId} />

      <Field label="Post URL" hint="The platform is detected from the link.">
        <Input name="url" type="url" required placeholder="https://www.instagram.com/p/…" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Creator">
          <Select name="participantId" required>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format">
          <Select name="postType" defaultValue="REEL">
            {POST_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Published" hint="Defaults to now.">
          <Input name="publishedAt" type="datetime-local" />
        </Field>
        <Field label="Caption">
          <Input name="caption" />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton>Start tracking</SubmitButton>
    </form>
  );
}
