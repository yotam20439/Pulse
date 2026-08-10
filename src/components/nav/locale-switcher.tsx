import { setLocale } from "@/lib/i18n/actions";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Two buttons rather than a dropdown: with exactly two locales, a select is
 * one more click for no benefit, and the inactive option doubles as a label in
 * its own script — someone who can't read the current language can still find
 * their way out.
 */
export function LocaleSwitcher({ locale, tone = "light" }: { locale: Locale; tone?: "light" | "dark" }) {
  const options: { value: Locale; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "he", label: "עב" },
  ];

  return (
    <div className={cn("flex rounded-md border p-0.5", tone === "dark" ? "border-white/15" : "border-line")}>
      {options.map((option) => (
        <form key={option.value} action={setLocale}>
          <input type="hidden" name="locale" value={option.value} />
          <button
            type="submit"
            aria-current={locale === option.value ? "true" : undefined}
            className={cn(
              "h-6 rounded px-2 text-xs font-medium transition-colors",
              locale === option.value
                ? tone === "dark"
                  ? "bg-white/15 text-white"
                  : "bg-sunken text-ink"
                : tone === "dark"
                  ? "text-white/50 hover:text-white"
                  : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        </form>
      ))}
    </div>
  );
}
