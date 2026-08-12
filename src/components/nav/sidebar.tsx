"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Settings, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import type { SessionUser } from "@/lib/rbac";
import type { BrandRole } from "@/db/schema";

type BrandItem = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  role: BrandRole;
};

/**
 * The rail is the one deep-violet surface in the app, and the only place Acid
 * Lime is legible enough to use as a marker. The active item gets a lime spine
 * on its leading edge — it reads at a glance from across a desk, which is the
 * whole job of a nav indicator, and it costs nothing in contrast because it
 * carries no text.
 */
export function Sidebar({
  brands,
  user,
  dict,
}: {
  brands: BrandItem[];
  user: SessionUser;
  dict: Dictionary;
}) {
  const pathname = usePathname();
  const isAdmin = user.systemRole === "SUPER_ADMIN";

  const links = [
    { href: "/", label: dict.nav.overview, icon: Activity },
    { href: "/campaigns", label: dict.nav.campaigns, icon: BarChart3 },
    { href: "/influencers", label: dict.nav.influencers, icon: Users },
  ];

  const itemClass = (active: boolean) =>
    cn(
      "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
      active ? "bg-white/[0.07] text-white" : "text-white/70 hover:bg-white/[0.04] hover:text-white",
    );

  const Spine = ({ active }: { active: boolean }) =>
    active ? (
      <span
        aria-hidden
        className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-lime"
      />
    ) : null;

  return (
    <aside className="on-void hidden w-64 shrink-0 flex-col border-e border-white/5 bg-void lg:flex">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="pulse-dot" aria-hidden />
        <span className="text-sm font-bold tracking-[-0.03em] text-white">PULSE</span>
      </div>

      <nav className="px-3 py-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={itemClass(active)}
            >
              <Spine active={active} />
              <Icon
                className={cn("size-4 shrink-0 transition-colors", active && "text-lime")}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="eyebrow px-3 py-2 text-white/35">
          {dict.nav.brands} {brands.length > 0 && `(${brands.length})`}
        </p>

        {brands.length === 0 ? (
          <p className="px-3 py-2 text-xs leading-relaxed text-white/40">{dict.nav.noBrands}</p>
        ) : (
          brands.map((brand) => {
            const href = `/brands/${brand.id}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={brand.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={itemClass(active)}
              >
                <Spine active={active} />
                {/* The brand's own colour, at full saturation against the
                    violet field — the only place each client is identifiable
                    without reading. */}
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full transition-transform group-hover:scale-125"
                  style={{ background: brand.accentColor }}
                />
                <span className="truncate">{brand.name}</span>
                {brand.role !== "VIEWER" && (
                  <span className="eyebrow ms-auto text-white/25">
                    {brand.role === "BRAND_ADMIN" ? "adm" : "ed"}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-white/5 p-3">
          <Link href="/settings/people" className={itemClass(pathname.startsWith("/settings"))}>
            <Spine active={pathname.startsWith("/settings")} />
            <Settings
              className={cn(
                "size-4 transition-colors",
                pathname.startsWith("/settings") && "text-lime",
              )}
              aria-hidden
            />
            {dict.nav.settings}
          </Link>
        </div>
      )}
    </aside>
  );
}
