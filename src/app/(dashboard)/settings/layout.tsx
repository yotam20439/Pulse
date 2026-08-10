import Link from "next/link";
import { forbidden } from "next/navigation";

import { isSuperAdmin, requireUser } from "@/lib/rbac";

/**
 * Everything under /settings is administrator-only. Guarding at the layout
 * means a new page added here is protected by default rather than by memory.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isSuperAdmin(user)) forbidden();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <nav className="mt-4 flex gap-1 border-b border-line">
          <Link href="/settings/people" className="-mb-px border-b-2 border-transparent px-3 pb-2 text-sm hover:border-line-strong">
            People
          </Link>
          <Link href="/settings/brands" className="-mb-px border-b-2 border-transparent px-3 pb-2 text-sm hover:border-line-strong">
            Brands
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
