"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Building2, Settings, Users } from "lucide-react";

import { cn } from "@/lib/utils";
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

const LINKS = [
  { href: "/", label: "Overview", icon: Activity },
  { href: "/campaigns", label: "Campaigns", icon: BarChart3 },
  { href: "/influencers", label: "Influencers", icon: Users },
] as const;

export function Sidebar({ brands, user }: { brands: BrandItem[]; user: SessionUser }) {
  const pathname = usePathname();
  const isAdmin = user.systemRole === "SUPER_ADMIN";

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-ink text-white/80 lg:flex">
      <div className="flex h-14 items-center gap-2 px-5">
        <span className="tnum text-sm font-semibold tracking-tight text-white">PULSE</span>
        <span className="eyebrow text-white/40">v0.1</span>
      </div>

      <nav className="px-3 py-2">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <p className="eyebrow px-3 py-2 text-white/40">
          Brands {brands.length > 0 && `(${brands.length})`}
        </p>

        {brands.length === 0 ? (
          <p className="px-3 py-2 text-xs leading-relaxed text-white/40">
            No brand access yet. An admin assigns brands from Settings → People.
          </p>
        ) : (
          brands.map((brand) => {
            const href = `/brands/${brand.id}`;
            const active = pathname.startsWith(href);
            return (
              <Link
                key={brand.id}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                  active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
                )}
              >
                {/* The brand's own colour is the only saturated pixel in the rail. */}
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: brand.accentColor }}
                />
                <span className="truncate">{brand.name}</span>
                {brand.role !== "VIEWER" && (
                  <span className="eyebrow ml-auto text-white/30">
                    {brand.role === "BRAND_ADMIN" ? "adm" : "ed"}
                  </span>
                )}
              </Link>
            );
          })
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-white/10 p-3">
          <Link
            href="/settings/people"
            className="flex h-9 items-center gap-3 rounded-md px-3 text-sm hover:bg-white/5 hover:text-white"
          >
            <Building2 className="size-4" aria-hidden />
            Brands &amp; people
          </Link>
          <Link
            href="/settings"
            className="flex h-9 items-center gap-3 rounded-md px-3 text-sm hover:bg-white/5 hover:text-white"
          >
            <Settings className="size-4" aria-hidden />
            Settings
          </Link>
        </div>
      )}
    </aside>
  );
}
