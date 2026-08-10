"use client";

import { useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { Dictionary } from "@/lib/i18n";
import { cn, formatCount, formatPercent } from "@/lib/utils";

type Row = {
  day: string;
  reach: number;
  impressions: number;
  engagements: number;
  engagementRate: number | null;
  prominenceIndex: number | null;
  effectivenessIndex: number | null;
};



/**
 * Two views over the same daily rollups. Indices share a fixed 0–100 axis so
 * the two lines are directly comparable; the audience view keeps reach as a
 * filled area behind engagements, because reach is context and engagement is
 * the reading.
 */
export function TrendChart({ data, dict }: { data: Row[]; dict: Dictionary }) {
  const [tab, setTab] = useState<"indices" | "audience">("indices");

  const TABS = [
    { id: "indices" as const, label: dict.campaign.indicesTab },
    { id: "audience" as const, label: dict.campaign.audienceTab },
  ];

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center text-sm text-muted">
{dict.campaign.noRollups}
      </div>
    );
  }

  const axisProps = {
    stroke: "var(--line-strong)",
    tick: { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" },
    tickLine: false,
    axisLine: false,
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <p className="eyebrow">{dict.campaign.lastDays(data.length)}</p>
        <div className="flex gap-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "h-7 rounded px-3 text-xs transition-colors",
                tab === t.id ? "bg-sunken font-medium text-ink" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 p-4 ps-0" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="day"
              {...axisProps}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={24}
            />
            <Tooltip
              cursor={{ stroke: "var(--line-strong)" }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid var(--line)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
              }}
              formatter={(value: number, name: string) =>
                name === dict.metrics.engagementRate
                  ? formatPercent(value)
                  : tab === "indices"
                    ? value?.toFixed(1)
                    : formatCount(value)
              }
            />

            {tab === "indices" ? (
              <>
                <YAxis domain={[0, 100]} width={36} {...axisProps} />
                <Line
                  type="monotone"
                  dataKey="prominenceIndex"
                  name={dict.indices.prominence}
                  stroke="var(--brand)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="effectivenessIndex"
                  name={dict.indices.effectiveness}
                  stroke="var(--ink)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                />
              </>
            ) : (
              <>
                <YAxis width={48} {...axisProps} tickFormatter={(v: number) => formatCount(v)} />
                <Area
                  type="monotone"
                  dataKey="reach"
                  name={dict.metrics.reach}
                  stroke="var(--brand)"
                  fill="var(--brand)"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="engagements"
                  name={dict.metrics.engagements}
                  stroke="var(--ink)"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-5 border-t border-line px-4 py-2">
        {(tab === "indices"
          ? [
              { label: dict.indices.prominence, color: "var(--brand)", dashed: false },
              { label: dict.indices.effectiveness, color: "var(--ink)", dashed: true },
            ]
          : [
              { label: dict.metrics.reach, color: "var(--brand)", dashed: false },
              { label: dict.metrics.engagements, color: "var(--ink)", dashed: false },
            ]
        ).map((l) => (
          <span key={l.label} className="flex items-center gap-2 text-xs text-muted">
            <span
              aria-hidden
              className="h-0.5 w-4"
              style={{
                background: l.dashed
                  ? `repeating-linear-gradient(90deg, ${l.color} 0 4px, transparent 4px 7px)`
                  : l.color,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
