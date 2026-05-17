// app/admin/shop/[id]/page.tsx
// Edit a single product. Server Component fetches the doc and hands a
// serialised version to the client editor.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getProduct } from "@/lib/db/products";
import {
  ProductDetailClient,
  type SerializedProduct,
} from "./ProductDetailClient";

export const metadata: Metadata = { title: "Product | Admin" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;

  const product = await getProduct(id);
  if (!product) notFound();

  const serialised: SerializedProduct = {
    id: product.id,
    slug: product.slug,
    title: product.title,
    type: product.type,
    status: product.status,
    shortDescription: product.shortDescription,
    longDescriptionHtml: product.longDescriptionHtml,
    priceCents: product.priceCents,
    heroImageUrl: product.heroImageUrl ?? "",
    galleryImageUrls: product.galleryImageUrls ?? [],
    fileR2Key: product.fileR2Key,
    fileSizeBytes: product.fileSizeBytes ?? null,
    stripePaymentLinkUrl: product.stripePaymentLinkUrl ?? null,
    stripePaymentLinkId: product.stripePaymentLinkId ?? null,
    stripePriceId: product.stripePriceId ?? null,
    purchaseCount: product.purchaseCount ?? 0,
    createdAt: product.createdAt.toDate().toISOString(),
    updatedAt: product.updatedAt.toDate().toISOString(),
  };

  return (
    <div className="page-fade-in" style={{ padding: "2rem 2rem 6rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <Link
          href="/admin/shop"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            textDecoration: "none",
          }}
        >
          ← Shop
        </Link>
      </div>
      <ProductDetailClient product={serialised} />
    </div>
  );
}
