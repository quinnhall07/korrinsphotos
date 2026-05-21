// app/admin/site/[pageId]/page.tsx
// Entry point from the /admin/site directory.
//
// For pages with a public URL (Home / Investment / Portfolio / About /
// custom slugs), we redirect to `<publicHref>?edit=1` — the editor now
// lives ON the public page itself. For the global Footer (which has no
// public URL of its own), this route renders a dedicated standalone
// canvas so the same SectionsCanvas chrome can edit it.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getPageDefinition } from "@/lib/site-content/page-registry";
import { getSiteContent, loadDraftSections } from "@/lib/db/site-content";
import { listSiteAssets, listProjectPhotos } from "@/lib/db/site-assets";
import { isReservedSlug } from "@/lib/site-content/slugs";
import { FOOTER_DEFAULTS } from "@/lib/site-content/defaults/footer";
import { SectionsCanvas } from "@/components/site-editor/SectionsCanvas";

export const dynamic = "force-dynamic";

export default async function SiteEditorPage({ params }: { params: Promise<{ pageId: string }> }) {
  await requireAdmin();
  const { pageId } = await params;

  // Footer gets a dedicated standalone canvas — there's no `/footer` public
  // route to redirect to.
  if (pageId === "footer") {
    return <FooterCanvas />;
  }

  // Built-in pages with a public URL: redirect to <publicHref>?edit=1.
  const def = getPageDefinition(pageId);
  if (def) {
    redirect(`${def.publicHref}?edit=1`);
  }

  // Custom admin-created pages live at `/<slug>`.
  if (isReservedSlug(pageId)) notFound();
  const doc = await getSiteContent(pageId);
  if (!doc) notFound();
  redirect(`/${pageId}?edit=1`);
}

async function FooterCanvas() {
  const draft = await loadDraftSections("footer");
  const doc = await getSiteContent("footer");
  const sections = draft ?? doc?.publishedSections ?? FOOTER_DEFAULTS;

  const [siteAssets, projectPhotos] = await Promise.all([
    listSiteAssets(),
    listProjectPhotos(),
  ]);
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
    <div style={{ margin: "-2rem", background: "var(--white)" }}>
      <div style={{ padding: "0.75rem 1.25rem", borderBottom: "0.5px solid var(--border)", fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
        <Link href="/admin/site" style={{ color: "var(--charcoal-muted)", textDecoration: "none" }}>
          ← All pages
        </Link>
        <span style={{ margin: "0 0.5rem" }}>·</span>
        Editing the global footer. Changes go live on every public page when you publish.
      </div>
      <SectionsCanvas
        pageId="footer"
        pageLabel="Footer"
        initialSections={sections}
        isAdmin
        editParam
        pickerData={pickerData}
      />
    </div>
  );
}
