"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";

import { PlatformBadge } from "@/components/platform-badge";
import type { ContributionRow } from "@/lib/queries/campaign";
import { cn, formatCount, formatMoney, formatPercent } from "@/lib/utils";

type SortKey = "reach" | "engagementRate" | "costPerEngagement" | "effectiveness" | "spend";

const COLUMNS: { key: SortKey; label: string; hint?: string }[] = [
  { key: "reach", label: "Reach" },
  { key: "engagementRate", label: "Eng. rate" },
  { key: "spend", label: "Cost" },
  { key: "costPerEngagement", label: "Cost / eng.", hint: "Spend ÷ weighted engagements" },
  { key: "effectiveness", label: "Effectiveness" },
];

/**
 * The re-booking table. Sorted by reach by default, but the column that
 * actually decides renewals is cost per weighted engagement — a creator can be
 * third on reach and first on value.
 */
export function ContributionTable({ rows, currency }: { rows: ContributionRow[]; currency: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "reach",
    dir: "desc",
  });

  const sorted = useMemo(() => {
    const cheaperIsBetter = sort.key === "costPerEngagement" || sort.key === "spend";
    return [...rows].sort((a, b) => {
      const av = a[sort.key] ?? (cheaperIsBetter ? Infinity : -1);
      const bv = b[sort.key] ?? (cheaperIsBetter ? Infinity : -1);
      return sort.dir === "desc" ? Number(bv) - Number(av) : Number(av) - Number(bv);
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
        No creators on this campaign yet. Add them from the campaign settings.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="eyebrow px-4 py-3 text-left font-normal">Creator</th>
            <th className="eyebrow px-4 py-3 text-left font-normal">Delivered</th>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key;
              const Icon = sort.dir === "desc" ? ArrowDown : ArrowUp;
              return (
                <th key={col.key} className="px-4 py-3 text-right font-normal">
                  <button
                    onClick={() => toggle(col.key)}
                    title={col.hint}
                    aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
                    className={cn(
                      "eyebrow inline-flex items-center gap-1 hover:text-ink",
                      active && "text-ink",
                    )}
                  >
                    {col.label}
                    {active && <Icon className="size-3" aria-hidden />}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.participantId} className="border-b border-line last:border-0 hover:bg-sunken">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <PlatformBadge platform={row.platform} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{row.name}</p>
                    <p className="tnum truncate text-xs text-muted">
                      @{row.handle} · {formatCount(row.followers)} followers
                    </p>
                  </div>
                </div>
              </td>

              <td className="px-4 py-3">
                <span
                  className={cn(
                    "tnum inline-flex items-center gap-1.5 text-xs",
                    row.underDelivering ? "text-warning" : "text-muted",
                  )}
                >
                  {row.underDelivering && <AlertTriangle className="size-3.5" aria-hidden />}
                  {row.delivery}
                </span>
              </td>

              <td className="px-4 py-3 text-right">
                <span className="tnum">{formatCount(row.reach)}</span>
                {/* Share of campaign reach, as a bar under the number. */}
                <span className="mt-1 block h-0.5 w-full max-w-20 justify-self-end bg-sunken">
                  <span
                    className="block h-0.5 bg-brand"
                    style={{ width: `${Math.round(row.shareOfReach * 100)}%` }}
                  />
                </span>
              </td>

              <td className="px-4 py-3 text-right">
                <span className="tnum">{formatPercent(row.engagementRate)}</span>
                {row.lift != null && (
                  <span
                    className={cn(
                      "tnum block text-xs",
                      row.lift >= 1 ? "text-positive" : "text-muted",
                    )}
                    title="Versus this creator's own baseline engagement rate"
                  >
                    {row.lift >= 1 ? "+" : ""}
                    {((row.lift - 1) * 100).toFixed(0)}% vs own
                  </span>
                )}
              </td>

              <td className="tnum px-4 py-3 text-right">{formatMoney(row.spend, currency)}</td>

              <td className="tnum px-4 py-3 text-right">
                {row.costPerEngagement == null ? "—" : row.costPerEngagement.toFixed(2)}
              </td>

              <td className="px-4 py-3 text-right">
                <span className="tnum text-base">{row.effectiveness.toFixed(0)}</span>
                <span className="block text-xs text-muted">{row.band.label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
