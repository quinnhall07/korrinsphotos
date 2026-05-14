// app/investment/page.tsx
// Public Investment page (Phase 2.3 + Phase 13.14 hybrid).
// Server Component, no auth. Editorial process + investment hybrid layout.
//
// Sections:
//   1. Editorial header
//   2. Four-step process (Inquire → Consult → Shoot → Receive your gallery)
//   3. Three package cards (driven by INVESTMENT_PACKAGES)
//   4. Single testimonial pull-quote (placeholder until reviews import)
//   5. Footer CTA → /booking
//
// Each package emits Service JSON-LD; the page emits a BreadcrumbList.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import {
  buildBreadcrumbSchema,
  buildServiceSchema,
} from "@/lib/seo/schema";
import { INVESTMENT_PACKAGES } from "./packages";

export const metadata: Metadata = {
  title: "Investment | Korrin's Photos",
  description:
    "Investment guide for Korrin's Photography — portrait, engagement, and wedding packages. A long-term decision in light, intention, and craft.",
};

/* ─── Static page data ────────────────────────────────────────────────── */

const PROCESS_STEPS: { n: string; title: string; body: string }[] = [
  {
    n:     "01",
    title: "Inquire",
    body:
      "Share a few details about your vision — the season, the people, the feeling you want to remember. I read every inquiry myself and respond within 48 hours.",
  },
  {
    n:     "02",
    title: "Consult",
    body:
      "We meet for a relaxed call to walk through locations, timeline, wardrobe, and the small details that make a session feel like yours. This is where the shoot begins.",
  },
  {
    n:     "03",
    title: "Shoot",
    body:
      "On the day, my job is to make the camera disappear. We move with the light, follow the moments as they come, and trust that the in-between frames are often the best ones.",
  },
  {
    n:     "04",
    title: "Receive your gallery",
    body:
      "A private online gallery arrives within four weeks, with a sneak peek inside one. High-resolution downloads, print release, and an archive that lives for a full year.",
  },
];

/** USD price formatter — no decimals (e.g. $450, $1,250, $3,500). */
function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function InvestmentPage() {
  // JSON-LD: one Service per package + a breadcrumb for the page itself.
  // buildServiceSchema accepts a category slug; the package sessionType maps
  // cleanly onto the recognised slugs (Portrait/Engagement/Wedding/etc).
  const jsonLd = [
    buildBreadcrumbSchema([
      { name: "Home",       url: "/" },
      { name: "Investment", url: "/investment" },
    ]),
    ...INVESTMENT_PACKAGES.map((p) =>
      buildServiceSchema(p.sessionType.toLowerCase()),
    ),
  ];

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* JsonLd's `data` is typed against a generic recursive JSON shape;
          the schema builders return narrowly-typed schema.org objects, so
          we widen at the boundary rather than complicate the helpers. */}
      <JsonLd data={jsonLd as unknown as Parameters<typeof JsonLd>[0]["data"]} />

      {/* ───── 1. Editorial header ───── */}
      <section
        style={{
          padding: "6rem 4rem 4rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "1.25rem",
          }}
        >
          Process &amp; Pricing
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(3rem, 7vw, 5.5rem)",
            fontWeight: 300,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            marginBottom: "1.75rem",
            color: "var(--charcoal)",
          }}
        >
          Investment <em>in light</em>
        </h1>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "1.05rem",
            fontWeight: 300,
            lineHeight: 1.85,
            color: "var(--charcoal-light)",
            maxWidth: "42rem",
          }}
        >
          A session is a long-term decision — a quiet archive of who you were,
          kept for the people who will care most. Every package below is a
          starting point; the rest, we shape together.
        </p>
      </section>

      {/* ───── 2. Process (4 steps) ───── */}
      <section style={{ padding: "6rem 4rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--olive)",
              fontWeight: 400,
              whiteSpace: "nowrap",
            }}
          >
            The Process
          </span>
          <div
            style={{ flex: 1, height: "0.5px", background: "var(--border)" }}
          />
        </div>

        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
              fontWeight: 300,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "var(--charcoal)",
            }}
          >
            From first message to <em>final frame</em>
          </h2>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              marginTop: "1.5rem",
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.85,
              color: "var(--charcoal-light)",
            }}
          >
            Four steps, unhurried — designed so the day itself feels familiar
            by the time we&apos;re standing on it.
          </p>
        </div>

        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "1fr",
            maxWidth: "52rem",
          }}
        >
          {PROCESS_STEPS.map((s, i) => (
            <li
              key={s.n}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(5rem, 7rem) 1fr",
                gap: "3rem",
                padding: "2.5rem 0",
                borderTop: "0.5px solid var(--olive)",
                borderBottom:
                  i === PROCESS_STEPS.length - 1
                    ? "0.5px solid var(--olive)"
                    : undefined,
              }}
            >
              <div
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "2.4rem",
                  fontStyle: "italic",
                  fontWeight: 300,
                  lineHeight: 1,
                  color: "var(--olive)",
                  paddingTop: "0.2rem",
                }}
              >
                {s.n}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)",
                    fontWeight: 300,
                    lineHeight: 1.2,
                    letterSpacing: "-0.005em",
                    marginBottom: "0.9rem",
                    color: "var(--charcoal)",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "1rem",
                    fontWeight: 300,
                    lineHeight: 1.85,
                    color: "var(--charcoal-light)",
                    maxWidth: "36rem",
                  }}
                >
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ───── 3. Package cards ───── */}
      <section
        style={{
          padding: "6rem 4rem",
          background: "rgba(232,235,216,0.25)",
          borderTop: "0.5px solid var(--border)",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1.5rem",
            marginBottom: "3rem",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--olive)",
              fontWeight: 400,
              whiteSpace: "nowrap",
            }}
          >
            Packages
          </span>
          <div
            style={{ flex: 1, height: "0.5px", background: "var(--border)" }}
          />
        </div>

        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
              fontWeight: 300,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              color: "var(--charcoal)",
            }}
          >
            Three starting points, <em>each one tailored</em>
          </h2>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              marginTop: "1.5rem",
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.85,
              color: "var(--charcoal-light)",
            }}
          >
            These are the foundations. Most clients arrive with something
            specific in mind — we shape the rest together.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {INVESTMENT_PACKAGES.map((p) => (
            <article
              key={p.id}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "2.75rem 2.25rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "2rem",
                  fontWeight: 300,
                  lineHeight: 1.2,
                  letterSpacing: "-0.005em",
                  color: "var(--charcoal)",
                  marginBottom: "0.6rem",
                }}
              >
                {p.name}
              </h3>
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.88rem",
                  fontWeight: 300,
                  letterSpacing: "0.02em",
                  color: "var(--charcoal-muted)",
                  marginBottom: "2rem",
                }}
              >
                Starting at{" "}
                <span style={{ color: "var(--charcoal)", fontWeight: 400 }}>
                  {formatUsd(p.startingPriceUsd)}
                </span>
              </p>

              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  marginBottom: "2rem",
                  flex: 1,
                }}
              >
                {p.includes.map((line) => (
                  <li
                    key={line}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.85rem",
                      alignItems: "baseline",
                      padding: "0.55rem 0",
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "0.92rem",
                      fontWeight: 300,
                      lineHeight: 1.6,
                      color: "var(--charcoal-light)",
                      borderBottom: "0.5px solid var(--border)",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: "4px",
                        height: "4px",
                        background: "var(--olive)",
                        marginTop: "0.45rem",
                      }}
                    />
                    {line}
                  </li>
                ))}
              </ul>

              <p
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontStyle: "italic",
                  fontWeight: 300,
                  fontSize: "1rem",
                  lineHeight: 1.55,
                  color: "var(--charcoal-light)",
                  marginBottom: "2rem",
                }}
              >
                {p.idealFor}
              </p>

              <Link
                href={`/booking?package=${p.id}`}
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "0.85rem 1.5rem",
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  border: "0.5px solid var(--olive)",
                  textDecoration: "none",
                }}
              >
                Inquire about {p.name}
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ───── 4. Testimonial pull-quote ───── */}
      <section
        style={{
          padding: "8rem 4rem",
          background: "var(--charcoal)",
          color: "var(--white)",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.65rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--olive-light)",
            marginBottom: "2rem",
          }}
        >
          In Their Words
        </p>
        <blockquote
          style={{
            maxWidth: "56rem",
            margin: "0 auto",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(1.8rem, 3.6vw, 2.8rem)",
            fontWeight: 300,
            fontStyle: "italic",
            lineHeight: 1.35,
            letterSpacing: "-0.005em",
          }}
        >
          &ldquo;[Placeholder — a real client testimonial will live here once
          reviews are imported. The shape of the quote, the cadence of the
          voice, and the named reader will all be replaced.]&rdquo;
        </blockquote>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            marginTop: "2.5rem",
            fontSize: "0.7rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--olive-light)",
            fontWeight: 400,
          }}
        >
          — Real testimonial to be added
        </p>
      </section>

      {/* ───── 5. Footer CTA ───── */}
      <section
        style={{
          padding: "7rem 4rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "3rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "1rem",
            }}
          >
            Ready to begin?
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 4.5vw, 3.4rem)",
              fontWeight: 300,
              color: "var(--charcoal)",
              lineHeight: 1.15,
              letterSpacing: "-0.005em",
            }}
          >
            Let&apos;s plan the <em>next one</em>
          </h2>
        </div>
        <Link
          href="/booking"
          style={{
            display: "inline-block",
            padding: "1.1rem 3rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.78rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          Start your inquiry
        </Link>
      </section>

      <Footer />
    </div>
  );
}
