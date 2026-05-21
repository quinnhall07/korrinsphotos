// app/[slug]/page.tsx
// Catch-all renderer for admin-created pages (Phase 2 — site editor).
//
// Resolution order:
//   1. Bail to notFound() if `slug` is in the reserved list — every existing
//      top-level route must keep working.
//   2. Bail to notFound() if `slug` is a built-in editable page (home,
//      investment, portfolio, about, footer) — those are rendered by their
//      own routes.
//   3. Read `siteContent/{slug}.publishedSections`; render via renderSections.
//      No published doc → notFound(). Draft-only docs are NEVER rendered on
//      the public site.
//
// The reserved-name guard is the single source of truth for "what slugs can
// the admin create." Keep it in sync with the top-level directories under
// app/ — anything that already maps to a route must stay off-limits.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";

export const dynamic = "force-dynamic";

// Slugs the admin can NEVER claim. Anything that maps to an existing
// app/ directory or special slot belongs here. Keep alphabetised.
const RESERVED_SLUGS = new Set<string>([
  "admin",
  "api",
  "booking",
  "c",
  "day-of-room",
  "favicon.ico",
  "gallery",
  "investment",
  "journal",
  "locations",
  "login",
  "magnet",
  "portal",
  "portfolio",
  "questionnaire",
  "r",
  "settings",
  "shop",
  "sign-contract",
  "sitemap.xml",
  "style",
  "t",
  "welcome-packet",
  // Editable built-ins handled by their own routes
  "about",
  "home",
  "footer",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (isReservedSlug(slug)) return {};
  const published = await loadPublishedSections(slug);
  if (!published) return {};
  return { title: slug.charAt(0).toUpperCase() + slug.slice(1) };
}

export default async function CustomPage({ params }: Props) {
  const { slug } = await params;
  if (isReservedSlug(slug)) notFound();
  const published = await loadPublishedSections(slug);
  if (!published) notFound();

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {renderSections(published)}
      <Footer />
    </div>
  );
}
