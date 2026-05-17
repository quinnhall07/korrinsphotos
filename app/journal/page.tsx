// app/journal/page.tsx
// Public journal index — every PUBLISHED post, newest first. Editorial
// layout matching the /portfolio aesthetic: warm off-white, Cormorant
// Garamond headlines, generous white space, 0.5px borders.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { buildCdnUrl } from "@/lib/cloudflare";
import { listPublishedJournalPostsForIndex } from "@/lib/db/journal-posts";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";
import { formatDisplayDate } from "@/lib/date";

export const metadata: Metadata = {
  title:       "Journal | Korrin's Photos",
  description:
    "Editorial write-ups from delivered sessions — weddings, portraits, and the in-between moments worth holding onto.",
};

export const revalidate = 300; // 5-minute ISR; admin actions revalidate paths explicitly.

export default async function JournalIndexPage() {
  let posts: Awaited<ReturnType<typeof listPublishedJournalPostsForIndex>> = [];
  try {
    posts = await listPublishedJournalPostsForIndex(50);
  } catch (err) {
    // Firestore not yet configured / index missing — render an empty grid
    // rather than a 500. The admin index surfaces drafting errors anyway.
    console.error("[journal] index load failed", err);
  }

  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home",    url: "/" },
    { name: "Journal", url: "/journal" },
  ]);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd data={breadcrumb as unknown as Parameters<typeof JsonLd>[0]["data"]} />

      {/* Editorial header */}
      <section
        style={{
          padding:       "4rem 4rem 3rem",
          borderBottom:  "0.5px solid var(--border)",
          marginBottom:  "3rem",
        }}
      >
        <p
          style={{
            fontSize:       "0.65rem",
            letterSpacing:  "0.2em",
            textTransform:  "uppercase",
            color:          "var(--olive)",
            marginBottom:   "1rem",
          }}
        >
          The Journal
        </p>
        <h1
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontSize:      "clamp(2.5rem, 5vw, 4rem)",
            fontWeight:    300,
            letterSpacing: "-0.01em",
          }}
        >
          Stories from <em>the field</em>
        </h1>
      </section>

      {/* Posts grid */}
      <section
        style={{
          padding: "0 4rem 6rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "3rem 2.5rem",
        }}
      >
        {posts.length === 0 ? (
          <p
            style={{
              fontSize: "0.9rem",
              color:    "var(--charcoal-muted)",
              fontStyle: "italic",
            }}
          >
            No journal posts yet — check back soon.
          </p>
        ) : (
          posts.map((p) => {
            const heroId = p.heroPhotoCloudflareId ?? p.photoCloudflareIds[0];
            return (
              <Link
                key={p.id}
                href={`/journal/${p.slug}`}
                style={{
                  display:        "block",
                  textDecoration: "none",
                  color:          "inherit",
                }}
              >
                {/* Hero */}
                <div
                  style={{
                    width:    "100%",
                    aspectRatio: "4 / 5",
                    background: "rgba(42,42,40,0.06)",
                    overflow:   "hidden",
                    marginBottom: "1.2rem",
                  }}
                >
                  {heroId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={buildCdnUrl(heroId, "gallery")}
                      alt={p.title}
                      draggable={false}
                      style={{
                        width:    "100%",
                        height:   "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : null}
                </div>

                {p.city ? (
                  <p
                    style={{
                      fontSize:      "0.62rem",
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color:         "var(--olive)",
                      marginBottom:  "0.5rem",
                    }}
                  >
                    {p.city}
                  </p>
                ) : null}

                <h2
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize:   "1.6rem",
                    fontWeight: 300,
                    lineHeight: 1.2,
                    marginBottom: "0.5rem",
                  }}
                >
                  {p.title}
                </h2>

                <p
                  style={{
                    fontSize: "0.72rem",
                    letterSpacing: "0.08em",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  {p.publishedAt ? formatDisplayDate(p.publishedAt) : ""}
                </p>
              </Link>
            );
          })
        )}
      </section>

      <Footer />
    </div>
  );
}
