import { asc, eq } from "drizzle-orm";

import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { NewUserForm, PasswordForm } from "@/components/forms/entity-forms";
import { db } from "@/db";
import { brandMembers, brands, users } from "@/db/schema";
import {
  createUser,
  deleteUser,
  grantBrand,
  revokeBrand,
  setActive,
  setPassword,
  setSystemRole,
} from "@/lib/actions/users";
import { getDictionary } from "@/lib/i18n";
import { t } from "@/lib/i18n/dictionaries";
import { requireUser } from "@/lib/rbac";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const [me, dict] = await Promise.all([requireUser(), getDictionary()]);

  const [userRows, brandRows, grants] = await Promise.all([
    db.select().from(users).orderBy(asc(users.email)),
    db.select({ id: brands.id, name: brands.name, accentColor: brands.accentColor }).from(brands).orderBy(asc(brands.name)),
    db
      .select({
        userId: brandMembers.userId,
        brandId: brandMembers.brandId,
        role: brandMembers.role,
        brandName: brands.name,
        accentColor: brands.accentColor,
      })
      .from(brandMembers)
      .innerJoin(brands, eq(brandMembers.brandId, brands.id)),
  ]);

  const grantsFor = (userId: string) => grants.filter((g) => g.userId === userId);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="eyebrow">{dict.people.addSomeone}</h2>
        <p className="max-w-2xl text-sm text-muted">{dict.people.addHint}</p>
        <NewUserForm action={createUser} dict={dict} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">
          {dict.nav.people} ({userRows.length})
        </h2>

        {userRows.map((user) => {
          const userGrants = grantsFor(user.id);
          const isMe = user.id === me.id;
          const superAdmin = user.systemRole === "SUPER_ADMIN";

          return (
            <details key={user.id} className="rounded-lg border border-line bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <span className="font-medium">{user.name ?? user.email}</span>
                <span className="text-muted">{user.email}</span>
                {isMe && <span className="eyebrow">{dict.people.you}</span>}

                <span className="ml-auto flex items-center gap-3">
                  {!user.isActive && <span className="text-xs text-critical">{dict.people.deactivated}</span>}
                  <span className="eyebrow">{user.systemRole.replace("_", " ").toLowerCase()}</span>
                  <span className="tnum text-xs text-muted">
                    {superAdmin ? dict.people.allBrands : t(dict.people.brandsCount, { n: userGrants.length })}
                  </span>
                </span>
              </summary>

              <div className="space-y-6 border-t border-line p-5">
                <div className="flex flex-wrap items-end gap-3">
                  <form action={setSystemRole} className="flex items-end gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <div>
                      <label className="eyebrow">{dict.people.systemRole}</label>
                      <select
                        name="systemRole"
                        defaultValue={user.systemRole}
                        disabled={isMe}
                        className="mt-1.5 h-10 rounded-md border border-line bg-surface px-3 text-sm disabled:opacity-50"
                      >
                        <option value="STAFF">{dict.people.staff}</option>
                        <option value="CLIENT">{dict.people.client}</option>
                        <option value="SUPER_ADMIN">{dict.people.superAdmin}</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isMe}
                      className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken disabled:opacity-50"
                    >
                      {dict.people.apply}
                    </button>
                  </form>

                  <form action={setActive}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="isActive" value={String(!user.isActive)} />
                    <button
                      type="submit"
                      disabled={isMe}
                      className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken disabled:opacity-50"
                    >
                      {user.isActive ? dict.people.deactivate : dict.people.reactivate}
                    </button>
                  </form>
                </div>

                <div className="max-w-md">
                  <PasswordForm action={setPassword} userId={user.id} dict={dict} />
                </div>

                {/* Brand grants */}
                <div className="space-y-3 border-t border-line pt-5">
                  <p className="eyebrow">{dict.people.brandAccess}</p>

                  {superAdmin ? (
                    <p className="text-sm text-muted">{dict.people.superAdminNote}</p>
                  ) : (
                    <>
                      {userGrants.length === 0 ? (
                        <p className="text-sm text-muted">{dict.people.noGrants}</p>
                      ) : (
                        <ul className="space-y-2">
                          {userGrants.map((grant) => (
                            <li
                              key={grant.brandId}
                              className="flex items-center gap-3 rounded-md border border-line px-3 py-2 text-sm"
                            >
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{ background: grant.accentColor }}
                              />
                              <span>{grant.brandName}</span>
                              <span className="eyebrow ml-auto">{grant.role.toLowerCase()}</span>
                              <form action={revokeBrand}>
                                <input type="hidden" name="userId" value={user.id} />
                                <input type="hidden" name="brandId" value={grant.brandId} />
                                <button
                                  type="submit"
                                  className="text-xs text-critical hover:underline"
                                >
                                  {dict.people.revoke}
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form action={grantBrand} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div>
                          <label className="eyebrow">{dict.people.grantBrand}</label>
                          <select
                            name="brandId"
                            className="mt-1.5 h-10 rounded-md border border-line bg-surface px-3 text-sm"
                          >
                            {brandRows.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="eyebrow">{dict.campaign.status}</label>
                          <select
                            name="role"
                            defaultValue="VIEWER"
                            className="mt-1.5 h-10 rounded-md border border-line bg-surface px-3 text-sm"
                          >
                            <option value="VIEWER">{dict.people.roleViewer}</option>
                            <option value="EDITOR">{dict.people.roleEditor}</option>
                            <option value="BRAND_ADMIN">{dict.people.roleBrandAdmin}</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken"
                        >
                          {dict.people.grant}
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted">{dict.people.ttlNote}</p>

                {!isMe && (
                  <div className="border-t border-line pt-4">
                    <ConfirmDelete
                      action={deleteUser}
                      confirmValue={user.email}
                      hidden={{ userId: user.id }}
                      dict={dict}
                      triggerLabel={dict.danger.deleteUser}
                      title={t(dict.danger.deleteUserTitle, { name: user.email })}
                      consequence={dict.danger.deleteUserWhat}
                    />
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}
