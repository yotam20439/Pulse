import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function authenticate(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (err) {
      // A successful sign-in throws NEXT_REDIRECT, which must propagate.
      // Only genuine auth failures are turned into a message.
      if (err instanceof AuthError) redirect("/signin?error=1");
      throw err;
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="tnum text-sm font-semibold tracking-tight">PULSE</p>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Use the work account your administrator created. Accounts are made by admins, not by
          signing up.
        </p>

        <form action={authenticate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="eyebrow">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="eyebrow">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 h-10 w-full rounded-md border border-line bg-surface px-3 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-md border border-line bg-surface p-3 text-sm text-critical">
              That email and password don&apos;t match an active account.
            </p>
          )}

          <button
            type="submit"
            className="h-10 w-full rounded-md bg-ink px-4 text-sm font-medium text-white"
          >
            Sign in
          </button>
        </form>

        <p className="mt-6 text-xs text-muted">
          Forgotten your password? An administrator can reset it for you.
        </p>
      </div>
    </div>
  );
}
