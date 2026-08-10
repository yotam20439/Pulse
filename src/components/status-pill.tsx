import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Campaign lifecycle, shown the same way everywhere.
 *
 * The palette is deliberately narrow: only ACTIVE gets a positive colour and
 * only PAUSED gets a warning one. If every state were coloured, the two that
 * need attention would stop standing out — which is the entire job of a status
 * pill in a list of thirty campaigns.
 */
const TONE: Record<string, string> = {
  DRAFT: "bg-sunken text-muted",
  READY: "bg-brand/10 text-brand",
  SCHEDULED: "bg-sunken text-ink-soft",
  ACTIVE: "bg-positive/10 text-positive",
  PAUSED: "bg-warning/10 text-warning",
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
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium",
        TONE[status] ?? "bg-sunken text-muted",
        className,
      )}
    >
      {label}
    </span>
  );
}

/** Ordered for the lifecycle, not alphabetically — used by every status select. */
export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
