// app/c/[slug]/page.tsx
// Public campaign landing page (Phase 4.9). Server Component.
//
// Responsibilities:
// 1. Resolve the campaign by slug — 404 if missing or not ACTIVE.
// 2. Best-effort `incrementCampaignVisit(slug)`.
// 3. Set the `__campaign` cookie (30-day, JS-readable) so the booking
//    submission can attribute the inquiry. This cookie OVERLAYS but does
//    NOT REPLACE `__origin`; precedence is enforced in `submitBooking`.
// 4. Render editorial hero / body / CTA / optional gallery strip.
// 5. Inject a `Service` JSON-LD via `<JsonLd>`.

import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import {
  getCampaignBySlug,
  incrementCampaignVisit,
  type CampaignDoc,
} from "@/lib/db/campaigns";
import { buildCdnUrl } from "@/lib/storage/images";
import { adminDb } from "@/lib/firebase-admin";
import { buildServiceSchema } from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ─── Metadata ─────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug).catch(() => null);
  if (!campaign || campaign.status !== "ACTIVE") {
    return { title: "Campaign | Korrin's Photos" };
  }

  const description =
    campaign.heroSubtitle?.trim() ||
    stripHtml(campaign.bodyHtml).slice(0, 240) ||
    "A featured campaign from Korrin's Photography.";
  const ogImage = campaign.heroPhotoCloudflareId
    ? buildCdnUrl(campaign.heroPhotoCloudflareId, "gallery")
    : undefined;

  return {
    title: `${campaign.heroTitle} | Korrin's Photos`,
    description,
    openGraph: {
      title: campaign.heroTitle,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCtaHref(campaign: CampaignDoc): string {
  if (campaign.ctaHref?.trim()) return campaign.ctaHref.trim();
  const params = new URLSearchParams({ campaign: campaign.slug });
  if (campaign.inquiryPrefill?.packageSlug) {
    params.set("package", campaign.inquiryPrefill.packageSlug);
  }
  if (campaign.inquiryPrefill?.sessionType) {
    params.set("sessionType", campaign.inquiryPrefill.sessionType);
  }
  return `/booking?${params.toString()}`;
}

/**
 * Pulls up to 6 photos matching `category` from the public portfolio
 * (collectionGroup query on `photos`). Best-effort — returns `[]` on error
 * so the landing page never crashes on a Firestore index miss.
 */
async function fetchGalleryStrip(category: string): Promise<
  Array<{ id: string; src: string; thumbnailSrc: string }>
> {
  try {
    const snap = await adminDb
      .collectionGroup("photos")
      .where("category", "==", category)
      .orderBy("uploadedAt", "desc")
      .limit(6)
      .get();
    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        src: buildCdnUrl(data.cloudflareImageId, "gallery"),
        thumbnailSrc: buildCdnUrl(data.cloudflareImageId, "thumbnail"),
      };
    });
  } catch (err) {
    console.error("fetchGalleryStrip failed:", err);
    return [];
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function CampaignLandingPage({ params }: PageProps) {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign || campaign.status !== "ACTIVE") notFound();

  // Best-effort visit counter — never block render.
  incrementCampaignVisit(slug).catch(() => {});

  // Set the `__campaign` cookie. Overwrites on every visit (campaigns are
  // the higher-precedence attribution source). Next.js 15: cookies() is async.
  try {
    const cookieStore = await cookies();
    cookieStore.set("__campaign", JSON.stringify({ slug, ts: Date.now() }), {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  } catch (err) {
    // cookies() can throw outside a request context. Render must still succeed.
    console.error("Failed to set __campaign cookie:", err);
  }

  const heroUrl = campaign.heroPhotoCloudflareId
    ? buildCdnUrl(campaign.heroPhotoCloudflareId, "gallery")
    : null;

  const ctaHref = buildCtaHref(campaign);

  // Best-effort gallery strip.
  const galleryPhotos =
    campaign.galleryCategory
      ? await fetchGalleryStrip(campaign.galleryCategory.trim())
      : [];

  const serviceSchema = buildServiceSchema(
    campaign.galleryCategory?.trim() || null
  );
  // Override the schema name with the campaign title for stronger SEO targeting.
  const jsonLd = { ...serviceSchema, name: campaign.heroTitle };

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd data={jsonLd} />

      {/* ───── Hero ───── */}
      <section
        style={{
          position: "relative",
          padding: heroUrl ? "0" : "8rem 4rem 5rem",
          borderBottom: heroUrl ? "none" : "0.5px solid var(--border)",
        }}
      >
        {heroUrl ? (
          <div
            style={{
              position: "relative",
              minHeight: "min(70vh, 640px)",
              background: `url('${heroUrl}') center/cover no-repeat`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(42,42,40,0.15) 0%, rgba(42,42,40,0.55) 100%)",
              }}
            />
            <div
              style={{
                position: "relative",
                padding: "10rem 4rem 5rem",
                maxWidth: "60rem",
                color: "var(--white)",
              }}
            >
              <p
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "var(--olive-light)",
                  marginBottom: "1.25rem",
                }}
              >
                Featured
              </p>
              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "clamp(2.75rem, 6vw, 4.75rem)",
                  fontWeight: 300,
                  lineHeight: 1.05,
                  letterSpacing: "-0.01em",
                  marginBottom: campaign.heroSubtitle ? "1.5rem" : "2.25rem",
                  color: "var(--white)",
                  maxWidth: "48rem",
                }}
              >
                {campaign.heroTitle}
              </h1>
              {campaign.heroSubtitle && (
                <p
                  style={{
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "1.1rem",
                    fontWeight: 300,
                    lineHeight: 1.7,
                    color: "rgba(250,249,246,0.92)",
                    marginBottom: "2.5rem",
                    maxWidth: "40rem",
                  }}
                >
                  {campaign.heroSubtitle}
                </p>
              )}
              <Link
                href={ctaHref}
                style={{
                  display: "inline-block",
                  padding: "1rem 2.4rem",
                  background: "var(--olive)",
                  color: "var(--white)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  textDecoration: "none",
                  fontFamily: "'Jost', sans-serif",
                }}
              >
                {campaign.ctaText}
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: "60rem" }}>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "var(--olive)",
                marginBottom: "1.25rem",
              }}
            >
              Featured
            </p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "clamp(2.75rem, 6vw, 4.75rem)",
                fontWeight: 300,
                lineHeight: 1.05,
                letterSpacing: "-0.01em",
                marginBottom: campaign.heroSubtitle ? "1.5rem" : "2.25rem",
                color: "var(--charcoal)",
                maxWidth: "48rem",
              }}
            >
              {campaign.heroTitle}
            </h1>
            {campaign.heroSubtitle && (
              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "1.1rem",
                  fontWeight: 300,
                  lineHeight: 1.75,
                  color: "var(--charcoal-light)",
                  marginBottom: "2.5rem",
                  maxWidth: "40rem",
                }}
              >
                {campaign.heroSubtitle}
              </p>
            )}
            <Link
              href={ctaHref}
              style={{
                display: "inline-block",
                padding: "1rem 2.4rem",
                background: "var(--olive)",
                color: "var(--white)",
                fontSize: "0.72rem",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                textDecoration: "none",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              {campaign.ctaText}
            </Link>
          </div>
        )}
      </section>

      {/* ───── Body ───── */}
      {campaign.bodyHtml.trim() && (
        <section
          style={{
            padding: "5rem 4rem",
            maxWidth: "52rem",
            margin: "0 auto",
          }}
        >
          <div
            className="campaign-body"
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "1.02rem",
              fontWeight: 300,
              lineHeight: 1.9,
              color: "var(--charcoal-light)",
            }}
            // Admin-authored HTML — see lib/db/campaigns.ts `bodyHtml`. Never
            // exposed to untrusted writers, so the inline injection is safe.
            dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }}
          />
        </section>
      )}

      {/* ───── Gallery strip ───── */}
      {galleryPhotos.length > 0 && (
        <section
          style={{
            padding: "0 4rem 5rem",
            maxWidth: "92rem",
            margin: "0 auto",
          }}
        >
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
              Selected Work
            </span>
            <div
              style={{
                flex: 1,
                height: "0.5px",
                background: "var(--border)",
              }}
            />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.5rem",
            }}
          >
            {galleryPhotos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={p.id}
                src={p.src}
                alt=""
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  aspectRatio: "4 / 5",
                  objectFit: "cover",
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* ───── CTA repeat ───── */}
      <section
        style={{
          background: "var(--charcoal)",
          padding: "5rem 4rem",
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
              color: "var(--olive-light)",
              marginBottom: "0.85rem",
            }}
          >
            Ready when you are
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(1.85rem, 3.5vw, 2.6rem)",
              fontWeight: 300,
              color: "var(--white)",
              lineHeight: 1.15,
              maxWidth: "38rem",
            }}
          >
            Let&apos;s make <em>something beautiful</em>.
          </h2>
        </div>
        <Link
          href={ctaHref}
          style={{
            display: "inline-block",
            padding: "1rem 2.4rem",
            background: "var(--olive)",
            color: "var(--white)",
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {campaign.ctaText}
        </Link>
      </section>

      <Footer />
    </div>
  );
}
