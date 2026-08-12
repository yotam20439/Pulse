import { cn } from "@/lib/utils";

/**
 * A brand's logo, or a monogram when it has none.
 *
 * This is now the *only* way a brand is identified visually — the interface
 * itself no longer recolours per brand, which keeps the palette consistent and
 * means a client's colour can't accidentally collide with a status colour or
 * fail contrast against the surface it lands on.
 *
 * The monogram still uses the stored accent so brands without a logo remain
 * distinguishable in a list. That colour is contained to this 24–48px square,
 * where contrast rules are easy to satisfy.
 *
 * A plain <img> rather than next/image: these are arbitrary uploaded or pasted
 * URLs, and each new host would otherwise need whitelisting in next.config.
 */
const SIZES = {
  xs: "size-5 text-[9px] rounded",
  sm: "size-6 text-[10px] rounded",
  md: "size-9 text-sm rounded-md",
  lg: "size-12 text-base rounded-lg",
} as const;

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
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        className={cn(
          SIZES[size],
          "shrink-0 border border-line bg-surface object-contain",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        SIZES[size],
        "inline-flex shrink-0 items-center justify-center font-bold text-white",
        className,
      )}
      style={{ background: accentColor }}
    >
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}
