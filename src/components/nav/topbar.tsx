import { signOut } from "@/auth";
import type { SessionUser } from "@/lib/rbac";

export function Topbar({ user }: { user: SessionUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-surface px-6 lg:px-10">
      <div className="lg:hidden">
        <span className="tnum text-sm font-semibold">PULSE</span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="text-right leading-tight">
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
            className="h-8 rounded-md border border-line px-3 text-sm text-ink-soft hover:bg-sunken"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
