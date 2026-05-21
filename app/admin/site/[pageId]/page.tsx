// app/admin/site/[pageId]/page.tsx
// Editor shell — fetches current draft + picker data on the server, hands to the client editor.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { getPageDefinition, type PageDefinition } from "@/lib/site-content/page-registry";
import { getSiteContent, loadDraftSections } from "@/lib/db/site-content";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { EditorClient } from "./EditorClient";
import { HOME_DEFAULTS } from "@/lib/site-content/defaults/home";
import { INVESTMENT_DEFAULTS } from "@/lib/site-content/defaults/investment";
import { PORTFOLIO_DEFAULTS } from "@/lib/site-content/defaults/portfolio";
import { ABOUT_DEFAULTS } from "@/lib/site-content/defaults/about";
import { FOOTER_DEFAULTS } from "@/lib/site-content/defaults/footer";
import { isReservedSlug } from "@/app/[slug]/page";
import type { Section, SectionType } from "@/lib/site-content/types";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

const PAGE_DEFAULTS: Record<string, Section[]> = {
  home: HOME_DEFAULTS,
  investment: INVESTMENT_DEFAULTS,
  portfolio: PORTFOLIO_DEFAULTS,
  about: ABOUT_DEFAULTS,
  footer: FOOTER_DEFAULTS,
};

// For admin-created custom pages we don't have a registry entry; the editor
// still needs an allowedSections list and a label. These are the defaults.
const CUSTOM_PAGE_ALLOWED_SECTIONS: readonly SectionType[] = [
  "HERO",
  "PHOTO_GRID",
  "SLIDESHOW",
  "STATS",
  "RICH_TEXT",
  "CTA_BANNER",
  "PROCESS_STEPS",
  "PACKAGE_CARDS",
  "TESTIMONIAL",
];

export default async function SiteEditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireAdmin();
  const { pageId } = await params;

  let def: PageDefinition;
  const registryEntry = getPageDefinition(pageId);
  if (registryEntry) {
    def = registryEntry;
  } else {
    // Custom page — exists in Firestore? If not, refuse.
    const doc = await getSiteContent(pageId);
    if (!doc) notFound();
    if (isReservedSlug(pageId)) notFound();
    def = {
      id: pageId,
      label: pageId.charAt(0).toUpperCase() + pageId.slice(1),
      publicHref: `/${pageId}`,
      description: "Custom page — created from the site editor.",
      allowedSections: CUSTOM_PAGE_ALLOWED_SECTIONS,
    };
  }

  const [doc, draftSections, siteAssets, projectPhotos] = await Promise.all([
    getSiteContent(pageId),
    loadDraftSections(pageId),
    listSiteAssets(),
    listProjectPhotos(),
  ]);

  const sections: Section[] = draftSections ?? doc?.publishedSections ?? PAGE_DEFAULTS[pageId] ?? [];

  const pickerData = {
    siteAssets: siteAssets.map((a) => ({
      id: a.id,
      cloudflareImageId: a.cloudflareImageId,
      label: a.label,
      altText: a.altText,
    })),
    projectPhotos: projectPhotos.map((p) => ({
      photoId: p.photoId,
      eventId: p.eventId,
      cloudflareImageId: p.cloudflareImageId,
      label: p.label,
      category: p.category,
    })),
  };

  return (
    <div>
      <header style={{ marginBottom: "1.5rem", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <Link href="/admin/site" style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", textDecoration: "none", letterSpacing: "0.12em" }}>
            ← All pages
          </Link>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, margin: "0.4rem 0 0" }}>
            {def.label}
          </h1>
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginTop: "0.3rem" }}>
            {def.description}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link
            href={`/admin/site/${pageId}/preview`}
            target="_blank"
            style={{ display: "inline-block", padding: "0.6rem 1.2rem", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", border: "0.5px solid var(--border-strong)", color: "var(--charcoal)", textDecoration: "none" }}
          >
            View draft
          </Link>
          <Link
            href={`/admin/site/${pageId}/revisions`}
            style={{ display: "inline-block", padding: "0.6rem 1.2rem", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", border: "0.5px solid var(--border)", color: "var(--charcoal-light)", textDecoration: "none" }}
          >
            Revisions
          </Link>
          <Link
            href={def.publicHref}
            target="_blank"
            style={{ display: "inline-block", padding: "0.6rem 1.2rem", fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", border: "0.5px solid var(--border)", color: "var(--charcoal-light)", textDecoration: "none" }}
          >
            View live page
          </Link>
        </div>
      </header>

      <div style={{ marginBottom: "1rem", fontSize: "0.78rem", color: "var(--charcoal-muted)", display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
        <span>
          Status:{" "}
          {doc?.draftDirty ? (
            <strong style={{ color: "var(--olive)" }}>Unpublished draft</strong>
          ) : doc?.publishedAt ? (
            <strong style={{ color: "var(--charcoal)" }}>Live</strong>
          ) : (
            <strong style={{ color: "var(--charcoal)" }}>Using defaults</strong>
          )}
        </span>
        {doc?.publishedAt && <span>Last published: {formatDateTime(doc.publishedAt)}</span>}
      </div>

      <EditorClient
        pageId={pageId}
        allowedSections={[...def.allowedSections]}
        initialSections={sections}
        pickerData={pickerData}
      />
    </div>
  );
}
