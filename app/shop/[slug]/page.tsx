// app/shop/[slug]/page.tsx
// Public product detail page. Server Component. Renders editorial header,
// hero, long description (raw HTML), gallery thumbnails, price, and a
// "Buy now" button that links directly to the Stripe Payment Link.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { JsonLd } from "@/components/JsonLd";
import {
  getProductBySlug,
  listPublishedProducts,
  type ProductType,
} from "@/lib/db/products";
import {
  buildBreadcrumbSchema,
  buildProductSchema,
} from "@/lib/seo/schema";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

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

export async function generateStaticParams() {
  try {
    const products = await listPublishedProducts();
    return products.map((p) => ({ slug: p.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  if (!product || product.status !== "PUBLISHED") {
    return { title: "Shop | Korrin's Photos" };
  }
  return {
    title: `${product.title} | Shop | Korrin's Photos`,
    description: product.shortDescription,
  };
}

export default async function ShopProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "PUBLISHED") notFound();

  const productSchema = buildProductSchema({
    name: product.title,
    slug: product.slug,
    description: product.shortDescription,
    priceCents: product.priceCents,
    image: product.heroImageUrl ?? null,
    inStock: Boolean(product.stripePaymentLinkUrl),
  });
  const breadcrumb = buildBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Shop", url: "/shop" },
    { name: product.title, url: `/shop/${product.slug}` },
  ]);

  const canBuy = Boolean(product.stripePaymentLinkUrl);

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <JsonLd
        data={
          [productSchema, breadcrumb] as unknown as Parameters<
            typeof JsonLd
          >[0]["data"]
        }
      />

      {/* Breadcrumb */}
      <div
        style={{
          padding: "1.5rem 4rem 0",
          maxWidth: "92rem",
          margin: "0 auto",
        }}
      >
        <Link
          href="/shop"
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← Shop
        </Link>
      </div>

      {/* Two-column layout: hero + buy panel */}
      <section
        style={{
          padding: "3rem 4rem",
          display: "grid",
          gridTemplateColumns: product.heroImageUrl ? "1.1fr 1fr" : "1fr",
          gap: "4rem",
          alignItems: "start",
          maxWidth: "92rem",
          margin: "0 auto",
        }}
      >
        {product.heroImageUrl && (
          <div
            style={{
              border: "0.5px solid var(--border)",
              padding: "0.5rem",
              background: "var(--white)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.heroImageUrl}
              alt={product.title}
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
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "1rem",
            }}
          >
            {TYPE_LABEL[product.type]}
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
              fontWeight: 300,
              lineHeight: 1.05,
              letterSpacing: "-0.01em",
              marginBottom: "1.25rem",
              color: "var(--charcoal)",
            }}
          >
            {product.title}
          </h1>
          <p
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "1.05rem",
              fontWeight: 300,
              lineHeight: 1.75,
              color: "var(--charcoal-light)",
              marginBottom: "2rem",
            }}
          >
            {product.shortDescription}
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "1.25rem",
              marginBottom: "2rem",
            }}
          >
            <span
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.4rem",
                fontWeight: 300,
                color: "var(--charcoal)",
              }}
            >
              {formatPrice(product.priceCents)}
            </span>
          </div>

          {canBuy ? (
            <a
              href={product.stripePaymentLinkUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                padding: "1rem 2.4rem",
                background: "var(--charcoal)",
                color: "var(--white)",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.78rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                textDecoration: "none",
                border: "none",
              }}
            >
              Buy now — {formatPrice(product.priceCents)}
            </a>
          ) : (
            <button
              type="button"
              disabled
              style={{
                padding: "1rem 2.4rem",
                background: "rgba(42,42,40,0.08)",
                color: "var(--charcoal-muted)",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.78rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                border: "none",
                cursor: "not-allowed",
              }}
            >
              Currently unavailable
            </button>
          )}

          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
              marginTop: "1.25rem",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            Instant download — delivered to your inbox after checkout.
          </p>
        </div>
      </section>

      {/* Long description */}
      {product.longDescriptionHtml && product.longDescriptionHtml.trim() && (
        <section
          style={{
            padding: "3rem 4rem 4rem",
            maxWidth: "60rem",
            margin: "0 auto",
            borderTop: "0.5px solid var(--border)",
          }}
        >
          <div
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "1rem",
              lineHeight: 1.85,
              color: "var(--charcoal-light)",
            }}
            // Server-rendered, admin-controlled HTML — no user-supplied content.
            dangerouslySetInnerHTML={{ __html: product.longDescriptionHtml }}
          />
        </section>
      )}

      {/* Gallery */}
      {product.galleryImageUrls && product.galleryImageUrls.length > 0 && (
        <section
          style={{
            padding: "0 4rem 5rem",
            maxWidth: "92rem",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {product.galleryImageUrls.map((url, i) => (
            <div
              key={`${url}-${i}`}
              style={{
                aspectRatio: "1 / 1",
                background: "rgba(42,42,40,0.06)",
                overflow: "hidden",
                border: "0.5px solid var(--border)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${product.title} preview ${i + 1}`}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          ))}
        </section>
      )}

      <Footer />
    </div>
  );
}
