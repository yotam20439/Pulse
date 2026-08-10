import { cn } from "@/lib/utils";

/**
 * Brand logo where one exists, and a coloured monogram where it doesn't.
 *
 * The fallback is not a placeholder image: it uses the brand's own accent
 * colour, so a brand without a logo still reads as itself in a list. A plain
 * <img> rather than next/image because these are arbitrary third-party URLs
 * that would each need whitelisting in next.config.
 */
export function BrandMark({
  name,
  logoUrl,
  accentColor,
  size = "md",
  className,
}: {
  name: string;
  logoUrl?: string | null;
  accentColor: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dimension = size === "sm" ? "size-6" : size === "md" ? "size-9" : "size-12";

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(dimension, "shrink-0 rounded-md border border-line object-contain bg-surface", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        dimension,
        "inline-flex shrink-0 items-center justify-center rounded-md font-semibold text-white",
        size === "sm" ? "text-[10px]" : size === "md" ? "text-sm" : "text-base",
        className,
      )}
      style={{ background: accentColor }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
