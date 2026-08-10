"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";

import { PlatformBadge } from "@/components/platform-badge";
import type { Dictionary } from "@/lib/i18n";
import type { PostRow } from "@/lib/queries/campaign";
import { cn, formatCount, formatPercent } from "@/lib/utils";

/**
 * Collection status is shown per row rather than hidden in a log, because a
 * silently stale number is worse than a visibly missing one — a client will
 * ask why a post flatlined, and the honest answer is usually "we lost access
 * to it three days ago".
 */


const relative = (date: Date | null) => {
  if (!date) return "—";
  const hours = Math.round((Date.now() - new Date(date).getTime()) / 3_600_000);
  if (hours < 1) return "<1h";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export function PostTable({ posts, dict }: { posts: PostRow[]; dict: Dictionary }) {
  const [onlyIssues, setOnlyIssues] = useState(false);

  const STATUS_COPY: Record<string, { label: string; tone: string }> = {
    OK: { label: dict.campaign.tracking, tone: "text-muted" },
    PENDING: { label: dict.campaign.pending, tone: "text-muted" },
    PARTIAL: { label: dict.campaign.partial, tone: "text-warning" },
    FAILED: { label: dict.campaign.failed, tone: "text-critical" },
    UNAVAILABLE: { label: dict.campaign.unavailable, tone: "text-critical" },
  };

  const rows = useMemo(
    () =>
      onlyIssues
        ? posts.filter((p) => p.collectionStatus !== "OK" || p.reach == null)
        : posts,
    [posts, onlyIssues],
  );

  const issueCount = posts.filter((p) => p.collectionStatus !== "OK").length;

  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line-strong bg-surface p-8 text-center text-sm text-muted">
        {dict.campaign.noPosts}
      </p>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-2">
        <p className="eyebrow">
          {posts.length} {dict.metrics.posts.toLowerCase()}
          {issueCount > 0 && ` · ${issueCount} ${dict.campaign.needAttention}`}
        </p>
        {issueCount > 0 && (
          <button
            onClick={() => setOnlyIssues((v) => !v)}
            className={cn(
              "h-7 rounded px-3 text-xs transition-colors",
              onlyIssues ? "bg-sunken font-medium text-ink" : "text-muted hover:text-ink",
            )}
          >
            {onlyIssues ? dict.campaign.showAll : dict.campaign.showIssues}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.metrics.posts}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.views}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.reach}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.engagements}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">{dict.metrics.engagementRate}</th>
              <th className="eyebrow px-4 py-3 text-end font-normal">24h</th>
              <th className="eyebrow px-4 py-3 text-start font-normal">{dict.campaign.collected}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((post) => {
              const status = STATUS_COPY[post.collectionStatus] ?? STATUS_COPY.PENDING;
              return (
                <tr key={post.id} className="border-b border-line last:border-0 hover:bg-sunken">
                  <td className="max-w-xs px-4 py-3">
                    <div className="flex items-start gap-2.5">
                      <PlatformBadge platform={post.platform} className="mt-0.5" />
                      <div className="min-w-0">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium hover:underline"
                        >
                          <span className="truncate">{post.name}</span>
                          <ExternalLink className="size-3 shrink-0 text-muted" aria-hidden />
                        </a>
                        <p className="truncate text-xs text-muted">
                          {post.postType.toLowerCase()} ·{" "}
                          {post.publishedAt
                            ? new Date(post.publishedAt).toISOString().slice(0, 10)
                            : "unpublished"}
                        </p>
                      </div>
                    </div>
                  </td>

                  <td className="tnum px-4 py-3 text-end">{formatCount(post.views)}</td>
                  <td className="tnum px-4 py-3 text-end">{formatCount(post.reach)}</td>
                  <td className="tnum px-4 py-3 text-end">{formatCount(post.engagements)}</td>
                  <td className="tnum px-4 py-3 text-end">{formatPercent(post.engagementRate)}</td>
                  <td className="tnum px-4 py-3 text-end text-muted">
                    {post.deltaViews == null
                      ? "—"
                      : `${post.deltaViews > 0 ? "+" : ""}${formatCount(post.deltaViews)}`}
                  </td>

                  <td className="px-4 py-3">
                    <p className="text-xs text-muted">{relative(post.lastCollectedAt)}</p>
                    {post.collectionStatus !== "OK" && (
                      <p className={cn("text-xs", status.tone)}>{status.label}</p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
