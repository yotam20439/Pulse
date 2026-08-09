import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";

import { authConfig } from "./auth.config";
import { db } from "./db";
import {
  accounts,
  brandMembers,
  sessions,
  users,
  verificationTokens,
  type BrandRole,
  type SystemRole,
} from "./db/schema";

/** How long a token may cache brand permissions before re-reading the DB. */
const PERMISSIONS_TTL_MS = 5 * 60 * 1000;

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      systemRole: SystemRole;
      /** brandId -> role. Empty for a user with no grants yet. */
      brands: Record<string, BrandRole>;
    };
  }
}

/**
 * Shape of the extra data we keep on the JWT. Deliberately not a
 * `declare module "next-auth/jwt"` augmentation: that subpath moves between
 * v5 betas, and a missing augmentation target is a hard build failure.
 */
type AppToken = {
  uid?: string;
  systemRole?: SystemRole;
  brands?: Record<string, BrandRole>;
  permsRefreshedAt?: number;
};

async function loadPermissions(userId: string) {
  const [user] = await db
    .select({ systemRole: users.systemRole, isActive: users.isActive })
    .from(users)
    .where(eq(users.id, userId));

  const grants = await db
    .select({ brandId: brandMembers.brandId, role: brandMembers.role })
    .from(brandMembers)
    .where(eq(brandMembers.userId, userId));

  return {
    systemRole: (user?.systemRole ?? "STAFF") as SystemRole,
    isActive: user?.isActive ?? false,
    brands: Object.fromEntries(grants.map((g) => [g.brandId, g.role])) as Record<string, BrandRole>,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  callbacks: {
    ...authConfig.callbacks,

    // Users are provisioned by an admin, not self-served: an unknown or
    // deactivated address is turned away at the door.
    async signIn({ user }) {
      if (!user.email) return false;
      const [existing] = await db
        .select({ isActive: users.isActive })
        .from(users)
        .where(eq(users.email, user.email));
      return existing ? existing.isActive : false;
    },

    async jwt({ token, user, trigger }) {
      const t = token as typeof token & AppToken;
      if (user?.id) t.uid = user.id;
      if (!t.uid) return t;

      const stale = Date.now() - (t.permsRefreshedAt ?? 0) > PERMISSIONS_TTL_MS;
      if (Boolean(user) || trigger === "update" || stale) {
        const perms = await loadPermissions(t.uid);
        t.systemRole = perms.systemRole;
        t.brands = perms.brands;
        t.permsRefreshedAt = Date.now();
      }
      return t;
    },

    async session({ session, token }) {
      const t = token as typeof token & AppToken;
      session.user.id = t.uid ?? "";
      session.user.systemRole = t.systemRole ?? "STAFF";
      session.user.brands = t.brands ?? {};
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (user.id) {
        await db
          .update(users)
          .set({ lastSeenAt: new Date() })
          .where(eq(users.id, user.id));
      }
    },
  },
});
