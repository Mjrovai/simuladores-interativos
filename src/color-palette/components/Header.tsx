import Link from "next/link";
import { PaletteIcon } from "@/components/icons";

/**
 * Sticky top navigation: brand mark on the left, trust microcopy on the right.
 * Purely presentational, so it stays a server component.
 */
export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-lg"
          aria-label="Color Palette Generator — home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <PaletteIcon className="h-5 w-5" />
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-ink sm:text-lg">
            Color Palette Generator
          </span>
        </Link>
        <p className="hidden text-sm text-slate-500 sm:block">
          Runs in your browser · No signup required
        </p>
      </div>
    </header>
  );
}
