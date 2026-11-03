import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Use | Color Palette Generator",
  description:
    "Terms of use for Color Palette Generator: a free tool for general creative and design use, with guidance that is not legal, brand, or accessibility advice.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          ← Back to generator
        </Link>
      </nav>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: August 30, 2026</p>

      <div className="mt-8 space-y-8 text-slate-600">
        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            General use
          </h2>
          <p className="mt-2">
            Color Palette Generator is provided for general creative and design
            use. It is a free tool meant to help you create color palettes
            quickly for websites, brands, apps, and other creative projects.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            No guarantees
          </h2>
          <p className="mt-2">
            We do not guarantee that any generated palette is suitable for every
            brand, product, accessibility requirement, or legal use case.
            Generated colors are also not guaranteed to be unique. You are
            responsible for testing your colors in your own context before
            using them in production.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Your responsibility
          </h2>
          <p className="mt-2">
            Generated palettes are not exclusive intellectual property and may
            be used in personal and commercial projects. You remain responsible
            for how you use them, including compliance with any laws,
            regulations, or brand guidelines that apply to your work.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Accessibility guidance
          </h2>
          <p className="mt-2">
            The contrast labels shown for each color are simplified,
            WCAG-inspired guidance meant as a helpful starting point. They are
            not a full accessibility audit and should be verified in your real
            layouts before shipping.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Not legal or brand advice
          </h2>
          <p className="mt-2">
            This tool and its content are not legal, branding, or design
            advice. For decisions with legal or accessibility consequences,
            consult a qualified professional.
          </p>
        </section>
      </div>
    </main>
  );
}
