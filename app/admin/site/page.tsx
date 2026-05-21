// app/admin/site/page.tsx
// Index of editable site pages. Shows last-published timestamp + draft-dirty pill.
// Lists both registry-defined built-ins (Home / Investment / Portfolio / About / Footer)
// and admin-created custom pages stored under siteContent/{slug}.
//
// "Edit on site" deep-links each row into its public URL with `?edit=1` so
// editing happens on the live page itself (no admin shell wrapping the
// canvas). The Footer is the lone exception — it has no public URL of its
// own, so it gets a dedicated standalone canvas at /admin/site/footer.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { SITE_PAGES } from "@/lib/site-content/page-registry";
import { getSiteContent, siteContentCol } from "@/lib/db/site-content";
import { formatDateTime } from "@/lib/date";
import { NewPageButton } from "./NewPageButton";
import { DeleteCustomPageButton } from "./DeleteCustomPageButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Site editor · Admin" };

function editHrefFor(pageId: string, publicHref: string, custom: boolean): string {
  if (pageId === "footer") return "/admin/site/footer";
  if (custom) return `/${pageId}?edit=1`;
  return `${publicHref}?edit=1`;
}

export default async function SiteEditorIndexPage() {
  await requireAdmin();

  const builtInIds = new Set(SITE_PAGES.map((p) => p.id));
  const allDocsSnap = await siteContentCol().get();

  const builtInRows = await Promise.all(
    SITE_PAGES.map(async (p) => {
      const doc = await getSiteContent(p.id);
      return {
        ...p,
        custom: false,
        draftDirty: doc?.draftDirty ?? false,
        publishedAt: doc?.publishedAt ?? null,
        published: Array.isArray(doc?.publishedSections) && doc!.publishedSections.length > 0,
      };
    })
  );

  const customRows = allDocsSnap.docs
    .filter((d) => !builtInIds.has(d.id))
    .map((d) => {
      const data = d.data();
      return {
        id: d.id,
        label: d.id.charAt(0).toUpperCase() + d.id.slice(1),
        publicHref: `/${d.id}`,
        description: "Custom page — created from the site editor.",
        allowedSections: [],
        custom: true,
        draftDirty: data?.draftDirty ?? false,
        publishedAt: data?.publishedAt ?? null,
        published: Array.isArray(data?.publishedSections) && data.publishedSections.length > 0,
      };
    });

  const rows = [...builtInRows, ...customRows];

  return (
    <div>
      <header style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, margin: 0 }}>
            Site editor
          </h1>
          <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)", marginTop: "0.4rem", maxWidth: "44rem" }}>
            Edit the text and photos on each public page. Clicking <strong>Edit on site</strong> opens the live page in editing mode — what you see is what visitors see. Changes are saved as a draft and only go live when you press Publish. Every publish creates a revision you can roll back to.
          </p>
        </div>
        <NewPageButton />
      </header>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1.4fr 0.9fr",
            padding: "0.75rem 1rem",
            borderBottom: "0.5px solid var(--border)",
            fontSize: "0.65rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
          }}
        >
          <span>Page</span>
          <span>Status</span>
          <span>Last published</span>
          <span />
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1.4fr 0.9fr",
              alignItems: "center",
              padding: "0.85rem 1rem",
              borderBottom: "0.5px solid var(--border)",
              gap: "0.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", color: "var(--charcoal)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {r.label}
                {r.custom && (
                  <span style={{ fontSize: "0.6rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--olive)", border: "0.5px solid var(--olive)", padding: "0.1rem 0.4rem" }}>
                    Custom
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginTop: "0.2rem" }}>{r.description}</div>
              {r.id !== "footer" && (
                <Link href={r.publicHref} style={{ fontSize: "0.7rem", color: "var(--olive)", textDecoration: "none", marginTop: "0.2rem", display: "inline-block" }}>
                  {r.publicHref} ↗
                </Link>
              )}
            </div>
            <div>
              {r.draftDirty ? (
                <span style={{ display: "inline-block", padding: "0.2rem 0.55rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--white)", background: "var(--olive)" }}>
                  Unpublished draft
                </span>
              ) : r.published ? (
                <span style={{ display: "inline-block", padding: "0.2rem 0.55rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-light)", border: "0.5px solid var(--border)" }}>
                  Live
                </span>
              ) : (
                <span style={{ display: "inline-block", padding: "0.2rem 0.55rem", fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)", border: "0.5px solid var(--border)" }}>
                  Using defaults
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--charcoal-light)" }}>
              {r.publishedAt ? formatDateTime(r.publishedAt) : "—"}
            </div>
            <div style={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
              {r.custom && <DeleteCustomPageButton slug={r.id} label={r.label} />}
              <Link
                href={editHrefFor(r.id, r.publicHref, r.custom)}
                style={{
                  display: "inline-block",
                  padding: "0.55rem 1rem",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "var(--charcoal)",
                  color: "var(--white)",
                  textDecoration: "none",
                }}
              >
                Edit on site
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
