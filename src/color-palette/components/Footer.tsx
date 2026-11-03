import Link from "next/link";
import { PaletteIcon } from "@/components/icons";
import { SITE } from "@/lib/seo";

/**
 * Site footer: brand + trust microcopy, legal links, and the "coming soon"
 * monetization note from the spec. Static content, so a server component.
 */
export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-md space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">
                <PaletteIcon className="h-4 w-4" />
              </span>
              <span className="font-display text-sm font-semibold text-ink">
                {SITE.name}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Runs in your browser. No signup required. Saved palettes stay on
              this device.
            </p>
            <p className="text-xs text-slate-400">
              Coming soon: Pro exports and brand kits.
            </p>
          </div>
          <nav aria-label="Footer" className="text-sm">
            <p className="font-semibold text-ink">Pages</p>
            <ul className="mt-2 space-y-1.5 text-slate-500">
              <li>
                <Link href="/" className="transition-colors hover:text-ink hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-ink hover:underline">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-ink hover:underline">
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.name}. Free to use, no account
            required.
          </p>
          <p>Accessibility guidance is a helpful starting point, not a full audit.</p>
        </div>
      </div>
    </footer>
  );
}
