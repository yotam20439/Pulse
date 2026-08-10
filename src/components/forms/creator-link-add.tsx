"use client";

import { useActionState, useMemo, useState } from "react";
import { Check, Link2, X } from "lucide-react";

import { PlatformBadge } from "@/components/platform-badge";
import { Field, FormMessage, Input, SubmitButton } from "@/components/ui/form";
import type { ActionState } from "@/lib/actions/creators";
import { parseMany, suggestName } from "@/lib/social-links";
import { cn } from "@/lib/utils";

type Action = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * The primary way creators enter the system: paste a link.
 *
 * Parsing runs as you type, so the platform and handle are confirmed before
 * submitting rather than after. That feedback is the whole point — it turns
 * "did it understand what I pasted" from a question into something visible.
 *
 * Multiple links are accepted in one go, because a creator is usually several
 * accounts belonging to one person, and entering them one at a time is how you
 * end up with four duplicate records.
 */
export function CreatorLinkAdd({
  action,
  campaignId,
  suggestions = [],
  compact = false,
}: {
  action: Action;
  /** When present, the creator is booked onto this campaign in the same step. */
  campaignId?: string;
  suggestions?: {
    id: string;
    displayName: string;
    handle: string;
    platform: string;
    followerCount: number | null;
    score?: number;
    workedWithBrand?: boolean;
  }[];
  compact?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [raw, setRaw] = useState("");
  const [name, setName] = useState("");
  const [touchedName, setTouchedName] = useState(false);

  const parsed = useMemo(() => parseMany(raw), [raw]);

  // Prefill the name from the first handle until the user types their own.
  const displayName = touchedName ? name : parsed[0] ? suggestName(parsed[0].handle) : "";

  return (
    <form action={formAction} className="card space-y-4 p-5">
      {campaignId && <input type="hidden" name="campaignId" value={campaignId} />}

      <Field
        label="Paste profile or post links"
        hint="Instagram, TikTok, YouTube, Facebook, X, LinkedIn, Telegram. Several at once is fine — they'll be grouped under one creator."
      >
        <textarea
          name="links"
          required
          rows={compact ? 2 : 3}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="https://www.instagram.com/creatorname/&#10;https://www.tiktok.com/@creatorname"
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
        />
      </Field>

      {/* Live parse feedback */}
      {raw.trim().length > 0 && (
        <div className="space-y-1.5">
          {parsed.length === 0 ? (
            <p className="flex items-center gap-2 text-xs text-warning">
              <X className="size-3.5" aria-hidden />
              Nothing recognised yet — keep typing, or check the link is a social profile.
            </p>
          ) : (
            parsed.map((link) => (
              <p
                key={`${link.platform}:${link.handle}`}
                className="flex items-center gap-2 text-xs text-ink-soft"
              >
                <Check className="size-3.5 shrink-0 text-positive" aria-hidden />
                <PlatformBadge platform={link.platform} />
                <span className="tnum">@{link.handle}</span>
                {link.wasPostLink && (
                  <span className="text-muted">· resolved from a post link</span>
                )}
              </p>
            ))
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Creator name">
          <Input
            name="displayName"
            required
            value={displayName}
            onChange={(e) => {
              setTouchedName(true);
              setName(e.target.value);
            }}
            placeholder="Taken from the handle"
          />
        </Field>

        <Field label="Tags" hint="Comma separated — used for campaign fit.">
          <Input name="tags" placeholder="food, family, fitness" />
        </Field>

        {parsed.length === 1 && (
          <>
            <Field label="Followers" hint="Optional — leave blank if unknown.">
              <Input name="followerCount" type="number" min={0} />
            </Field>
            <Field label="Engagement rate" hint="0.045 = 4.5%">
              <Input name="baselineEngagementRate" type="number" step="0.001" min="0" max="1" />
            </Field>
          </>
        )}

        {campaignId && (
          <>
            <Field label="Fee">
              <Input name="fee" type="number" min={0} defaultValue={0} />
            </Field>
            <Field label="Posts planned">
              <Input name="deliverablesPlanned" type="number" min={1} defaultValue={1} />
            </Field>
          </>
        )}
      </div>

      <FormMessage error={state.error} ok={state.ok} />

      <SubmitButton>
        {campaignId ? "Add and book on this campaign" : "Add creator"}
      </SubmitButton>

      {suggestions.length > 0 && (
        <div className="space-y-2 border-t border-line pt-4">
          <p className="eyebrow">Worked with before</p>
          <p className="text-xs text-muted">
            Suggestions only — ranked by fit with this campaign. Adding anyone new above always
            works.
          </p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setRaw((current) => `${current}\n${s.handle}`.trim())}
                  title="Use this creator"
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs transition-colors hover:bg-sunken",
                    s.workedWithBrand && "border-brand/40",
                  )}
                >
                  <Link2 className="size-3 text-muted" aria-hidden />
                  <span className="font-medium">{s.displayName}</span>
                  <span className="tnum text-muted">@{s.handle}</span>
                  {s.score != null && (
                    <span className="tnum rounded-full bg-sunken px-1.5 text-[10px] text-ink-soft">
                      {s.score.toFixed(0)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
