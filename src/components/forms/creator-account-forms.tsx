"use client";

import { useActionState } from "react";

import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import type { ActionState } from "@/lib/actions/creators";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/** Manual stats entry. Writes a snapshot too, so growth becomes visible. */
export function AccountStatsForm({
  action,
  account,
}: {
  action: Action;
  account: {
    id: string;
    followerCount: number | null;
    avgLikes: number | null;
    avgComments: number | null;
    avgViews: number | null;
    baselineEngagementRate: number | null;
  };
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="accountId" value={account.id} />

      <div className="grid gap-3 sm:grid-cols-5">
        <Field label="Followers">
          <Input name="followerCount" type="number" min={0} defaultValue={account.followerCount ?? ""} />
        </Field>
        <Field label="Avg likes">
          <Input name="avgLikes" type="number" min={0} defaultValue={account.avgLikes ?? ""} />
        </Field>
        <Field label="Avg comments">
          <Input name="avgComments" type="number" min={0} defaultValue={account.avgComments ?? ""} />
        </Field>
        <Field label="Avg views">
          <Input name="avgViews" type="number" min={0} defaultValue={account.avgViews ?? ""} />
        </Field>
        <Field label="Eng. rate">
          <Input
            name="baselineEngagementRate"
            type="number"
            step="0.001"
            min="0"
            max="1"
            defaultValue={account.baselineEngagementRate ?? ""}
          />
        </Field>
      </div>

      <FormMessage error={state.error} ok={state.ok} />
      <SubmitButton variant="ghost">Save stats</SubmitButton>
    </form>
  );
}

/** Adds one more platform to an existing creator. */
export function AddAccountForm({
  action,
  influencerId,
}: {
  action: Action;
  influencerId: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="card flex flex-wrap items-end gap-3 p-4">
      <input type="hidden" name="influencerId" value={influencerId} />
      <Field label="Add another platform" className="min-w-64 flex-1">
        <Input name="url" type="url" required placeholder="https://www.tiktok.com/@handle" />
      </Field>
      <SubmitButton variant="ghost">Add account</SubmitButton>
      {state.error && <p className="w-full text-xs text-critical">{state.error}</p>}
      {state.ok && <p className="w-full text-xs text-positive">{state.ok}</p>}
    </form>
  );
}


/** Pulls live stats from the platform for one account. */
export function RefreshStatsForm({
  action,
  accountId,
  influencerId,
  provider,
}: {
  action: Action;
  accountId: string;
  influencerId: string;
  /** null when no provider is configured for this platform. */
  provider: string | null;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="influencerId" value={influencerId} />
      <SubmitButton variant="ghost">
        {provider ? `Refresh from ${provider}` : "Refresh"}
      </SubmitButton>
      {!provider && (
        <span className="text-xs text-muted">
          No provider configured for this platform — see DEPLOYING.md.
        </span>
      )}
      {state.error && <span className="text-xs text-warning">{state.error}</span>}
      {state.ok && <span className="text-xs text-positive">{state.ok}</span>}
    </form>
  );
}
