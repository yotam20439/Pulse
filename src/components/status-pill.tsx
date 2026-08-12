import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Campaign lifecycle, rendered identically everywhere.
 *
 * Only two states get colour: ACTIVE (a live lime dot on a dark chip) and
 * PAUSED (warning). Everything else is neutral. If all seven were coloured,
 * the two that need attention would stop standing out — which is the entire
 * job of a status pill in a list of thirty campaigns.
 *
 * ACTIVE is the one chip with a dark ground, so lime is legible there and the
 * running campaigns are the first thing the eye lands on.
 */
const TONE: Record<string, string> = {
  DRAFT: "bg-sunken text-muted",
  READY: "bg-brand/10 text-brand",
  SCHEDULED: "bg-sunken text-ink-soft",
  ACTIVE: "bg-void text-white",
  PAUSED: "bg-warning/12 text-warning",
  COMPLETED: "bg-sunken text-ink-soft",
  ARCHIVED: "bg-sunken text-muted",
};

export function StatusPill({
  status,
  dict,
  className,
}: {
  status: string;
  dict: Dictionary;
  className?: string;
}) {
  const label = dict.status[status as keyof Dictionary["status"]] ?? status.toLowerCase();

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[status] ?? "bg-sunken text-muted",
        className,
      )}
    >
      {status === "ACTIVE" && <span className="pulse-dot" aria-hidden />}
      {label}
    </span>
  );
}

/** Ordered by lifecycle, not alphabetically — used by every status select. */
export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
