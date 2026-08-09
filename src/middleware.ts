import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Edge-safe: authConfig imports no database code, so this stays fast.
// Brand-level authorisation is *not* done here — a middleware can only see the
// URL, and brand ids appear in path params, search params, and request bodies.
// It is enforced in the page/action via requireBrandAccess() in src/lib/rbac.ts.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
