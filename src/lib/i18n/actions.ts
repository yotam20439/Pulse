"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALE_COOKIE } from "./index";

export async function setLocale(formData: FormData) {
  const locale = String(formData.get("locale") ?? "en") === "he" ? "he" : "en";
  (await cookies()).set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
