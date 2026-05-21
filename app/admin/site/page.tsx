// app/admin/site/page.tsx
// Index of editable site pages. Shows last-published timestamp + draft-dirty pill.

import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { SITE_PAGES } from "@/lib/site-content/page-registry";
import { getSiteContent } from "@/lib/db/site-content";
import { formatDateTime } from "@/lib/date";

export const dynamic = "force-dynamic";

export const metadata = { title: "Site editor · Admin" };

export default async function SiteEditorIndexPage() {
  await requireAdmin();

  const rows = await Promise.all(
    SITE_PAGES.map(async (p) => {
      const doc = await getSiteContent(p.id);
      return {
        ...p,
        draftDirty: doc?.draftDirty ?? false,
        publishedAt: doc?.publishedAt ?? null,
        published: Array.isArray(doc?.publishedSections) && doc!.publishedSections.length > 0,
      };
    })
  );

  return (
    <div>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "2rem", fontWeight: 300, margin: 0 }}>
          Site editor
        </h1>
        <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)", marginTop: "0.4rem", maxWidth: "44rem" }}>
          Edit the text and photos on each public page. Changes are saved as a draft and only go live when you press Publish. Every publish creates a revision you can roll back to.
        </p>
      </header>

      <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1.4fr 0.6fr",
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
              gridTemplateColumns: "1.4fr 1fr 1.4fr 0.6fr",
              alignItems: "center",
              padding: "0.85rem 1rem",
              borderBottom: "0.5px solid var(--border)",
              gap: "0.5rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.95rem", color: "var(--charcoal)" }}>{r.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginTop: "0.2rem" }}>{r.description}</div>
              <Link href={r.publicHref} style={{ fontSize: "0.7rem", color: "var(--olive)", textDecoration: "none", marginTop: "0.2rem", display: "inline-block" }}>
                {r.publicHref} ↗
              </Link>
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
            <div style={{ textAlign: "right" }}>
              <Link
                href={`/admin/site/${r.id}`}
                style={{
                  display: "inline-block",
                  padding: "0.55rem 1.2rem",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  background: "var(--charcoal)",
                  color: "var(--white)",
                  textDecoration: "none",
                }}
              >
                Edit
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
