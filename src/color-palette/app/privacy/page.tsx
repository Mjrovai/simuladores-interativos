import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy | Color Palette Generator",
  description:
    "How Color Palette Generator handles your data: palette generation runs entirely in your browser and saved palettes stay on your device.",
  path: "/privacy",
});

export default function PrivacyPage() {
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
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-slate-400">Last updated: August 30, 2026</p>

      <div className="mt-8 space-y-8 text-slate-600">
        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            No account, no personal information
          </h2>
          <p className="mt-2">
            Color Palette Generator does not require an account and never asks
            you to submit personal information. Palette generation happens
            entirely in your browser, on your device. There is no backend, no
            database, and no server-side processing of your inputs.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Saved palettes stay on your device
          </h2>
          <p className="mt-2">
            When you save a palette, it is stored in your browser&apos;s
            localStorage on the device you are using. It is never uploaded to
            any server. Clearing your browser data (cookies, cache, and site
            data) may remove your saved palettes.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Shared palette links
          </h2>
          <p className="mt-2">
            When you share a palette, the color values are encoded directly in
            the URL, for example{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-ink">
              /?palette=264653,2A9D8F,E9C46A,F4A261,E76F51
            </code>
            . Nothing is sent to a server when you create or open one of these
            links. If palette naming is ever added, please do not put sensitive
            information into palette names, since names may appear in shared
            URLs.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold text-ink">
            Analytics and future changes
          </h2>
          <p className="mt-2">
            This site currently does not use third-party analytics or
            advertising trackers. If analytics are added in the future, we will
            disclose them here before launch.
          </p>
        </section>
      </div>
    </main>
  );
}
