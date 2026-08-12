import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { LocaleSwitcher } from "@/components/nav/locale-switcher";
import { getDictionary, getLocale } from "@/lib/i18n";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);

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
    <div className="on-void flex min-h-dvh items-center justify-center bg-void px-6">
      <div className="w-full max-w-sm text-white">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2.5 text-sm font-bold tracking-[-0.03em] text-white">
            <span className="pulse-dot" aria-hidden />
            PULSE
          </p>
          <LocaleSwitcher locale={locale} tone="dark" />
        </div>
        <h1 className="mt-8 text-3xl font-bold tracking-[-0.03em]">{dict.auth.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">{dict.auth.subtitle}</p>

        <form action={authenticate} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="eyebrow text-white/45">
              {dict.auth.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="mt-1.5 h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus:border-lime/60"
            />
          </div>

          <div>
            <label htmlFor="password" className="eyebrow text-white/45">
              {dict.auth.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 h-11 w-full rounded-md border border-white/15 bg-white/5 px-3 text-sm text-white outline-none transition-colors focus:border-lime/60"
            />
          </div>

          {error && (
            <p className="rounded-md border border-critical/40 bg-critical/10 p-3 text-sm text-white">
              {dict.auth.failed}
            </p>
          )}

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-lime px-4 text-sm font-semibold text-void transition-transform active:scale-[0.99]"
          >
            {dict.auth.submit}
          </button>
        </form>

        <p className="mt-8 text-xs text-white/40">{dict.auth.forgot}</p>
      </div>
    </div>
  );
}
