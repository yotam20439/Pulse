import { indexBand } from "@/lib/indices";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  positive: "text-positive",
  neutral: "text-ink",
  warning: "text-warning",
  critical: "text-critical",
};

/**
 * The two index scores get more visual weight than any raw metric — they are
 * the thing the client asks about first. The bar below the number is the only
 * place on the page that carries the brand colour at full saturation.
 */
export function IndexTile({
  label,
  hebrew,
  score,
  delta,
  components,
}: {
  label: string;
  hebrew: string;
  score: number | null;
  delta?: number | null;
  components?: { label: string; value: number }[];
}) {
  const band = indexBand(score ?? 0);

  return (
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <p className="text-xs text-muted" dir="rtl" lang="he">
          {hebrew}
        </p>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="tnum text-4xl font-medium leading-none">
          {score == null ? "—" : score.toFixed(0)}
        </span>
        <span className="text-xs text-muted">/ 100</span>
        {delta != null && delta !== 0 && (
          <span className={cn("tnum ml-auto text-xs", delta > 0 ? "text-positive" : "text-critical")}>
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} · 7d
          </span>
        )}
      </div>

      <div className="mt-3 h-1.5 w-full rounded-full bg-sunken">
        <div
          className="h-1.5 rounded-full bg-brand transition-[width]"
          style={{ width: `${Math.max(score ?? 0, 1)}%` }}
        />
      </div>
      <p className={cn("mt-2 text-xs font-medium", TONE[band.tone])}>{band.label}</p>

      {components && (
        <dl className="mt-4 space-y-1.5 border-t border-line pt-3">
          {components.map((c) => (
            <div key={c.label} className="flex items-center gap-3 text-xs">
              <dt className="w-28 shrink-0 text-muted">{c.label}</dt>
              <dd className="h-1 flex-1 rounded-full bg-sunken">
                <div
                  className="h-1 rounded-full bg-ink-soft/40"
                  style={{ width: `${Math.round(c.value * 100)}%` }}
                />
              </dd>
              <dd className="tnum w-9 text-right text-muted">{Math.round(c.value * 100)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
