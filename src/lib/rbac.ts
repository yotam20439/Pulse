import "server-only";
import { forbidden, unauthorized } from "next/navigation";
import { inArray } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "@/db";
import { brands, type BrandRole } from "@/db/schema";

/**
 * Every brand-scoped read goes through this module. The rule is simple:
 * SUPER_ADMIN sees everything; everyone else sees exactly the brands listed in
 * their `brand_members` grants, at the role recorded there.
 */

const RANK: Record<BrandRole, number> = { VIEWER: 1, EDITOR: 2, BRAND_ADMIN: 3 };

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  systemRole: "SUPER_ADMIN" | "STAFF" | "CLIENT";
  brands: Record<string, BrandRole>;
};

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) unauthorized();
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    systemRole: session.user.systemRole,
    brands: session.user.brands ?? {},
  };
}

export function isSuperAdmin(user: SessionUser) {
  return user.systemRole === "SUPER_ADMIN";
}

/** The role a user holds on a brand, or null if they hold none. */
export function roleOn(user: SessionUser, brandId: string): BrandRole | null {
  if (isSuperAdmin(user)) return "BRAND_ADMIN";
  return user.brands[brandId] ?? null;
}

export function canAccess(user: SessionUser, brandId: string, minRole: BrandRole = "VIEWER") {
  const role = roleOn(user, brandId);
  return role !== null && RANK[role] >= RANK[minRole];
}

/**
 * Throws (renders the 403 boundary) unless the user meets `minRole` on the
 * brand. Call this at the top of every brand page, action, and route handler.
 */
export async function requireBrandAccess(brandId: string, minRole: BrandRole = "VIEWER") {
  const user = await requireUser();
  if (!canAccess(user, brandId, minRole)) forbidden();
  return { user, role: roleOn(user, brandId)! };
}

/**
 * Brand ids the user may query. `null` means "no restriction" (SUPER_ADMIN) —
 * distinct from `[]`, which means "no access to anything" and must still
 * produce an empty result rather than a full table scan.
 */
export function accessibleBrandIds(user: SessionUser): string[] | null {
  return isSuperAdmin(user) ? null : Object.keys(user.brands);
}

/** A `where` fragment that scopes any query carrying a brand_id column. */
export function brandScope(user: SessionUser, column: typeof brands.id) {
  const ids = accessibleBrandIds(user);
  if (ids === null) return undefined; // unrestricted
  if (ids.length === 0) return inArray(column, ["00000000-0000-0000-0000-000000000000"]);
  return inArray(column, ids);
}

/** Brands for the sidebar switcher, already filtered by permission. */
export async function listAccessibleBrands(user: SessionUser) {
  const ids = accessibleBrandIds(user);
  if (ids !== null && ids.length === 0) return [];
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
      logoUrl: brands.logoUrl,
      accentColor: brands.accentColor,
    })
    .from(brands)
    .where(ids === null ? undefined : inArray(brands.id, ids))
    .orderBy(brands.name);
  return rows.map((b) => ({ ...b, role: roleOn(user, b.id)! }));
}
