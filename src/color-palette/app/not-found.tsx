import Link from "next/link";
import { PaletteIcon } from "@/components/icons";

/**
 * 404 page. Rendered inside the root layout but without Header/Footer
 * (those live in the home page), so it brings its own minimal chrome.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-indigo-600 text-white shadow-sm">
        <PaletteIcon className="h-6 w-6" />
      </span>
      <p className="mt-6 font-display text-sm font-semibold uppercase tracking-widest text-indigo-600">
        404
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">
        Page not found
      </h1>
      <p className="mt-3 max-w-md text-slate-600">
        The page you are looking for does not exist. Try generating a fresh
        palette instead.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
      >
        Back to Color Palette Generator
      </Link>
    </main>
  );
}
