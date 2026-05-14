// app/journal/[slug]/page.tsx
// Public journal post detail. Resolves `slug` → post. `notFound()` if the
// post is missing OR not PUBLISHED. Renders a long-form editorial layout
// with hero, body HTML, photo stack, and linked vendors — plus BlogPosting
// + BreadcrumbList JSON-LD.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { buildCdnUrl } from "@/lib/cloudflare";
import { getJournalPostBySlug } from "@/lib/db/journal-posts";
import { getVendor, type VendorDoc } from "@/lib/db/vendors";
import {
  buildBlogPostingSchema,
  buildBreadcrumbSchema,
} from "@/lib/seo/schema";
import { formatDisplayDate } from "@/lib/date";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug).catch(() => null);
  if (!post || post.status !== "PUBLISHED") {
    return { title: "Journal | Korrin's Photos" };
  }
  const heroId = post.heroPhotoCloudflareId ?? post.photoCloudflareIds[0];
  const ogImage = heroId ? buildCdnUrl(heroId, "gallery") : undefined;
  return {
    title:       post.seoTitle ?? `${post.title} | Korrin's Photos`,
    description: post.seoDescription ?? undefined,
    openGraph: {
      title:       post.seoTitle ?? post.title,
      description: post.seoDescription ?? undefined,
      type:        "article",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function JournalPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getJournalPostBySlug(slug).catch(() => null);
  if (!post || post.status !== "PUBLISHED") notFound();

  // Hydrate the linked vendor docs (best-effort).
  let vendors: VendorDoc[] = [];
  if (post.vendorIds && post.vendorIds.length > 0) {
    const resolved = await Promise.all(
      post.vendorIds.map((id) => getVendor(id).catch(() => null))
    );
    vendors = resolved.filter((v): v is VendorDoc => !!v);
  }

  const heroId = post.heroPhotoCloudflareId ?? post.photoCloudflareIds[0];

  // JSON-LD payload.
  const datePublished = post.publishedAt
    ? post.publishedAt.toDate()
    : post.createdAt.toDate();
  const blogPosting = buildBlogPostingSchema({
    title:         post.title,
    slug:          post.slug,
    datePublished,
    body:          post.bodyHtml.replace(/<[^>]+>/g, " ").trim(),
    image: heroId
      ? buildCdnUrl(heroId, "gallery")
      : "/favicon.ico",
  });
  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home",       url: "/" },
    { name: "Journal",    url: "/journal" },
    { name: post.title,   url: `/journal/${post.slug}` },
  ]);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd
        data={[blogPosting, breadcrumb] as unknown as Parameters<typeof JsonLd>[0]["data"]}
      />

      {/* Title block */}
      <section
        style={{
          padding:      "5rem 4rem 2rem",
          maxWidth:     "900px",
          margin:       "0 auto",
        }}
      >
        {post.city ? (
          <p
            style={{
              fontSize:      "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color:         "var(--olive)",
              marginBottom:  "1rem",
            }}
          >
            {post.city}
          </p>
        ) : null}
        <h1
          style={{
            fontFamily:    "'Cormorant Garamond', serif",
            fontSize:      "clamp(2.4rem, 5vw, 4rem)",
            fontWeight:    300,
            letterSpacing: "-0.01em",
            lineHeight:    1.1,
          }}
        >
          {post.title}
        </h1>
        {post.subtitle ? (
          <p
            style={{
              marginTop:  "1.2rem",
              fontFamily: "'Cormorant Garamond', serif",
              fontSize:   "1.4rem",
              fontWeight: 300,
              fontStyle:  "italic",
              color:      "var(--charcoal-light)",
              lineHeight: 1.4,
            }}
          >
            {post.subtitle}
          </p>
        ) : null}
        {post.publishedAt ? (
          <p
            style={{
              marginTop:     "1.5rem",
              fontSize:      "0.72rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color:         "var(--charcoal-muted)",
            }}
          >
            {formatDisplayDate(post.publishedAt)}
            {post.locationName ? ` · ${post.locationName}` : ""}
          </p>
        ) : null}
      </section>

      {/* Hero */}
      {heroId ? (
        <section
          style={{
            padding:      "2rem 4rem 3rem",
            maxWidth:     "1200px",
            margin:       "0 auto",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={buildCdnUrl(heroId, "gallery")}
            alt={post.title}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              width:    "100%",
              height:   "auto",
              display:  "block",
            }}
          />
        </section>
      ) : null}

      {/* Body */}
      {post.bodyHtml && post.bodyHtml.trim().length > 0 ? (
        <section
          style={{
            padding:      "1rem 4rem 4rem",
            maxWidth:     "720px",
            margin:       "0 auto",
            fontSize:     "1rem",
            lineHeight:   1.8,
            color:        "var(--charcoal)",
          }}
          // Korrin is the only author of this content — see lib/db/journal-posts
          // doc-comment. Untrusted user-supplied HTML never enters this field.
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      ) : null}

      {/* Photo stack */}
      {post.photoCloudflareIds.length > 0 ? (
        <section
          style={{
            padding:      "2rem 4rem 4rem",
            maxWidth:     "1200px",
            margin:       "0 auto",
            display:      "flex",
            flexDirection: "column",
            gap:          "2rem",
          }}
        >
          {post.photoCloudflareIds.map((id, idx) => (
            <div key={`${id}-${idx}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={buildCdnUrl(id, "gallery")}
                alt={`${post.title} — photo ${idx + 1}`}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width:   "100%",
                  height:  "auto",
                  display: "block",
                }}
              />
            </div>
          ))}
        </section>
      ) : null}

      {/* Vendors */}
      {vendors.length > 0 ? (
        <section
          style={{
            padding:      "3rem 4rem 5rem",
            maxWidth:     "900px",
            margin:       "0 auto",
            borderTop:    "0.5px solid var(--border)",
          }}
        >
          <p
            style={{
              fontSize:      "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color:         "var(--olive)",
              marginBottom:  "1.5rem",
              marginTop:     "2rem",
            }}
          >
            Vendors
          </p>
          <ul
            style={{
              listStyle: "none",
              padding:   0,
              margin:    0,
              display:   "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap:       "1.5rem 2rem",
            }}
          >
            {vendors.map((v) => (
              <li key={v.id}>
                <p
                  style={{
                    fontFamily:    "'Cormorant Garamond', serif",
                    fontSize:      "1.2rem",
                    fontWeight:    400,
                    marginBottom:  "0.2rem",
                  }}
                >
                  {v.name}
                </p>
                <p
                  style={{
                    fontSize:      "0.62rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color:         "var(--charcoal-muted)",
                  }}
                >
                  {v.category.toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Footer />
    </div>
  );
}
