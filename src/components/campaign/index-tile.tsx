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
 * The signature element: a measuring dial, not a progress bar.
 *
 * A 0–100 index is a *position on a scale*, and a filled bar implies "this
 * much of the way to done", which is a different claim. The dial has real tick
 * marks at 25/50/75 and a needle, so a reader can see 62 as "just past the
 * middle" without reading the digits — and the band label underneath says what
 * the position means so the number never floats without interpretation.
 *
 * The arc uses the brand's colour; the needle is violet-black. Lime is
 * deliberately absent here — this tile appears on light surfaces where lime
 * cannot hold its own.
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

  const value = score ?? 0;
  const R = 54;
  const ARC = Math.PI * R;
  const filled = (value / 100) * ARC;

  // Needle angle across a 180° sweep, drawn from the dial centre (60, 62).
  const angle = (value / 100) * 180 - 180;
  const rad = (angle * Math.PI) / 180;
  const needleX = 60 + Math.cos(rad) * (R - 12);
  const needleY = 62 + Math.sin(rad) * (R - 12);

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{label}</p>
          {/* The Hebrew name is what the team actually says out loud; it stays
              visible in both locales rather than being translated away. */}
          <p className="mt-0.5 text-xs text-muted" dir="rtl" lang="he">
            {native}
          </p>
        </div>
        {delta != null && delta !== 0 && (
          <span
            className={cn(
              "tnum rounded-full px-2 py-0.5 text-xs font-medium",
              delta > 0 ? "bg-positive/10 text-positive" : "bg-critical/10 text-critical",
            )}
          >
            {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} · {dict.indices.sevenDay}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-end gap-5">
        <div className="relative shrink-0" dir="ltr">
          <svg viewBox="0 0 120 72" className="w-36" role="img" aria-label={`${value.toFixed(0)} / 100`}>
            <path
              d="M 6 62 A 54 54 0 0 1 114 62"
              fill="none"
              stroke="var(--surface-sunken)"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M 6 62 A 54 54 0 0 1 114 62"
              fill="none"
              stroke="var(--brand)"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${ARC}`}
            />

            {/* Quartile ticks — the difference between a dial and a bar. */}
            {[25, 50, 75].map((tick) => {
              const a = ((tick / 100) * 180 - 180) * (Math.PI / 180);
              return (
                <line
                  key={tick}
                  x1={60 + Math.cos(a) * (R - 11)}
                  y1={62 + Math.sin(a) * (R - 11)}
                  x2={60 + Math.cos(a) * (R + 5)}
                  y2={62 + Math.sin(a) * (R + 5)}
                  stroke="var(--line-strong)"
                  strokeWidth="1"
                />
              );
            })}

            {score != null && (
              <>
                <line
                  x1="60"
                  y1="62"
                  x2={needleX}
                  y2={needleY}
                  stroke="var(--ink)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="60" cy="62" r="3.5" fill="var(--ink)" />
              </>
            )}
          </svg>

          <div className="pointer-events-none absolute inset-x-0 top-7 text-center">
            <span className="tnum text-2xl font-semibold leading-none">
              {score == null ? "—" : score.toFixed(0)}
            </span>
          </div>
        </div>

        <div className="pb-1.5">
          <p className={cn("text-sm font-semibold", TONE[band.tone])}>{bandLabel}</p>
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
                  className="h-full rounded-full bg-brand/45"
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
