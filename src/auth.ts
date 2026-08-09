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

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    systemRole?: SystemRole;
    brands?: Record<string, BrandRole>;
    permsRefreshedAt?: number;
  }
}

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
      if (user?.id) token.uid = user.id;
      if (!token.uid) return token;

      const stale = Date.now() - (token.permsRefreshedAt ?? 0) > PERMISSIONS_TTL_MS;
      if (Boolean(user) || trigger === "update" || stale) {
        const perms = await loadPermissions(token.uid);
        token.systemRole = perms.systemRole;
        token.brands = perms.brands;
        token.permsRefreshedAt = Date.now();
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id = token.uid ?? "";
      session.user.systemRole = token.systemRole ?? "STAFF";
      session.user.brands = token.brands ?? {};
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
