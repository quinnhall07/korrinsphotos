// app/investment/page.tsx
// Public Investment / Pricing page. Editorial process + investment hybrid.
// Server-rendered (no client state needed); pairs with Navbar link to /investment.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Investment | Korrin's Photos",
  description:
    "Investment guide for Korrin's Photography — portrait, engagement, and wedding packages. A long-term decision in light, intention, and craft.",
};

/* ─── Static page data ────────────────────────────────────────────────── */

const PROCESS_STEPS = [
  {
    step: "Step 01",
    title: "Inquiry",
    body:
      "Share a few details about your vision — the season, the people, the feeling you want to remember. I read every inquiry myself and respond within 48 hours.",
  },
  {
    step: "Step 02",
    title: "Consultation",
    body:
      "We meet for a relaxed call to walk through locations, timeline, wardrobe, and the small details that make a session feel like yours. This is where the shoot begins.",
  },
  {
    step: "Step 03",
    title: "The Shoot",
    body:
      "On the day, my job is to make the camera disappear. We move with the light, follow the moments as they come, and trust that the in-between frames are often the best ones.",
  },
  {
    step: "Step 04",
    title: "Delivery",
    body:
      "A private online gallery arrives within four weeks, with a sneak peek inside one. High-resolution downloads, print release, and an archive that lives for a full year.",
  },
];

type Package = {
  eyebrow: string;
  title: string;
  priceFrom: string;
  inclusions: string[];
};

const PACKAGES: Package[] = [
  {
    eyebrow: "Portrait",
    title: "The Editorial Session",
    priceFrom: "$750",
    inclusions: [
      "Approximately 1.5 hour session",
      "One outfit, one location",
      "30+ edited high-resolution images",
      "Private online gallery for 12 months",
      "Personal print release",
    ],
  },
  {
    eyebrow: "Engagement",
    title: "The Engagement Story",
    priceFrom: "$1,200",
    inclusions: [
      "Approximately 2 hour session",
      "Two locations, two outfits",
      "50+ edited high-resolution images",
      "Private online gallery for 12 months",
      "Sneak peek delivered within one week",
      "Personal print release",
    ],
  },
  {
    eyebrow: "Wedding",
    title: "The Wedding Day",
    priceFrom: "$4,500",
    inclusions: [
      "Approximately 8 hours of coverage",
      "Second shooter through the ceremony",
      "600+ edited high-resolution images",
      "Private online gallery for 12 months",
      "Sneak peek delivered within one week",
      "Full delivery within four weeks",
      "Personal print release",
    ],
  },
];

/* ─── Page ────────────────────────────────────────────────────────────── */

export default function InvestmentPage() {
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* ───── 1. Hero band ───── */}
      <section
        style={{
          position: "relative",
          height: "calc(80vh - 72px)",
          minHeight: "520px",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "url('https://picsum.photos/seed/investment-hero/1800/1100')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(42,42,40,0.30) 0%, rgba(42,42,40,0.55) 100%)",
            }}
          />
        </div>

        <div
          className="hero-animate"
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            color: "var(--white)",
            padding: "0 2rem",
          }}
        >
          <p
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              fontWeight: 400,
              marginBottom: "1.2rem",
              opacity: 0.85,
            }}
          >
            Process &amp; Pricing
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(3rem, 7vw, 6rem)",
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              marginBottom: "1.6rem",
            }}
          >
            <em>Investment</em>
          </h1>
          <p
            style={{
              fontSize: "0.92rem",
              letterSpacing: "0.04em",
              fontWeight: 300,
              opacity: 0.88,
              maxWidth: "32rem",
              margin: "0 auto",
              lineHeight: 1.8,
            }}
          >
            A session is a long-term decision — a quiet archive of who you were,
            kept for the people who will care most.
          </p>
        </div>
      </section>

      {/* ───── 2. The Process ───── */}
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
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
              fontWeight: 300,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            From first message to <em>final frame</em>
          </h2>
          <p
            style={{
              marginTop: "1.5rem",
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.85,
              color: "var(--charcoal-light)",
            }}
          >
            Four steps, unhurried — designed so the day itself feels familiar by
            the time we&apos;re standing on it.
          </p>
        </div>

        <ol
          style={{
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "1fr",
            maxWidth: "52rem",
          }}
        >
          {PROCESS_STEPS.map((s, i) => (
            <li
              key={s.step}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(7rem, 9rem) 1fr",
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
                  fontSize: "0.65rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  fontWeight: 400,
                  paddingTop: "0.6rem",
                }}
              >
                {s.step}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)",
                    fontWeight: 300,
                    lineHeight: 1.2,
                    letterSpacing: "-0.005em",
                    marginBottom: "0.9rem",
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
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

      {/* ───── 3. Packages ───── */}
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
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <div style={{ maxWidth: "44rem", marginBottom: "4rem" }}>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
              fontWeight: 300,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            Three starting points, <em>each one tailored</em>
          </h2>
          <p
            style={{
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
          {PACKAGES.map((p) => (
            <article
              key={p.title}
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "2.75rem 2.25rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
              }}
            >
              <p
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  fontWeight: 400,
                  marginBottom: "1.2rem",
                }}
              >
                {p.eyebrow}
              </p>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.85rem",
                  fontWeight: 300,
                  lineHeight: 1.2,
                  letterSpacing: "-0.005em",
                  marginBottom: "1rem",
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontSize: "0.88rem",
                  fontWeight: 300,
                  letterSpacing: "0.02em",
                  color: "var(--charcoal-muted)",
                  marginBottom: "2rem",
                }}
              >
                Investment begins at{" "}
                <span style={{ color: "var(--charcoal)" }}>{p.priceFrom}</span>
              </p>

              <ul
                style={{
                  listStyle: "none",
                  marginBottom: "2.5rem",
                  flex: 1,
                }}
              >
                {p.inclusions.map((line) => (
                  <li
                    key={line}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr",
                      gap: "0.85rem",
                      alignItems: "baseline",
                      padding: "0.55rem 0",
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

              <Link
                href="/booking"
                style={{
                  display: "inline-block",
                  textAlign: "center",
                  padding: "0.85rem 1.5rem",
                  fontSize: "0.7rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  border: "0.5px solid var(--olive)",
                  textDecoration: "none",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                Inquire about this package
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* ───── 4. What's included for every project ───── */}
      <section style={{ padding: "6rem 4rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 18rem) 1fr",
            gap: "5rem",
            maxWidth: "64rem",
          }}
        >
          <div>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--olive)",
                fontWeight: 400,
                marginBottom: "1.2rem",
              }}
            >
              Always Included
            </p>
            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)",
                fontWeight: 300,
                lineHeight: 1.2,
                letterSpacing: "-0.005em",
              }}
            >
              The <em>constants</em>
            </h2>
          </div>
          <p
            style={{
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.9,
              color: "var(--charcoal-light)",
            }}
          >
            Every project — regardless of size — includes an unhurried
            consultation call, a private online gallery for twelve months,
            high-resolution downloads, integrated online ordering for prints and
            albums, a personal print release, and the quiet certainty that the
            person behind the camera has cared about the work for more than a
            decade.
          </p>
        </div>
      </section>

      {/* ───── 5. Testimonial pull-quote ───── */}
      <section
        style={{
          padding: "8rem 4rem",
          background: "var(--charcoal)",
          color: "var(--white)",
          textAlign: "center",
        }}
      >
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
          &ldquo;Korrin doesn&apos;t just take photographs — she watches for the
          moments most people miss, and gives them back to you twice the size
          you remembered.&rdquo;
        </blockquote>
        <p
          style={{
            marginTop: "2.5rem",
            fontSize: "0.7rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--olive-light)",
            fontWeight: 400,
          }}
        >
          — S. Williams, Portrait Client, 2025
        </p>
      </section>

      {/* ───── 6. CTA band ───── */}
      <section
        style={{
          padding: "6rem 4rem",
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
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: 300,
              color: "var(--charcoal)",
              lineHeight: 1.2,
            }}
          >
            Let&apos;s plan the <em>next one</em>
          </h2>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexShrink: 0 }}>
          <Link
            href="/booking"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "var(--olive)",
              color: "var(--white)",
              textDecoration: "none",
            }}
          >
            Start your inquiry
          </Link>
          <Link
            href="/booking"
            style={{
              display: "inline-block",
              padding: "0.85rem 2.2rem",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              textDecoration: "none",
            }}
          >
            Download full guide
          </Link>
        </div>
      </section>

      {/* ───── 7. Footer ───── */}
      <Footer />
    </div>
  );
}
