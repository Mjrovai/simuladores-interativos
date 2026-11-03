import Footer from "@/components/Footer";
import Header from "@/components/Header";
import PaletteApp from "@/components/PaletteApp";
import SeoContent from "@/components/SeoContent";
import { faqJsonLd, webApplicationJsonLd } from "@/lib/seo";

/**
 * Home page: hero (single H1), the interactive generator, static SEO content
 * + FAQ, and JSON-LD structured data (WebApplication + FAQPage).
 * Metadata itself lives in app/layout.tsx via lib/seo.ts.
 */
export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Color Palette Generator
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Create beautiful, accessible color palettes for websites, brands,
            apps, and creative projects in seconds.
          </p>
        </section>

        <div className="mt-10">
          <PaletteApp />
        </div>

        <SeoContent />
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(webApplicationJsonLd()),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
    </>
  );
}
