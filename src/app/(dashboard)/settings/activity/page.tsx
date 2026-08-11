import { desc, eq } from "drizzle-orm";

import { OwnerBadge } from "@/components/owner-badge";
import { db } from "@/db";
import { auditLog, brands, users } from "@/db/schema";
import { getDictionary, getLocale } from "@/lib/i18n";

export const metadata = { title: "Activity" };

/**
 * The audit trail has been written since day one but never shown. On a tool
 * where several people edit the same client's campaigns, "who changed the
 * budget" is a question that gets asked, and reconstructing it from memory is
 * how disagreements start.
 */

export default async function ActivityPage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const formatter = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entity: auditLog.entity,
      diff: auditLog.diff,
      createdAt: auditLog.createdAt,
      actorName: users.name,
      actorEmail: users.email,
      brandName: brands.name,
      accentColor: brands.accentColor,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .leftJoin(brands, eq(auditLog.brandId, brands.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  if (rows.length === 0) {
    return <p className="py-10 text-sm text-muted">{dict.activity.empty}</p>;
  }

  return (
    <ul className="card divide-y divide-line overflow-hidden">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <OwnerBadge name={row.actorName} email={row.actorEmail} />
          <span className="text-ink-soft">{dict.activity[row.action as keyof typeof dict.activity] ?? row.action}</span>

          {row.brandName && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{ background: row.accentColor ?? "var(--muted)" }}
              />
              {row.brandName}
            </span>
          )}

          <span className="tnum ms-auto text-xs text-muted">
            {formatter.format(new Date(row.createdAt))}
          </span>
        </li>
      ))}
    </ul>
  );
}
