// app/admin/site/[pageId]/preview/page.tsx
// Admin-only preview of the current DRAFT sections.
// Uses the same renderSections dispatcher production pages use — preview matches prod.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getPageDefinition } from "@/lib/site-content/page-registry";
import { loadDraftSections, loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";
import { HOME_DEFAULTS } from "@/lib/site-content/defaults/home";
import type { Section } from "@/lib/site-content/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview · Site editor",
  robots: { index: false, follow: false },
};

const PAGE_DEFAULTS: Record<string, Section[]> = {
  home: HOME_DEFAULTS,
};

export default async function PreviewPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireAdmin();
  const { pageId } = await params;
  const def = getPageDefinition(pageId);
  if (!def) notFound();

  const draft = await loadDraftSections(pageId);
  const published = draft ? null : await loadPublishedSections(pageId);
  const sections: Section[] = draft ?? published ?? PAGE_DEFAULTS[pageId] ?? [];

  return (
    <div>
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10001,
          background: "var(--charcoal)",
          color: "var(--white)",
          padding: "0.55rem 1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          fontSize: "0.75rem",
          letterSpacing: "0.06em",
        }}
      >
        <span>
          Draft preview · <strong>{def.label}</strong> ·{" "}
          {draft ? "showing unpublished draft" : published ? "showing currently published copy" : "showing defaults"}
        </span>
        <Link href={`/admin/site/${pageId}`} style={{ color: "var(--olive-light)", textDecoration: "none" }}>
          ← Back to editor
        </Link>
      </div>
      {renderSections(sections)}
    </div>
  );
}
