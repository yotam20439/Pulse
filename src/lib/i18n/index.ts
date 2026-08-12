import { cookies } from "next/headers";
import { dictionaries, type Dictionary, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "pulse_locale";
export type { Dictionary, Locale };
export { t } from "./dictionaries";

/**
 * Locale comes from a cookie rather than the URL.
 *
 * The alternative — /en/… and /he/… path prefixes — means every route, link,
 * and redirect in the app has to become locale-aware. For an internal tool
 * where a user picks their language once and keeps it, a cookie costs nothing
 * and keeps the routing flat. The trade-off is that a URL isn't shareable in a
 * specific language, which does not matter here.
 */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return value === "he" ? "he" : "en";
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()];
}

/** Number and date formatting follow the locale too, not just the strings. */
export function formatters(locale: Locale) {
  const tag = locale === "he" ? "he-IL" : "en-GB";
  return {
    compact: new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 }),
    date: new Intl.DateTimeFormat(tag, { day: "numeric", month: "short" }),
    full: new Intl.DateTimeFormat(tag, { dateStyle: "medium" }),
  };
}
