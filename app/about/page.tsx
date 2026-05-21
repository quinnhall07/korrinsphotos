// app/about/page.tsx
// Public About page. Edited via /admin/site/about; falls back to
// ABOUT_DEFAULTS when no draft has been published.
//
// This route exists so /about is reserved in the catch-all and has a stable
// SEO surface. The body itself is 100% CMS-driven.

import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";
import { ABOUT_DEFAULTS } from "@/lib/site-content/defaults/about";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "About Korrin — photographer based in Louisville, KY, relocating to Tuscaloosa, AL for Fall 2026.",
};

export default async function AboutPage() {
  const published = await loadPublishedSections("about").catch(() => null);
  const sections = published && published.length > 0 ? published : ABOUT_DEFAULTS;

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {renderSections(sections)}
      <Footer />
    </div>
  );
}
