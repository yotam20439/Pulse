import { Lightbulb, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";

import type { GeneratedInsight } from "@/lib/insights";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const KIND_ICON = {
  TREND: TrendingUp,
  ANOMALY: TriangleAlert,
  RECOMMENDATION: Lightbulb,
  SUMMARY: Sparkles,
} as const;

const TONE_ACCENT = {
  positive: "before:bg-positive",
  neutral: "before:bg-line-strong",
  warning: "before:bg-warning",
  critical: "before:bg-critical",
} as const;

/**
 * Each insight carries a coloured spine on the leading edge and its confidence
 * in plain sight. Everything here comes from a rule with a stated threshold, so
 * a reader can check any claim against the numbers on the same page — which is
 * the difference between an insight and a guess with good grammar.
 */
export function InsightsPanel({
  insights,
  dict,
}: {
  insights: GeneratedInsight[];
  dict: Dictionary;
}) {
  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6">
        <p className="text-sm text-muted">{dict.insights.none}</p>
      </div>
    );
  }

  const kindLabel = {
    TREND: dict.insights.trend,
    ANOMALY: dict.insights.anomaly,
    RECOMMENDATION: dict.insights.recommendation,
    SUMMARY: dict.insights.summary,
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2.5">
        {insights.map((insight) => {
          const Icon = KIND_ICON[insight.kind];
          const low = insight.confidence < 0.7;

          return (
            <li
              key={insight.id}
              className={cn(
                "card relative overflow-hidden p-4 ps-5",
                // Leading spine: `before:start-0` follows text direction, so it
                // sits on the left in English and the right in Hebrew.
                "before:absolute before:inset-y-0 before:start-0 before:w-1",
                TONE_ACCENT[insight.tone],
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="eyebrow">{kindLabel[insight.kind]}</span>
                {insight.confidence < 1 && (
                  <span className="tnum ms-auto text-xs text-muted">
                    {Math.round(insight.confidence * 100)}% {dict.insights.confidence}
                  </span>
                )}
              </div>

              <p className="mt-2 font-medium leading-snug">{insight.title}</p>
              <p className={cn("mt-1 text-sm leading-relaxed", low ? "text-muted" : "text-ink-soft")}>
                {insight.body}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted">{dict.insights.generated}</p>
    </div>
  );
}
