// components/Footer.tsx
// Reusable footer. Used on public-facing pages.
//
// CMS-aware: if an admin has published a `siteContent/footer` doc, the
// rendered blocks replace the hardcoded layout below. Async server
// component — safe because every consumer awaits it (or renders inside an
// async server boundary). No-op fallback on Firestore failure keeps the
// page legible during local dev without env vars.

import Link from "next/link";
import { cache } from "react";
import { loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";

// `cache()` dedupes the Firestore read across multiple `<Footer />` calls in
// the same request — important because every public page renders the footer
// once, and any other CMS-driven page reads `siteContent/footer` on its own
// render path.
const loadFooterSectionsCached = cache(async () => {
  return loadPublishedSections("footer").catch(() => null);
});

export async function Footer() {
  const published = await loadFooterSectionsCached();
  if (published && published.length > 0) {
    return (
      <footer style={{ borderTop: "0.5px solid var(--border)" }}>
        {renderSections(published)}
      </footer>
    );
  }
  return (
    <footer
      style={{
        borderTop: "0.5px solid var(--border)",
        padding: "3rem 4rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.1rem",
          fontWeight: 500,
          color: "var(--charcoal)",
          letterSpacing: "0.03em",
        }}
      >
        Korrin&apos;s Photography<span style={{ color: "var(--olive)" }}>.</span>
      </div>

      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          letterSpacing: "0.06em",
        }}
      >
        © {new Date().getFullYear()} &nbsp;Korrin&apos;s Photography. All rights reserved.
      </div>

      <ul style={{ display: "flex", gap: "2rem", listStyle: "none" }}>
        {[
          { label: "Portfolio", href: "/portfolio" },
          { label: "Booking", href: "/booking" },
          { label: "Login", href: "/login" },
        ].map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                textDecoration: "none",
                transition: "color 0.2s",
              }}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}
