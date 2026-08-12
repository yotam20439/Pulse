import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Assistant } from "next/font/google";

import { getLocale } from "@/lib/i18n";
import "./globals.css";

/**
 * Archivo rather than another neutral grotesk: it has a genuinely wide weight
 * range and slightly condensed proportions, so headings can run heavy and
 * tight without a second display family. In a table-dense tool that keeps the
 * font payload small while still giving the type a voice.
 */
const sans = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-latin",
  display: "swap",
});

/**
 * Inter Tight has no Hebrew glyphs, so Hebrew would fall back to whatever the
 * OS supplies — usually Arial, which breaks the typographic voice completely.
 * Assistant is a Hebrew grotesk with matching proportions, listed first in the
 * stack so Hebrew text is deliberate rather than accidental.
 */
const hebrew = Assistant({
  subsets: ["hebrew", "latin"],
  variable: "--font-sans-hebrew",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono-figures",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Pulse", template: "%s · Pulse" },
  description: "Influencer campaign tracking and analytics across brands.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${sans.variable} ${hebrew.variable} ${mono.variable}`}
      data-locale={locale}
    >
      <body>{children}</body>
    </html>
  );
}
