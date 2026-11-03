import { FAQ_ITEMS } from "@/lib/seo";

/**
 * Static SEO content below the tool: how-to steps, why palettes matter,
 * accessibility tips, and the FAQ (mirrored as JSON-LD on the home page).
 * Server component — no interactivity needed.
 */
export default function SeoContent() {
  return (
    <div className="mx-auto mt-20 max-w-3xl space-y-14">
      <section aria-labelledby="howto-heading">
        <h2
          id="howto-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          How to use this color palette generator
        </h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-600 marker:font-semibold marker:text-indigo-600">
          <li>
            Start with a random palette, or enter a seed color using the HEX
            field or the color picker.
          </li>
          <li>
            Choose a harmony mode — monochromatic, analogous, complementary,
            triadic, tetradic, pastel, vibrant, or dark.
          </li>
          <li>Lock the colors you like so they stay put.</li>
          <li>Regenerate to remix only the unlocked colors.</li>
          <li>Copy HEX, RGB, HSL, CSS variables, or Tailwind values.</li>
          <li>Save your palette or share it with a link.</li>
        </ol>
      </section>

      <section aria-labelledby="why-heading">
        <h2
          id="why-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          Why color palettes matter
        </h2>
        <p className="mt-4 text-slate-600">
          Consistent colors make products feel more recognizable, polished, and
          easier to use. A well-chosen palette carries your brand across
          screens and media, guides user attention to what matters, and removes
          friction from every design decision that follows.
        </p>
        <p className="mt-3 text-slate-600">
          Starting from a color-theory harmony — instead of picking colors one
          by one — gives you a balanced base you can refine, which is why
          designers reach for palette tools early in every project.
        </p>
      </section>

      <section aria-labelledby="tips-heading">
        <h2
          id="tips-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          Tips for choosing accessible colors
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-600 marker:text-indigo-600">
          <li>Test text against every background you plan to use, not just the swatch.</li>
          <li>Use high-contrast pairs (4.5:1 or better) for body text.</li>
          <li>Reserve low-contrast colors for decoration, illustration, or accents.</li>
          <li>Check colors in the actual design context — real layouts, real content.</li>
          <li>
            This tool gives guidance, but you should still test your final
            design before shipping.
          </li>
        </ul>
      </section>

      <section aria-labelledby="faq-heading">
        <h2
          id="faq-heading"
          className="font-display text-2xl font-semibold tracking-tight text-ink"
        >
          Frequently asked questions
        </h2>
        <div className="mt-4 space-y-2">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <summary className="cursor-pointer list-none text-sm font-semibold text-ink">
                {item.q}
                <span
                  aria-hidden="true"
                  className="ml-2 inline-block text-slate-400 transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
