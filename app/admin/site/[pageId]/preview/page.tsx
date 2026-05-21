// app/admin/site/[pageId]/preview/page.tsx
// Admin-only preview of the current DRAFT sections.
// Uses the same renderSections dispatcher production pages use — preview matches prod.
//
// Modes:
//   default            — normal preview with the sticky "Draft preview" bar.
//   ?frame=1           — iframe mode: no chrome, plus a small bridge script
//                        that posts SECTION_SELECTED / SECTION_HOVERED events
//                        to window.parent for the visual editor.

import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/session";
import { getPageDefinition } from "@/lib/site-content/page-registry";
import { loadDraftSections, loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";
import { HOME_DEFAULTS } from "@/lib/site-content/defaults/home";
import { INVESTMENT_DEFAULTS } from "@/lib/site-content/defaults/investment";
import { PORTFOLIO_DEFAULTS } from "@/lib/site-content/defaults/portfolio";
import { ABOUT_DEFAULTS } from "@/lib/site-content/defaults/about";
import { FOOTER_DEFAULTS } from "@/lib/site-content/defaults/footer";
import type { Section } from "@/lib/site-content/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft preview · Site editor",
  robots: { index: false, follow: false },
};

const PAGE_DEFAULTS: Record<string, Section[]> = {
  home: HOME_DEFAULTS,
  investment: INVESTMENT_DEFAULTS,
  portfolio: PORTFOLIO_DEFAULTS,
  about: ABOUT_DEFAULTS,
  footer: FOOTER_DEFAULTS,
};

// Bridge script (rendered when ?frame=1). Listens for clicks on any element
// with [data-section-id], walks up if needed, highlights the hovered/selected
// section, and posts messages to the parent window so the editor's right
// panel can sync its form to the clicked section.
const BRIDGE_SCRIPT = `
(function(){
  var SEL_OUTLINE = '2px solid var(--olive)';
  var HOVER_OUTLINE = '2px dashed var(--olive)';
  var current = null;
  function findSection(el){
    while (el && el !== document.body) {
      if (el.dataset && el.dataset.sectionId) return el;
      el = el.parentElement;
    }
    return null;
  }
  function clearHover(el){
    if (el && el !== current) el.style.outline = '';
  }
  function markSelected(el){
    if (current && current !== el) current.style.outline = '';
    current = el;
    if (current) current.style.outline = SEL_OUTLINE;
  }
  document.addEventListener('click', function(e){
    var sec = findSection(e.target);
    if (!sec) return;
    e.preventDefault();
    e.stopPropagation();
    markSelected(sec);
    window.parent.postMessage({
      type: 'SECTION_SELECTED',
      id: sec.dataset.sectionId,
      sectionType: sec.dataset.sectionType,
    }, '*');
  }, true);
  document.addEventListener('mouseover', function(e){
    var sec = findSection(e.target);
    if (!sec || sec === current) return;
    sec.style.outline = HOVER_OUTLINE;
    sec.style.outlineOffset = '-2px';
  });
  document.addEventListener('mouseout', function(e){
    var sec = findSection(e.target);
    if (sec && sec !== current) clearHover(sec);
  });
  // Disable internal navigation in iframe mode — clicking a link in a section
  // should NEVER navigate the iframe away from the preview.
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if (a) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // Listen for parent → frame selection sync.
  window.addEventListener('message', function(ev){
    if (!ev.data || ev.data.type !== 'SET_SELECTED') return;
    var id = ev.data.id;
    if (!id) { if (current) current.style.outline = ''; current = null; return; }
    var el = document.querySelector('[data-section-id="' + id.replace(/"/g, '\\\\"') + '"]');
    if (el) markSelected(el);
  });
  // Tell the parent we're ready.
  window.parent.postMessage({ type: 'FRAME_READY' }, '*');
})();
`;

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ pageId: string }>;
  searchParams: Promise<{ frame?: string }>;
}) {
  await requireAdmin();
  const { pageId } = await params;
  const { frame } = await searchParams;
  const def = getPageDefinition(pageId);
  if (!def) notFound();

  const draft = await loadDraftSections(pageId);
  const published = draft ? null : await loadPublishedSections(pageId);
  const sections: Section[] = draft ?? published ?? PAGE_DEFAULTS[pageId] ?? [];

  const isFrame = frame === "1";

  if (isFrame) {
    return (
      <div data-editor-frame>
        {renderSections(sections)}
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: BRIDGE_SCRIPT }} />
      </div>
    );
  }

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
