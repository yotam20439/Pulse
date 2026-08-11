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
import { requireUser } from "@/lib/rbac";

export const metadata = { title: "People" };

export default async function PeoplePage() {
  const me = await requireUser();

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
        <h2 className="eyebrow">Add someone</h2>
        <p className="max-w-2xl text-sm text-muted">
          There is no self-signup: an account exists only if you create it here. Send the temporary
          password over a channel you trust, and reset it if it ever goes astray.
        </p>
        <NewUserForm action={createUser} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow">People ({userRows.length})</h2>

        {userRows.map((user) => {
          const userGrants = grantsFor(user.id);
          const isMe = user.id === me.id;
          const superAdmin = user.systemRole === "SUPER_ADMIN";

          return (
            <details key={user.id} className="rounded-lg border border-line bg-surface">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <span className="font-medium">{user.name ?? user.email}</span>
                <span className="text-muted">{user.email}</span>
                {isMe && <span className="eyebrow">you</span>}

                <span className="ml-auto flex items-center gap-3">
                  {!user.isActive && <span className="text-xs text-critical">deactivated</span>}
                  <span className="eyebrow">{user.systemRole.replace("_", " ").toLowerCase()}</span>
                  <span className="tnum text-xs text-muted">
                    {superAdmin ? "all brands" : `${userGrants.length} brands`}
                  </span>
                </span>
              </summary>

              <div className="space-y-6 border-t border-line p-5">
                <div className="flex flex-wrap items-end gap-3">
                  <form action={setSystemRole} className="flex items-end gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <div>
                      <label className="eyebrow">System role</label>
                      <select
                        name="systemRole"
                        defaultValue={user.systemRole}
                        disabled={isMe}
                        className="mt-1.5 h-10 rounded-md border border-line bg-surface px-3 text-sm disabled:opacity-50"
                      >
                        <option value="STAFF">Staff</option>
                        <option value="CLIENT">Client</option>
                        <option value="SUPER_ADMIN">Super admin</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isMe}
                      className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken disabled:opacity-50"
                    >
                      Apply
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
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </form>
                </div>

                <div className="max-w-md">
                  <PasswordForm action={setPassword} userId={user.id} />
                </div>

                {/* Brand grants */}
                <div className="space-y-3 border-t border-line pt-5">
                  <p className="eyebrow">Brand access</p>

                  {superAdmin ? (
                    <p className="text-sm text-muted">
                      Super admins see every brand regardless of grants. Drop them to Staff to scope
                      access.
                    </p>
                  ) : (
                    <>
                      {userGrants.length === 0 ? (
                        <p className="text-sm text-muted">
                          No brands yet — this account can sign in but will see nothing.
                        </p>
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
                                  Revoke
                                </button>
                              </form>
                            </li>
                          ))}
                        </ul>
                      )}

                      <form action={grantBrand} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <div>
                          <label className="eyebrow">Grant brand</label>
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
                          <label className="eyebrow">Role</label>
                          <select
                            name="role"
                            defaultValue="VIEWER"
                            className="mt-1.5 h-10 rounded-md border border-line bg-surface px-3 text-sm"
                          >
                            <option value="VIEWER">Viewer — read only</option>
                            <option value="EDITOR">Editor — manage campaigns</option>
                            <option value="BRAND_ADMIN">Brand admin</option>
                          </select>
                        </div>
                        <button
                          type="submit"
                          className="h-9 rounded-md border border-line px-4 text-sm hover:bg-sunken"
                        >
                          Grant
                        </button>
                      </form>
                    </>
                  )}
                </div>

                <p className="text-xs text-muted">
                  Permission changes take up to five minutes to reach a signed-in user, or apply
                  immediately after they sign out and back in.
                </p>

                {!isMe && (
                  <div className="border-t border-line pt-4">
                    <ConfirmDelete
                      action={deleteUser}
                      confirmValue={user.email}
                      hidden={{ userId: user.id }}
                      triggerLabel="Delete permanently"
                      title={`Permanently delete ${user.email}?`}
                      consequence="Deactivating is usually better: it blocks sign-in but keeps their name on past actions in the activity log. After deletion, everything they ever did reads as an unknown actor. Campaigns and brands they own stay, with the owner field emptied."
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
