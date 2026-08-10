import { indexBand } from "@/lib/indices";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const TONE = {
  positive: "text-positive",
  neutral: "text-ink",
  warning: "text-warning",
  critical: "text-critical",
} as const;

/**
 * The two scores carry more visual weight than any raw metric — they are what
 * a client asks about first.
 *
 * The arc is drawn rather than filled as a bar because a 0–100 index is a
 * position on a scale, not an accumulation: an arc reads as "where on the dial"
 * where a progress bar implies "how much of the way to done". The component
 * breakdown underneath stops the score being a black box — you can see that a
 * 62 is high volume and thin breadth, and act on it.
 */
export function IndexTile({
  label,
  native,
  score,
  delta,
  components,
  dict,
}: {
  label: string;
  native: string;
  score: number | null;
  delta?: number | null;
  components?: { label: string; value: number }[];
  dict: Dictionary;
}) {
  const band = indexBand(score ?? 0);
  const bandLabel = {
    Strong: dict.indices.strong,
    "On plan": dict.indices.onPlan,
    Soft: dict.indices.soft,
    Underperforming: dict.indices.under,
  }[band.label];

  const ARC = Math.PI * 52;
  const filled = ((score ?? 0) / 100) * ARC;

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{label}</p>
          {/* The Hebrew name is the term the team actually uses; keep it
              visible in both locales rather than translating it away. */}
          <p className="mt-0.5 text-xs text-muted" dir="rtl" lang="he">
            {native}
          </p>
        </div>
        {delta != null && delta !== 0 && (
          <span
            className={cn(
              "tnum rounded-full px-2 py-0.5 text-xs",
              delta > 0 ? "bg-positive/10 text-positive" : "bg-critical/10 text-critical",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} · {dict.indices.sevenDay}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end gap-5">
        <div className="relative shrink-0">
          <svg viewBox="0 0 120 68" className="w-32" role="img" aria-label={`${score ?? 0} / 100`}>
            <path
              d="M 8 60 A 52 52 0 0 1 112 60"
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d="M 8 60 A 52 52 0 0 1 112 60"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${ARC}`}
            />
          </svg>
          <div className="absolute inset-x-0 bottom-0 text-center">
            <span className="tnum text-3xl font-medium leading-none">
              {score == null ? "—" : score.toFixed(0)}
            </span>
          </div>
        </div>

        <div className="pb-1">
          <p className={cn("text-sm font-medium", TONE[band.tone])}>{bandLabel}</p>
          <p className="text-xs text-muted">{dict.indices.outOf}</p>
        </div>
      </div>

      {components && (
        <dl className="mt-5 space-y-2 border-t border-line pt-4">
          {components.map((c) => (
            <div key={c.label} className="flex items-center gap-3 text-xs">
              <dt className="w-28 shrink-0 text-muted">{c.label}</dt>
              <dd className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                <div
                  className="h-full rounded-full bg-ink-soft/35"
                  style={{ width: `${Math.round(Math.min(c.value, 1) * 100)}%` }}
                />
              </dd>
              <dd className="tnum w-8 text-end text-muted">{Math.round(c.value * 100)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
