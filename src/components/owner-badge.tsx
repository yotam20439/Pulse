import { cn } from "@/lib/utils";

/**
 * Initials avatar plus name. No image: user photos would mean an upload
 * pipeline and a storage bill for something that only needs to answer "who do I
 * chase about this".
 */
export function OwnerBadge({
  name,
  email,
  size = "sm",
  className,
}: {
  name: string | null;
  email?: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const display = name ?? email ?? null;
  if (!display) {
    return <span className={cn("text-xs text-muted", className)}>—</span>;
  }

  const initials = display
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "tnum inline-flex shrink-0 items-center justify-center rounded-full bg-sunken font-medium text-ink-soft",
          size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
        )}
      >
        {initials}
      </span>
      <span className={cn("truncate", size === "sm" ? "text-xs" : "text-sm")}>{display}</span>
    </span>
  );
}
