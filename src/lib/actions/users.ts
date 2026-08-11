"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { hash } from "bcryptjs";

import { db } from "@/db";
import { auditLog, brandMembers, users, type BrandRole, type SystemRole } from "@/db/schema";
import { getDictionary, t } from "@/lib/i18n";
import { isSuperAdmin, requireUser } from "@/lib/rbac";

/**
 * User administration. Every action re-checks SUPER_ADMIN server-side: hiding
 * the UI is presentation, not authorisation, and a form post can arrive from
 * anywhere.
 */

async function requireAdmin() {
  const user = await requireUser();
  if (!isSuperAdmin(user)) throw new Error("Not authorised");
  return user;
}

async function record(actorId: string, action: string, entityId: string, diff?: unknown) {
  await db.insert(auditLog).values({
    actorId,
    action,
    entity: "user",
    entityId,
    diff: diff ?? null,
  });
}

export type ActionState = { error?: string; ok?: string };

export async function createUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const d = await getDictionary();
  const actor = await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const systemRole = String(formData.get("systemRole") ?? "STAFF") as SystemRole;
  const password = String(formData.get("password") ?? "");

  if (!email.includes("@")) return { error: d.errors.invalidEmail };
  if (password.length < 8) return { error: d.errors.shortPassword };

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: d.errors.emailTaken };

  const [created] = await db
    .insert(users)
    .values({ email, name: name || null, systemRole, passwordHash: await hash(password, 10) })
    .returning({ id: users.id });

  await record(actor.id, "user.create", created.id, { email, systemRole });
  revalidatePath("/settings/people");
  return { ok: t(d.ok.created, { name: email }) };
}

export async function setPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const d = await getDictionary();
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) return { error: d.errors.shortPassword };

  await db.update(users).set({ passwordHash: await hash(password, 10) }).where(eq(users.id, userId));
  // The hash is never logged — only that a reset happened.
  await record(actor.id, "user.password_reset", userId);
  revalidatePath("/settings/people");
  return { ok: d.ok.passwordUpdated };
}

export async function setActive(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const isActive = formData.get("isActive") === "true";

  // Locking yourself out is the one mistake with no in-app recovery.
  if (userId === actor.id && !isActive) return;

  await db.update(users).set({ isActive }).where(eq(users.id, userId));
  await record(actor.id, isActive ? "user.activate" : "user.deactivate", userId);
  revalidatePath("/settings/people");
}

export async function setSystemRole(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const systemRole = String(formData.get("systemRole") ?? "STAFF") as SystemRole;

  if (userId === actor.id && systemRole !== "SUPER_ADMIN") return;

  await db.update(users).set({ systemRole }).where(eq(users.id, userId));
  await record(actor.id, "user.role_change", userId, { systemRole });
  revalidatePath("/settings/people");
}

export async function grantBrand(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const brandId = String(formData.get("brandId") ?? "");
  const role = String(formData.get("role") ?? "VIEWER") as BrandRole;
  if (!userId || !brandId) return;

  await db
    .insert(brandMembers)
    .values({ userId, brandId, role, grantedById: actor.id })
    .onConflictDoUpdate({
      target: [brandMembers.userId, brandMembers.brandId],
      set: { role },
    });

  await record(actor.id, "user.brand_grant", userId, { brandId, role });
  revalidatePath("/settings/people");
}

export async function revokeBrand(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const brandId = String(formData.get("brandId") ?? "");

  await db
    .delete(brandMembers)
    .where(and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)));

  await record(actor.id, "user.brand_revoke", userId, { brandId });
  revalidatePath("/settings/people");
}

/**
 * Permanently deletes a user account. Super admins only.
 *
 * Deactivating is almost always the better answer and the UI says so: a
 * deactivated user can't sign in, but the audit trail still names them. After
 * deletion, every action they ever took reads as "unknown" — which is a real
 * loss on a tool where several people edit the same client's campaigns.
 *
 * What survives: campaigns and brands they created or owned (the owner field
 * simply empties), and audit rows (the actor becomes null). What goes: their
 * login, their brand grants, and their name against past actions.
 */
export async function deleteUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const d = await getDictionary();
  const actor = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  if (userId === actor.id) {
    return { error: d.errors.cantDeleteSelf };
  }

  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) return { error: d.errors.notFound };

  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== target.email.toLowerCase()) {
    return { error: t(d.errors.typeEmailToConfirm, { email: target.email }) };
  }

  // Never leave a system with no way in.
  if (target.systemRole === "SUPER_ADMIN") {
    const remaining = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.systemRole, "SUPER_ADMIN"), eq(users.isActive, true)));

    if (remaining.filter((u) => u.id !== userId).length === 0) {
      return { error: d.errors.lastSuperAdmin };
    }
  }

  await db.delete(users).where(eq(users.id, userId));

  await db.insert(auditLog).values({
    actorId: actor.id,
    action: "user.delete",
    entity: "user",
    entityId: userId,
    diff: { email: target.email, systemRole: target.systemRole },
  });

  revalidatePath("/settings/people");
  return { ok: t(d.ok.deleted, { name: target.email }) };
}
