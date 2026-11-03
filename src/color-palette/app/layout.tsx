import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import { homeMetadata } from "@/lib/seo";
import "./globals.css";

/**
 * Inter is the body face; Space Grotesk is the display face used for
 * headings, the brand mark, and color values. Both are self-hosted
 * variable WOFF2 files in app/fonts (latin subset) via next/font/local,
 * so the build requires no network access and the runtime has no layout
 * shift. CSS variables are consumed in app/globals.css.
 */
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  variable: "--font-inter",
  weight: "variable",
});

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-grotesk",
  weight: "variable",
});

/**
 * Root metadata: title, description, canonical, Open Graph, and Twitter
 * card, sourced from lib/seo.ts (single source of truth). Sub-pages
 * (privacy, terms) override title/description/canonical via their own
 * `metadata` exports.
 */
export const metadata: Metadata = homeMetadata();

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-surface text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
