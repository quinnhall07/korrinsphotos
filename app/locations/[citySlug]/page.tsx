// app/locations/[citySlug]/page.tsx
// Per-city SEO landing page — Phase 13.7.
// Server Component. Statically generated for every CITY_SEEDS slug at build time.
//
// Sections:
//   1. Hero: "Wedding & Portrait Photography in <City>, <State>"
//   2. Popular venues grid
//   3. Best seasons + golden hour spots (two-column editorial)
//   4. Optional testimonial pull quote
//   5. FAQ accordion (native <details>)
//   6. Optional travel note (only for non-Triangle cities)
//   7. CTA section linking to /booking?sessionType=Wedding|Portrait
//
// Injects two JSON-LD blocks: LocalBusiness (city-scoped) and BreadcrumbList.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { CITY_SEEDS, findCitySeed, type CitySeed } from "@/lib/seo/cities";
import {
  buildBreadcrumbSchema,
  buildLocalBusinessSchema,
} from "@/lib/seo/schema";

interface PageProps {
  params: Promise<{ citySlug: string }>;
}

/** Pre-render every seeded city slug at build time. */
export function generateStaticParams(): { citySlug: string }[] {
  return CITY_SEEDS.map((c) => ({ citySlug: c.slug }));
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<Metadata> {
  const { citySlug } = await params;
  const seed = findCitySeed(citySlug);
  if (!seed) return { title: "Location Not Found" };

  // The first sentence of the intro is the page meta description — clean,
  // human, and never duplicated across cities because every intro is unique.
  const firstSentence = seed.intro.split(/(?<=[.!?])\s+/)[0] ?? seed.intro;

  return {
    title:       `Wedding & Portrait Photographer in ${seed.city}, ${seed.state} | Korrin's Photos`,
    description: firstSentence,
    alternates: {
      canonical: `/locations/${seed.slug}`,
    },
    openGraph: {
      title:       `Wedding & Portrait Photographer in ${seed.city}, ${seed.state}`,
      description: firstSentence,
      url:         `/locations/${seed.slug}`,
      type:        "website",
    },
  };
}

export default async function CityLocationPage({ params }: PageProps) {
  const { citySlug } = await params;
  const seed = findCitySeed(citySlug);
  if (!seed) notFound();

  // areaServed seeded with the city + region so Google understands radius.
  const localBusiness = buildLocalBusinessSchema(
    seed.slug,
    { city: seed.city, state: seed.state },
    [`${seed.city}, ${seed.state}`, `${seed.region} North Carolina`],
    seed.intro,
  );
  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home",      url: "/" },
    { name: "Locations", url: "/locations" },
    { name: seed.city,   url: `/locations/${seed.slug}` },
  ]);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd
        data={[localBusiness, breadcrumb] as unknown as Parameters<typeof JsonLd>[0]["data"]}
      />

      {/* ─── Hero ─────────────────────────────────────────────────────── */}
      <Hero seed={seed} />

      {/* ─── Popular venues ───────────────────────────────────────────── */}
      <Venues seed={seed} />

      {/* ─── Best seasons + golden hour ───────────────────────────────── */}
      <SeasonsAndLight seed={seed} />

      {/* ─── Testimonial (optional) ───────────────────────────────────── */}
      {seed.testimonialQuote ? <Testimonial seed={seed} /> : null}

      {/* ─── Travel note (optional) ───────────────────────────────────── */}
      {seed.travelNote ? <TravelNote note={seed.travelNote} /> : null}

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <Faq seed={seed} />

      {/* ─── CTA ──────────────────────────────────────────────────────── */}
      <Cta seed={seed} />

      <Footer />
    </div>
  );
}

/* ─── Section components ───────────────────────────────────────────────── */

function Hero({ seed }: { seed: CitySeed }) {
  return (
    <section
      style={{
        padding:      "5rem 4rem 4rem",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <p
        style={{
          fontSize:      "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color:         "var(--olive)",
          marginBottom:  "1.2rem",
        }}
      >
        {seed.region} · {seed.state}
      </p>
      <h1
        style={{
          fontFamily:    "'Cormorant Garamond', serif",
          fontSize:      "clamp(2.4rem, 5.5vw, 4.5rem)",
          fontWeight:    300,
          letterSpacing: "-0.01em",
          lineHeight:    1.1,
          marginBottom:  "2rem",
          maxWidth:      "900px",
        }}
      >
        Wedding &amp; Portrait Photography in <em>{seed.city}</em>, {seed.state}
      </h1>
      <p
        style={{
          fontSize:    "1.05rem",
          lineHeight:  1.75,
          color:       "var(--charcoal-light)",
          maxWidth:    "680px",
          fontWeight:  300,
        }}
      >
        {seed.intro}
      </p>
    </section>
  );
}

function Venues({ seed }: { seed: CitySeed }) {
  return (
    <section style={{ padding: "5rem 4rem", borderBottom: "0.5px solid var(--border)" }}>
      <p
        style={{
          fontSize:      "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color:         "var(--olive)",
          marginBottom:  "1rem",
        }}
      >
        Where we&apos;ll shoot
      </p>
      <h2
        style={{
          fontFamily:    "'Cormorant Garamond', serif",
          fontSize:      "clamp(1.8rem, 3.5vw, 2.6rem)",
          fontWeight:    300,
          marginBottom:  "2.5rem",
        }}
      >
        Popular {seed.city} <em>venues &amp; locations</em>
      </h2>
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap:                 "2rem",
        }}
      >
        {seed.popularVenues.map((v) => (
          <article
            key={v.name}
            style={{
              border:  "0.5px solid var(--border)",
              padding: "1.6rem",
              background: "rgba(250,249,246,0.5)",
            }}
          >
            <h3
              style={{
                fontFamily:   "'Cormorant Garamond', serif",
                fontSize:     "1.4rem",
                fontWeight:   400,
                lineHeight:   1.2,
                marginBottom: "0.4rem",
              }}
            >
              {v.name}
            </h3>
            {v.neighborhood ? (
              <p
                style={{
                  fontSize:      "0.6rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color:         "var(--charcoal-muted)",
                  marginBottom:  "0.8rem",
                }}
              >
                {v.neighborhood}
              </p>
            ) : null}
            {v.description ? (
              <p
                style={{
                  fontSize:   "0.88rem",
                  lineHeight: 1.65,
                  color:      "var(--charcoal-light)",
                  fontWeight: 300,
                }}
              >
                {v.description}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function SeasonsAndLight({ seed }: { seed: CitySeed }) {
  return (
    <section
      style={{
        padding:             "5rem 4rem",
        borderBottom:        "0.5px solid var(--border)",
        display:             "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap:                 "4rem",
      }}
    >
      <div>
        <p
          style={{
            fontSize:      "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color:         "var(--olive)",
            marginBottom:  "1rem",
          }}
        >
          When to shoot
        </p>
        <h2
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontSize:      "clamp(1.6rem, 3vw, 2.2rem)",
            fontWeight:    300,
            marginBottom:  "1.6rem",
          }}
        >
          Best <em>seasons</em>
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {seed.bestSeasons.map((s) => (
            <li
              key={s}
              style={{
                padding:      "0.9rem 0",
                borderBottom: "0.5px solid var(--border)",
                fontSize:     "0.95rem",
                lineHeight:   1.6,
                color:        "var(--charcoal-light)",
                fontWeight:   300,
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p
          style={{
            fontSize:      "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color:         "var(--olive)",
            marginBottom:  "1rem",
          }}
        >
          Where the light lives
        </p>
        <h2
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontSize:      "clamp(1.6rem, 3vw, 2.2rem)",
            fontWeight:    300,
            marginBottom:  "1.6rem",
          }}
        >
          Golden hour <em>spots</em>
        </h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {seed.goldenHourSpots.map((s) => (
            <li
              key={s}
              style={{
                padding:      "0.9rem 0",
                borderBottom: "0.5px solid var(--border)",
                fontSize:     "0.95rem",
                lineHeight:   1.6,
                color:        "var(--charcoal-light)",
                fontWeight:   300,
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Testimonial({ seed }: { seed: CitySeed }) {
  return (
    <section
      style={{
        padding:      "6rem 4rem",
        textAlign:    "center",
        borderBottom: "0.5px solid var(--border)",
        background:   "var(--olive-dim)",
      }}
    >
      <p
        style={{
          fontFamily:   "'Cormorant Garamond', serif",
          fontStyle:    "italic",
          fontSize:     "clamp(1.4rem, 2.6vw, 2rem)",
          fontWeight:   300,
          lineHeight:   1.45,
          maxWidth:     "780px",
          margin:       "0 auto 1.8rem",
          color:        "var(--charcoal)",
        }}
      >
        &ldquo;{seed.testimonialQuote}&rdquo;
      </p>
      {seed.testimonialAuthor ? (
        <p
          style={{
            fontSize:      "0.7rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color:         "var(--charcoal-muted)",
          }}
        >
          — {seed.testimonialAuthor}
        </p>
      ) : null}
    </section>
  );
}

function TravelNote({ note }: { note: string }) {
  return (
    <section
      style={{
        padding:      "3rem 4rem",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <div
        style={{
          maxWidth:     "780px",
          margin:       "0 auto",
          padding:      "1.5rem 1.8rem",
          border:       "0.5px solid var(--border-strong)",
          borderLeft:   "3px solid var(--olive)",
          background:   "rgba(250,249,246,0.6)",
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
          Travel note
        </p>
        <p
          style={{
            fontSize:   "0.95rem",
            lineHeight: 1.7,
            color:      "var(--charcoal-light)",
            fontWeight: 300,
          }}
        >
          {note}
        </p>
      </div>
    </section>
  );
}

function Faq({ seed }: { seed: CitySeed }) {
  return (
    <section style={{ padding: "5rem 4rem", borderBottom: "0.5px solid var(--border)" }}>
      <p
        style={{
          fontSize:      "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color:         "var(--olive)",
          marginBottom:  "1rem",
        }}
      >
        Asked &amp; answered
      </p>
      <h2
        style={{
          fontFamily:    "'Cormorant Garamond', serif",
          fontSize:      "clamp(1.8rem, 3.5vw, 2.6rem)",
          fontWeight:    300,
          marginBottom:  "2.5rem",
        }}
      >
        {seed.city} <em>FAQ</em>
      </h2>
      <div style={{ maxWidth: "820px" }}>
        {seed.faq.map((f, idx) => (
          <details
            key={f.q}
            style={{
              borderTop:    "0.5px solid var(--border)",
              borderBottom: idx === seed.faq.length - 1 ? "0.5px solid var(--border)" : undefined,
              padding:      "1.4rem 0",
            }}
          >
            <summary
              style={{
                cursor:        "pointer",
                fontSize:      "1rem",
                fontWeight:    400,
                color:         "var(--charcoal)",
                listStyle:     "none",
                display:       "flex",
                justifyContent:"space-between",
                alignItems:    "center",
                gap:           "1rem",
              }}
            >
              <span>{f.q}</span>
              <span
                style={{
                  fontFamily:    "'Cormorant Garamond', serif",
                  fontSize:      "1.6rem",
                  color:         "var(--olive)",
                  lineHeight:    1,
                  flexShrink:    0,
                }}
              >
                +
              </span>
            </summary>
            <p
              style={{
                marginTop:  "1rem",
                fontSize:   "0.92rem",
                lineHeight: 1.7,
                color:      "var(--charcoal-light)",
                fontWeight: 300,
              }}
            >
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Cta({ seed }: { seed: CitySeed }) {
  return (
    <section
      style={{
        padding:    "6rem 4rem",
        textAlign:  "center",
      }}
    >
      <p
        style={{
          fontSize:      "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color:         "var(--olive)",
          marginBottom:  "1.2rem",
        }}
      >
        Ready when you are
      </p>
      <h2
        style={{
          fontFamily:    "'Cormorant Garamond', serif",
          fontSize:      "clamp(2rem, 4vw, 3rem)",
          fontWeight:    300,
          marginBottom:  "2.5rem",
          maxWidth:      "640px",
          marginLeft:    "auto",
          marginRight:   "auto",
        }}
      >
        Let&apos;s plan your <em>{seed.city}</em> session.
      </h2>
      <div
        style={{
          display:        "flex",
          gap:            "1rem",
          justifyContent: "center",
          flexWrap:       "wrap",
        }}
      >
        <Link
          href="/booking?sessionType=Wedding"
          style={ctaPrimary}
        >
          Book a Wedding
        </Link>
        <Link
          href="/booking?sessionType=Portrait"
          style={ctaSecondary}
        >
          Book a Portrait
        </Link>
      </div>
    </section>
  );
}

const ctaPrimary: React.CSSProperties = {
  fontSize:       "0.72rem",
  letterSpacing:  "0.18em",
  textTransform:  "uppercase",
  color:          "var(--white)",
  background:     "var(--olive)",
  border:         "0.5px solid var(--olive)",
  padding:        "0.95rem 2.2rem",
  textDecoration: "none",
  transition:     "background 0.3s",
};

const ctaSecondary: React.CSSProperties = {
  fontSize:       "0.72rem",
  letterSpacing:  "0.18em",
  textTransform:  "uppercase",
  color:          "var(--olive)",
  background:     "transparent",
  border:         "0.5px solid var(--olive)",
  padding:        "0.95rem 2.2rem",
  textDecoration: "none",
  transition:     "background 0.3s, color 0.3s",
};
