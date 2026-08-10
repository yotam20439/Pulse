import Link from "next/link";
import { forbidden } from "next/navigation";

import { getDictionary } from "@/lib/i18n";
import { isSuperAdmin, requireUser } from "@/lib/rbac";

/**
 * Everything under /settings is administrator-only. Guarding at the layout
 * means a page added here later is protected by default rather than by memory.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (!isSuperAdmin(user)) forbidden();
  const dict = await getDictionary();

  const tabs = [
    { href: "/settings/people", label: dict.nav.people },
    { href: "/settings/brands", label: dict.nav.brands },
    { href: "/settings/activity", label: dict.brand.activity },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{dict.nav.settings}</h1>
        <nav className="mt-4 flex gap-1 border-b border-line">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className="-mb-px border-b-2 border-transparent px-3 pb-2 text-sm transition-colors hover:border-line-strong"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
