"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";

import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";

type ActionState = { error?: string; ok?: string };
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * One confirmation pattern for every destructive action in the app.
 *
 * Typing the exact name rather than clicking "Are you sure?" — a dialog is
 * dismissed reflexively after the third time you see it, whereas typing
 * "Halva & Co" requires reading what you're about to destroy. The consequence
 * is spelled out above the input, not hidden behind a tooltip, because these
 * cascades take metric history that cannot be rebuilt.
 */
export function ConfirmDelete({
  action,
  confirmValue,
  hidden,
  triggerLabel,
  title,
  consequence,
}: {
  action: Action;
  /** The exact string the user must type — usually the record's name. */
  confirmValue: string;
  hidden: Record<string, string>;
  triggerLabel: string;
  title: string;
  consequence: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-critical hover:underline"
      >
        <Trash2 className="size-3.5" aria-hidden />
        {triggerLabel}
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-critical/30 bg-surface p-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-sm text-ink-soft">{consequence}</p>
      </div>

      <Field label={`Type "${confirmValue}" to confirm`}>
        <Input
          name="confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
        />
      </Field>

      <FormMessage error={state.error} ok={state.ok} />

      <div className="flex gap-2">
        <SubmitButton variant="danger">{triggerLabel}</SubmitButton>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setTyped("");
          }}
          className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
