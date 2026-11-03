/**
 * SEO metadata and structured data (JSON-LD).
 *
 * `SITE.url` is a placeholder — replace it with your production domain before
 * deploying so canonical / Open Graph links resolve to the live site.
 */

import type { Metadata } from "next";

export const SITE = {
  name: "Color Palette Generator",
  // TODO: replace with the production domain before launch.
  url: "https://mjrovai.github.io/simuladores-interativos/apps/color-palette",
  title: "Color Palette Generator | Create Beautiful Color Schemes",
  description:
    "Generate beautiful color palettes for websites, brands, apps, and creative projects. Copy HEX, RGB, HSL, CSS variables, Tailwind config, and more.",
  ogImage: "/og-image.svg",
} as const;

/** Full metadata for the home page. */
export function homeMetadata(): Metadata {
  const url = SITE.url;
  const ogImage = `${url}${SITE.ogImage}`;
  return {
    metadataBase: new URL(url),
    title: SITE.title,
    description: SITE.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE.name,
      title: SITE.title,
      description: SITE.description,
      images: [
        { url: ogImage, width: 1200, height: 630, alt: SITE.name },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE.title,
      description: SITE.description,
      images: [ogImage],
    },
  };
}

/** Lightweight metadata for sub-pages (privacy, terms). */
export function pageMetadata(page: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = `${SITE.url}${page.path}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { url, title: page.title, description: page.description },
  };
}

/** WebApplication structured data. */
export function webApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    url: SITE.url,
    description: SITE.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

/** Single source of truth for the FAQ (rendered content + JSON-LD). */
export const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "What is a color palette generator?",
    a: "A color palette generator creates coordinated sets of colors you can use for websites, brands, apps, and designs. This tool generates palettes locally in your browser using color-theory harmony modes, so you get a strong starting point in seconds without signing up.",
  },
  {
    q: "Can I use these palettes for commercial projects?",
    a: "Yes. Generated palettes are free to use in personal and commercial projects. Because the colors are generated algorithmically, they are not exclusive intellectual property.",
  },
  {
    q: "Are the generated palettes accessible?",
    a: "Each color shows a simplified contrast check against black and white text with a WCAG-inspired label. This is a helpful starting point, not a full accessibility audit — always test your final colors in the real design context.",
  },
  {
    q: "What color formats does this tool support?",
    a: "HEX, RGB, and HSL values for every color, plus exports as CSS variables, a Tailwind config snippet, JSON, and a downloadable SVG swatch strip.",
  },
  {
    q: "Can I save my palettes?",
    a: "Yes. Saved palettes are stored in your browser's localStorage on this device only, with no account required. You can load or delete them anytime; clearing browser data will remove them.",
  },
  {
    q: "Can I use this with Tailwind CSS?",
    a: "Absolutely. Use the Tailwind tab in the export panel to copy a ready-to-paste theme.extend.colors snippet, then reference the colors as palette-1 through palette-5.",
  },
  {
    q: "Does this tool store my palettes online?",
    a: "No. Everything runs in your browser. Saved palettes live in localStorage, and shared palette links simply encode the color values in the URL — nothing is sent to a server.",
  },
  {
    q: "How many colors are in each palette?",
    a: "Each palette contains five colors, a practical size for most UI and branding work. A future Pro version may offer more palette sizes and brand-kit exports.",
  },
];

/** FAQ structured data. */
export function faqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
