// app/page.tsx
// Home page — renders blocks from siteContent/home if an admin has published.
// Falls back to HOME_DEFAULTS (the frozen original copy) when no published doc exists.

import { Footer } from "@/components/Footer";
import { loadPublishedSections } from "@/lib/db/site-content";
import { renderSections } from "@/lib/site-content/render";
import { HOME_DEFAULTS } from "@/lib/site-content/defaults/home";

export const revalidate = 3600;

export default async function HomePage() {
  let sections;
  try {
    sections = (await loadPublishedSections("home")) ?? HOME_DEFAULTS;
  } catch {
    sections = HOME_DEFAULTS;
  }

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {renderSections(sections)}
      <StatsStrip />
      <Footer />
    </div>
  );
}

// Static for now; promote to a STATS block in Phase B if the numbers need to be editable.
function StatsStrip() {
  return (
    <section style={{ padding: "0 4rem 5rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          borderTop: "0.5px solid var(--border)",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        {[
          { number: "340+", label: "Sessions Completed" },
          { number: "12", label: "Years of Experience" },
          { number: "98%", label: "Client Satisfaction" },
        ].map(({ number, label }, i) => (
          <div
            key={label}
            style={{
              padding: "3rem 2rem",
              borderRight: i < 2 ? "0.5px solid var(--border)" : undefined,
            }}
          >
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "3.5rem", fontWeight: 300, lineHeight: 1, marginBottom: "0.5rem" }}>
              {number}
            </div>
            <div style={{ fontSize: "0.7rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--charcoal-muted)" }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
