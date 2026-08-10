import type { Metadata } from "next";
import { Inter_Tight, IBM_Plex_Mono, Assistant } from "next/font/google";

import { getLocale } from "@/lib/i18n";
import "./globals.css";

const sans = Inter_Tight({
  subsets: ["latin", "latin-ext"],
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
