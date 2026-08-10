"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/ui/form";
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
  brand,
}: {
  action: Action;
  brand?: {
    id: string;
    name: string;
    industry: string | null;
    accentColor: string;
    baselineMonthlyImpressions: number | null;
  };
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line bg-surface p-5">
      {brand && <input type="hidden" name="brandId" value={brand.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name" htmlFor={`name-${brand?.id ?? "new"}`}>
          <Input id={`name-${brand?.id ?? "new"}`} name="name" required defaultValue={brand?.name} />
        </Field>
        <Field label="Industry">
          <Input name="industry" defaultValue={brand?.industry ?? ""} />
        </Field>
        {!brand && (
          <Field label="Slug" hint="Left blank, it's derived from the name.">
            <Input name="slug" placeholder="auto" />
          </Field>
        )}
        <Field label="Accent colour" hint="Tints this brand's dashboard and charts.">
          <Input
            name="accentColor"
            type="color"
            defaultValue={brand?.accentColor ?? "#6D4AFF"}
            className="h-10 px-1"
          />
        </Field>
        <Field
          label="Baseline monthly impressions"
          hint="The Prominence Index scores campaigns against this. Get it wrong and every score shifts."
          className="sm:col-span-2"
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
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton>{brand ? "Save brand" : "Create brand"}</SubmitButton>
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
