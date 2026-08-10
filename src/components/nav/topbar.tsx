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
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface/85 px-6 backdrop-blur lg:px-10">
      <div className="lg:hidden">
        <span className="tnum text-sm font-semibold">PULSE</span>
      </div>

      <div className="ms-auto flex items-center gap-4">
        <LocaleSwitcher locale={locale} />

        <div className="text-end leading-tight">
          <p className="text-sm font-medium">{user.name ?? user.email}</p>
          <p className="eyebrow">{user.systemRole.replace("_", " ").toLowerCase()}</p>
        </div>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/signin" });
          }}
        >
          <button
            type="submit"
            className="h-8 rounded-md border border-line px-3 text-sm text-ink-soft transition-colors hover:bg-sunken"
          >
            {dict.nav.signOut}
          </button>
        </form>
      </div>
    </header>
  );
}
