"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n/dictionaries";

type ActionState = { error?: string; ok?: string };
type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Edit a single value in place, without leaving the list.
 *
 * The pattern is deliberately narrow: one field, one save, no modal. Opening a
 * whole record editor to change a fee is the friction this removes, and a
 * dialog would reintroduce most of it. The pencil stays hidden until the row
 * is hovered or focused, so a table of thirty rows isn't a wall of buttons.
 *
 * Enter saves, Escape reverts — the shortcuts people already expect from
 * spreadsheets, which is the mental model for editing a cell in a table.
 */
export function EditableCell({
  action,
  hidden,
  name,
  value,
  type = "text",
  align = "start",
  format,
  className,
}: {
  action: (formData: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  name: string;
  value: string | number | null;
  type?: "text" | "number" | "url";
  align?: "start" | "end";
  /** Display formatting for the read-only state. */
  format?: (v: string | number | null) => string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  if (!editing) {
    return (
      <span
        className={cn(
          "group/cell inline-flex items-center gap-1.5",
          align === "end" && "justify-end",
          className,
        )}
      >
        <span>{format ? format(value) : (value ?? "—")}</span>
        <button
          type="button"
          onClick={() => {
            setDraft(String(value ?? ""));
            setEditing(true);
          }}
          aria-label="Edit"
          className="row-actions rounded p-0.5 text-muted hover:bg-sunken hover:text-ink"
        >
          <Pencil className="size-3" aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setEditing(false);
        return action(formData);
      }}
      className="inline-flex items-center gap-1"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <input
        ref={inputRef}
        name={name}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(String(value ?? ""));
            setEditing(false);
          }
        }}
        className={cn(
          "h-7 w-full min-w-20 rounded border border-brand bg-surface px-1.5 text-sm outline-none",
          align === "end" && "text-end",
        )}
      />

      <button
        type="submit"
        aria-label="Save"
        className="rounded p-1 text-positive hover:bg-positive/10"
      >
        <Check className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Cancel"
        onClick={() => {
          setDraft(String(value ?? ""));
          setEditing(false);
        }}
        className="rounded p-1 text-muted hover:bg-sunken"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </form>
  );
}

/**
 * A slide-over panel for editing a whole record from a list.
 *
 * Chosen over a centred modal because it keeps the list visible behind it —
 * when you're editing the third of eight campaigns, seeing the other seven is
 * the context that makes the edit meaningful. It also has room for a real form
 * without the cramped feel a dialog gets at this field count.
 */
export function EditDrawer({
  trigger,
  title,
  subtitle,
  children,
  dict,
}: {
  trigger: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  dict: Dictionary;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="contents">
        {trigger}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
          <button
            type="button"
            aria-label={dict.common.cancel}
            onClick={() => setOpen(false)}
            className="flex-1 bg-void/40 backdrop-blur-[2px]"
          />

          <div className="flex w-full max-w-xl flex-col overflow-y-auto border-s border-line bg-canvas shadow-[var(--shadow-raised)]">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-surface/90 px-6 py-4 backdrop-blur">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold tracking-[-0.02em]">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={dict.common.cancel}
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </header>

            <div className="p-6">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
