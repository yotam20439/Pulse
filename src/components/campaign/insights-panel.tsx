import { Lightbulb, Pin, TrendingUp, TriangleAlert } from "lucide-react";

import type { Insight } from "@/db/schema";
import { cn } from "@/lib/utils";

const KIND = {
  TREND: { icon: TrendingUp, label: "Trend" },
  ANOMALY: { icon: TriangleAlert, label: "Anomaly" },
  RECOMMENDATION: { icon: Lightbulb, label: "Recommendation" },
  SUMMARY: { icon: TrendingUp, label: "Summary" },
} as const;

/**
 * Generated insights are shown with their confidence, because an unlabelled
 * machine-written claim on a client dashboard is a liability. Low-confidence
 * items are muted rather than hidden — the analyst decides, not the model.
 */
export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-surface p-6">
        <p className="text-sm font-medium">No insights yet</p>
        <p className="mt-1 text-sm text-muted">
          Insights are generated once a campaign has at least seven days of collected metrics.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {insights.map((insight) => {
        const meta = KIND[insight.kind];
        const Icon = meta.icon;
        const lowConfidence = (insight.confidence ?? 1) < 0.7;

        return (
          <li
            key={insight.id}
            className={cn(
              "rounded-lg border border-line bg-surface p-4",
              lowConfidence && "border-dashed",
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-3.5 text-muted" aria-hidden />
              <span className="eyebrow">{meta.label}</span>
              {insight.isPinned && <Pin className="size-3 text-brand" aria-hidden />}
              {insight.confidence != null && (
                <span className="tnum ml-auto text-xs text-muted">
                  {Math.round(insight.confidence * 100)}% confidence
                </span>
              )}
            </div>

            <p className="mt-2 font-medium">{insight.title}</p>
            <p className={cn("mt-1 text-sm leading-relaxed", lowConfidence ? "text-muted" : "text-ink-soft")}>
              {insight.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
