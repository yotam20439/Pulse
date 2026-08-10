import type { NextAuthConfig } from "next-auth";


/**
 * Edge-safe half of the Auth.js config: no database imports, no Node APIs.
 * `middleware.ts` initialises NextAuth with *only* this file so the matcher
 * runs on the edge; `src/auth.ts` extends it with the Drizzle adapter.
 */
export const authConfig = {
  // Providers live in src/auth.ts: the credentials provider needs database
  // access, which must not be imported into the edge-safe config.
  providers: [],
  session: {
    // JWT rather than database sessions, so middleware can authorise a request
    // without a DB round-trip. Brand permissions are baked into the token and
    // refreshed every PERMISSIONS_TTL_MS (see src/auth.ts).
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      if (pathname.startsWith("/signin")) return true;
      if (pathname.startsWith("/api/cron")) return true; // guarded by CRON_SECRET
      return isLoggedIn;
    },
  },
} satisfies NextAuthConfig;
