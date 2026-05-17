// app/magnet/[slug]/page.tsx
// Public lead-magnet landing page. Server Component; gates a file download
// behind an email + first name. Matches the `/investment` editorial template
// (off-white background, olive accents, 0.5px borders, no border-radius).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getLeadMagnetBySlug } from "@/lib/db/lead-magnets";
import { buildCdnUrl } from "@/lib/storage/images";
import { MagnetGateForm } from "./MagnetGateForm";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const magnet = await getLeadMagnetBySlug(slug).catch(() => null);
  if (!magnet || magnet.status !== "ACTIVE") {
    return { title: "Free Guide | Korrin's Photos" };
  }
  return {
    title: `${magnet.title} | Korrin's Photos`,
    description: magnet.description,
  };
}

/**
 * Best-guess "what kind of shoot is this guide for?" for the soft-checkbox
 * label. The slug substring is enough — we don't need a database column.
 */
function inferSessionTypeHint(slug: string): string {
  if (slug.includes("wedding")) return "wedding";
  if (slug.includes("engagement")) return "engagement";
  if (slug.includes("portrait")) return "portrait";
  if (slug.includes("family")) return "family";
  if (slug.includes("editorial")) return "editorial";
  return "your";
}

export default async function MagnetLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const magnet = await getLeadMagnetBySlug(slug);
  if (!magnet || magnet.status !== "ACTIVE") notFound();

  const coverUrl = magnet.coverImageId
    ? buildCdnUrl(magnet.coverImageId, "gallery")
    : null;

  const sessionTypeHint = inferSessionTypeHint(magnet.slug);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* ───── Editorial header ───── */}
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
          A Free Guide
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.75rem, 6vw, 4.5rem)",
            fontWeight: 300,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            marginBottom: "1.75rem",
            color: "var(--charcoal)",
            maxWidth: "48rem",
          }}
        >
          {magnet.title}
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
          {magnet.description}
        </p>
      </section>

      {/* ───── Two-column: cover + gate ───── */}
      <section
        style={{
          padding: "5rem 4rem",
          display: "grid",
          gridTemplateColumns: coverUrl ? "1fr 1fr" : "1fr",
          gap: "4rem",
          alignItems: "start",
          maxWidth: "92rem",
          margin: "0 auto",
        }}
      >
        {coverUrl && (
          <div
            style={{
              border: "0.5px solid var(--border)",
              padding: "0.5rem",
              background: "var(--white)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={magnet.title}
              onContextMenu={(e) => e.preventDefault()}
              draggable={false}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        )}

        <div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "1.5rem",
              marginBottom: "2rem",
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
              Receive the Guide
            </span>
            <div
              style={{ flex: 1, height: "0.5px", background: "var(--border)" }}
            />
          </div>

          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)",
              fontWeight: 300,
              lineHeight: 1.25,
              letterSpacing: "-0.01em",
              color: "var(--charcoal)",
              marginBottom: "1.25rem",
            }}
          >
            Enter your details and it&apos;s <em>yours</em>.
          </h2>

          <MagnetGateForm slug={magnet.slug} sessionTypeHint={sessionTypeHint} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
