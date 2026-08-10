"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * Deliberately small: label, control, and an optional hint, sharing the same
 * 40px control height and border treatment as the rest of the app. No design
 * system needed for a handful of admin forms.
 */

export function Field({
  label,
  hint,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="eyebrow">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const control =
  "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm outline-none focus:border-brand";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(control, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(control, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(control, "h-auto min-h-20 py-2 leading-relaxed", props.className)}
    />
  );
}

/** Disables itself while the action is in flight, so nothing double-submits. */
export function SubmitButton({
  children,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "h-9 rounded-md px-4 text-sm font-medium transition-opacity disabled:opacity-50",
        variant === "primary" && "bg-ink text-white",
        variant === "ghost" && "border border-line text-ink hover:bg-sunken",
        variant === "danger" && "border border-line text-critical hover:bg-sunken",
        className,
      )}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (!error && !ok) return null;
  return (
    <p
      className={cn(
        "rounded-md border border-line bg-surface p-3 text-sm",
        error ? "text-critical" : "text-positive",
      )}
    >
      {error ?? ok}
    </p>
  );
}
