import { Sidebar } from "@/components/nav/sidebar";
import { Topbar } from "@/components/nav/topbar";
import { getDictionary, getLocale } from "@/lib/i18n";
import { listAccessibleBrands, requireUser } from "@/lib/rbac";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, dict, locale] = await Promise.all([requireUser(), getDictionary(), getLocale()]);
  const brands = await listAccessibleBrands(user);

  return (
    <div className="flex min-h-dvh">
      <Sidebar brands={brands} user={user} dict={dict} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} dict={dict} locale={locale} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
