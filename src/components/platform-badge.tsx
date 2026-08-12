import type { PlatformName } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * Two-letter codes rather than logos: they align in a mono column, they don't
 * need licensing, and they stay legible at table density where a 12px logo
 * turns to mush.
 */
const CODE: Record<PlatformName, string> = {
  INSTAGRAM: "IG",
  TIKTOK: "TT",
  YOUTUBE: "YT",
  FACEBOOK: "FB",
  X: "X",
  LINKEDIN: "LI",
  TELEGRAM: "TG",
};

export function PlatformBadge({ platform, className }: { platform: PlatformName; className?: string }) {
  return (
    <span
      title={platform.toLowerCase()}
      className={cn(
        "tnum inline-flex h-5 w-7 items-center justify-center rounded bg-sunken text-[10px] font-semibold tracking-tight text-ink-soft",
        className,
      )}
    >
      {CODE[platform]}
    </span>
  );
}
