// app/shop/page.tsx
// Public digital products store. Server Component listing every PUBLISHED
// product as an editorial 3-column card grid.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import { listPublishedProducts, type ProductType } from "@/lib/db/products";
import { buildBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Shop | Korrin's Photos",
  description:
    "Lightroom presets, mobile presets, and short courses from Korrin's Photography.",
};

export const revalidate = 300; // 5-minute ISR; admin actions revalidate explicitly.

const TYPE_LABEL: Record<ProductType, string> = {
  PRESET_DESKTOP: "Desktop preset",
  PRESET_MOBILE: "Mobile preset",
  COURSE: "Course",
  EBOOK: "Ebook",
  OTHER: "Digital",
};

function formatPrice(cents: number): string {
  if (cents % 100 === 0) return `$${cents / 100}`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function ShopIndexPage() {
  const products = await listPublishedProducts().catch((err) => {
    console.error("listPublishedProducts failed", err);
    return [];
  });

  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Shop", url: "/shop" },
  ]);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd
        data={breadcrumb as unknown as Parameters<typeof JsonLd>[0]["data"]}
      />

      {/* Editorial header */}
      <section
        style={{
          padding: "4rem 4rem 3rem",
          borderBottom: "0.5px solid var(--border)",
          marginBottom: "3rem",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "1rem",
          }}
        >
          The Shop
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.5rem, 5vw, 4rem)",
            fontWeight: 300,
            letterSpacing: "-0.01em",
          }}
        >
          Tools for <em>your craft</em>
        </h1>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "1rem",
            color: "var(--charcoal-light)",
            marginTop: "1rem",
            maxWidth: "42rem",
            lineHeight: 1.7,
          }}
        >
          Lightroom presets, mobile presets, and short courses — the same
          colour palette and editing rhythm that drive every gallery.
        </p>
      </section>

      {/* Products grid */}
      <section
        style={{
          padding: "0 4rem 6rem",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "3rem 2.5rem",
          maxWidth: "92rem",
          margin: "0 auto",
        }}
      >
        {products.length === 0 ? (
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--charcoal-muted)",
              fontStyle: "italic",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Coming soon.
          </p>
        ) : (
          products.map((p) => (
            <Link
              key={p.id}
              href={`/shop/${p.slug}`}
              style={{
                display: "block",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {/* Hero */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "4 / 5",
                  background: "rgba(42,42,40,0.06)",
                  overflow: "hidden",
                  marginBottom: "1.2rem",
                }}
              >
                {p.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.heroImageUrl}
                    alt={p.title}
                    draggable={false}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : null}
              </div>

              <p
                style={{
                  fontSize: "0.62rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  marginBottom: "0.5rem",
                }}
              >
                {TYPE_LABEL[p.type]}
              </p>

              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.55rem",
                  fontWeight: 300,
                  lineHeight: 1.2,
                  marginBottom: "0.5rem",
                  color: "var(--charcoal)",
                }}
              >
                {p.title}
              </h2>

              <p
                style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.88rem",
                  color: "var(--charcoal-light)",
                  lineHeight: 1.55,
                  marginBottom: "0.85rem",
                }}
              >
                {p.shortDescription}
              </p>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.2rem",
                    color: "var(--charcoal)",
                  }}
                >
                  {formatPrice(p.priceCents)}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                  }}
                >
                  View →
                </span>
              </div>
            </Link>
          ))
        )}
      </section>

      <Footer />
    </div>
  );
}
