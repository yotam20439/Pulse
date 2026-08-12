import { signOut } from "@/auth";
import { LocaleSwitcher } from "@/components/nav/locale-switcher";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { SessionUser } from "@/lib/rbac";

export function Topbar({
  user,
  dict,
  locale,
}: {
  user: SessionUser;
  dict: Dictionary;
  locale: Locale;
}) {
  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface/80 px-6 backdrop-blur-md lg:px-10">
      <div className="flex items-center gap-2 lg:hidden">
        <span className="pulse-dot" aria-hidden />
        <span className="text-sm font-bold tracking-[-0.03em]">PULSE</span>
      </div>

      <div className="ms-auto flex items-center gap-4">
        <LocaleSwitcher locale={locale} />

        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="tnum inline-flex size-8 items-center justify-center rounded-full bg-void text-[11px] font-semibold text-lime"
          >
            {initials}
          </span>
          <div className="hidden text-end leading-tight sm:block">
            <p className="text-sm font-medium">{user.name ?? user.email}</p>
            <p className="eyebrow">{user.systemRole.replace("_", " ").toLowerCase()}</p>
          </div>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="h-8 rounded-md border border-line px-3 text-sm text-ink-soft transition-colors hover:bg-sunken hover:text-ink"
          >
            {dict.nav.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
