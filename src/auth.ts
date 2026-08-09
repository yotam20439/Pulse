import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";

import { authConfig } from "./auth.config";
import { db } from "./db";
import { brandMembers, users, type BrandRole, type SystemRole } from "./db/schema";

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
    .select({ systemRole: users.systemRole })
    .from(users)
    .where(eq(users.id, userId));

  const grants = await db
    .select({ brandId: brandMembers.brandId, role: brandMembers.role })
    .from(brandMembers)
    .where(eq(brandMembers.userId, userId));

  return {
    systemRole: (user?.systemRole ?? "STAFF") as SystemRole,
    brands: Object.fromEntries(grants.map((g) => [g.brandId, g.role])) as Record<string, BrandRole>,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  /**
   * Email + password, checked against our own users table.
   *
   * No adapter is configured: with the credentials provider and JWT sessions,
   * Auth.js never writes users, accounts, or sessions itself — this app
   * provisions accounts through admin screens instead. That also removes the
   * adapter's module-load-time inspection of the database client, which was a
   * reliable source of build failures.
   */
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email));

        // One generic failure for every reason — wrong password, unknown
        // address, deactivated account. Distinguishing them tells an attacker
        // which emails are real.
        if (!user || !user.isActive || !user.passwordHash) return null;
        if (!(await compare(password, user.passwordHash))) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,

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
        await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));
      }
    },
  },
});
