// app/locations/page.tsx
// Public index of city-specific landing pages — Phase 13.7.
// Server Component. No auth, no fetches: data lives in `lib/seo/cities.ts`.
//
// Editorial 3-column responsive grid that links into each /locations/[slug].

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { CITY_SEEDS } from "@/lib/seo/cities";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";

const REGIONS = Array.from(new Set(CITY_SEEDS.map((c) => c.region))).join(", ");

export const metadata: Metadata = {
  title:       "Locations | Korrin's Photos",
  description: `Wedding and portrait photographer serving the ${REGIONS} regions of North Carolina — from Cary and Raleigh to Asheville and the coast.`,
};

export default function LocationsIndexPage() {
  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home",      url: "/" },
    { name: "Locations", url: "/locations" },
  ]);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd data={breadcrumb as unknown as Parameters<typeof JsonLd>[0]["data"]} />

      {/* Editorial header */}
      <section
        style={{
          padding:      "4rem 4rem 3rem",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: "3rem",
        }}
      >
        <p
          style={{
            fontSize:      "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color:         "var(--olive)",
            marginBottom:  "1rem",
          }}
        >
          Where I work
        </p>
        <h1
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontSize:      "clamp(2.5rem, 5vw, 4rem)",
            fontWeight:    300,
            letterSpacing: "-0.01em",
            marginBottom:  "1.5rem",
          }}
        >
          Cities I&apos;ve <em>shot in</em>
        </h1>
        <p
          style={{
            fontSize:   "1rem",
            lineHeight: 1.7,
            color:      "var(--charcoal-light)",
            maxWidth:   "640px",
            fontWeight: 300,
          }}
        >
          I&apos;m based in Cary and shoot most of my weddings and portrait work
          across the Triangle. A handful of times each year I drive west to the
          mountains or south to the coast for couples who want a wedding day
          somewhere a little wilder. Below are the places I know well enough to
          scout from memory.
        </p>
      </section>

      {/* City grid */}
      <section
        style={{
          padding:             "0 4rem 6rem",
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap:                 "2.5rem 2rem",
        }}
      >
        {CITY_SEEDS.map((c) => (
          <Link
            key={c.slug}
            href={`/locations/${c.slug}`}
            style={{
              display:        "block",
              textDecoration: "none",
              color:          "inherit",
              border:         "0.5px solid var(--border)",
              padding:        "1.8rem",
              transition:     "border-color 0.3s, background 0.3s",
              background:     "rgba(250,249,246,0.5)",
            }}
          >
            <p
              style={{
                fontSize:      "0.6rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color:         "var(--olive)",
                marginBottom:  "0.6rem",
              }}
            >
              {c.region}
            </p>
            <h2
              style={{
                fontFamily:   "'Cormorant Garamond', serif",
                fontSize:     "1.85rem",
                fontWeight:   300,
                lineHeight:   1.15,
                marginBottom: "0.4rem",
              }}
            >
              {c.city}, <em>{c.state}</em>
            </h2>
            <p
              style={{
                fontSize:      "0.7rem",
                letterSpacing: "0.06em",
                color:         "var(--charcoal-muted)",
                marginBottom:  "1rem",
              }}
            >
              {c.popularVenues.length} venues · {c.faq.length} FAQs
            </p>
            <p
              style={{
                fontSize:   "0.85rem",
                lineHeight: 1.6,
                color:      "var(--charcoal-light)",
                fontWeight: 300,
                display:    "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow:   "hidden",
              }}
            >
              {c.intro.split(". ")[0]}.
            </p>
            <p
              style={{
                marginTop:     "1.2rem",
                fontSize:      "0.65rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color:         "var(--olive)",
              }}
            >
              Read more &rarr;
            </p>
          </Link>
        ))}
      </section>

      <Footer />
    </div>
  );
}
