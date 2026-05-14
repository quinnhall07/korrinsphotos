"use server";

// app/admin/shop/actions.ts
// Server Actions for the admin digital-products store CRUD. Every export
// guards on `await requireAdmin()`. File bytes never transit these actions —
// admin clients PUT directly to R2 via the presigned URL we hand back from
// `getR2PutUrlForProductFile`.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createProduct as dbCreateProduct,
  deleteProduct as dbDeleteProduct,
  getProduct,
  getProductBySlug,
  productsCol,
  updateProduct as dbUpdateProduct,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  type ProductDoc,
  type ProductStatus,
  type ProductType,
} from "@/lib/db/products";
import { generatePresignedUploadUrl } from "@/lib/storage/r2";
import { createProductPaymentLink } from "@/lib/stripe";

// ─── Helpers ───────────────────────────────────────────────────────────────

function normaliseSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || /^[a-z0-9]+$/.test(slug);
}

function sanitiseFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// ─── Create ────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  slug: string;
  title: string;
  type: ProductType;
  shortDescription: string;
  longDescriptionHtml: string;
  priceCents: number;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  fileFileName?: string; // proposed name for the deliverable
  contentType?: string;
}

export type CreateProductResult =
  | {
      success: true;
      id: string;
      slug: string;
      uploadUrl: string;
      r2Key: string;
    }
  | { success: false; error: string };

/**
 * Creates a DRAFT product record and returns a presigned PUT URL the admin
 * client uses to upload the deliverable to R2. Slug is immutable post-create.
 * Publish (and Stripe Payment Link creation) happens via `publishProductAction`.
 */
export async function createProductAction(
  input: CreateProductInput
): Promise<CreateProductResult> {
  await requireAdmin();

  try {
    const title = input.title?.trim();
    const shortDescription = input.shortDescription?.trim();
    const longDescriptionHtml = input.longDescriptionHtml?.trim() ?? "";
    const slug = normaliseSlug(input.slug ?? "");
    const fileFileName = (input.fileFileName ?? "").trim() || `${slug}.zip`;

    if (!title) return { success: false, error: "Title is required." };
    if (!shortDescription)
      return { success: false, error: "Short description is required." };
    if (shortDescription.length > 200)
      return {
        success: false,
        error: "Short description must be 200 characters or fewer.",
      };
    if (!slug || !isValidSlug(slug)) {
      return {
        success: false,
        error: "Slug must be lowercase letters, numbers, or hyphens.",
      };
    }
    if (!PRODUCT_TYPES.includes(input.type)) {
      return { success: false, error: "Invalid product type." };
    }
    if (
      typeof input.priceCents !== "number" ||
      !Number.isFinite(input.priceCents) ||
      input.priceCents < 0
    ) {
      return { success: false, error: "Price must be a non-negative number." };
    }

    const existing = await getProductBySlug(slug);
    if (existing) {
      return {
        success: false,
        error: `A product with slug "${slug}" already exists.`,
      };
    }

    const r2Key = `products/${slug}/${Date.now()}-${sanitiseFileName(fileFileName)}`;

    const created = await dbCreateProduct({
      slug,
      title,
      type: input.type,
      status: "DRAFT",
      shortDescription,
      longDescriptionHtml,
      priceCents: Math.round(input.priceCents),
      heroImageUrl: input.heroImageUrl?.trim() || undefined,
      galleryImageUrls: input.galleryImageUrls,
      fileR2Key: r2Key,
    });

    const contentType = input.contentType?.trim() || "application/zip";
    const { presignedUrl } = await generatePresignedUploadUrl({
      key: r2Key,
      contentType,
      eventId: `product-${slug}`,
    });

    await logActivity("NOTE_ADDED", `Product created: ${title}`, {
      productId: created.id,
      slug,
    }).catch(() => {});

    revalidatePath("/admin/shop");

    return {
      success: true,
      id: created.id,
      slug,
      uploadUrl: presignedUrl,
      r2Key,
    };
  } catch (err) {
    console.error("createProductAction error:", err);
    return { success: false, error: "Failed to create product." };
  }
}

// ─── Update ────────────────────────────────────────────────────────────────

export interface UpdateProductInput {
  title?: string;
  type?: ProductType;
  shortDescription?: string;
  longDescriptionHtml?: string;
  priceCents?: number;
  heroImageUrl?: string | null;
  galleryImageUrls?: string[];
  status?: ProductStatus;
  fileSizeBytes?: number;
}

export async function updateProductAction(
  id: string,
  patch: UpdateProductInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getProduct(id);
    if (!existing) return { success: false, error: "Product not found." };

    const cleaned: Record<string, unknown> = {};

    if (patch.title !== undefined) {
      const trimmed = patch.title.trim();
      if (!trimmed) return { success: false, error: "Title cannot be empty." };
      cleaned.title = trimmed;
    }
    if (patch.type !== undefined) {
      if (!PRODUCT_TYPES.includes(patch.type)) {
        return { success: false, error: "Invalid product type." };
      }
      cleaned.type = patch.type;
    }
    if (patch.shortDescription !== undefined) {
      const trimmed = patch.shortDescription.trim();
      if (!trimmed)
        return { success: false, error: "Short description cannot be empty." };
      if (trimmed.length > 200) {
        return {
          success: false,
          error: "Short description must be 200 characters or fewer.",
        };
      }
      cleaned.shortDescription = trimmed;
    }
    if (patch.longDescriptionHtml !== undefined) {
      cleaned.longDescriptionHtml = patch.longDescriptionHtml;
    }
    if (patch.priceCents !== undefined) {
      if (
        typeof patch.priceCents !== "number" ||
        !Number.isFinite(patch.priceCents) ||
        patch.priceCents < 0
      ) {
        return {
          success: false,
          error: "Price must be a non-negative number.",
        };
      }
      cleaned.priceCents = Math.round(patch.priceCents);
    }
    if (patch.heroImageUrl !== undefined) {
      cleaned.heroImageUrl =
        patch.heroImageUrl === null || patch.heroImageUrl === ""
          ? FieldValue.delete()
          : patch.heroImageUrl;
    }
    if (patch.galleryImageUrls !== undefined) {
      cleaned.galleryImageUrls = patch.galleryImageUrls.filter(
        (u) => typeof u === "string" && u.trim().length > 0
      );
    }
    if (patch.status !== undefined) {
      if (!PRODUCT_STATUSES.includes(patch.status)) {
        return { success: false, error: "Invalid status." };
      }
      cleaned.status = patch.status;
    }
    if (patch.fileSizeBytes !== undefined) {
      cleaned.fileSizeBytes = patch.fileSizeBytes;
    }

    cleaned.updatedAt = FieldValue.serverTimestamp();
    await productsCol().doc(id).update(cleaned);

    revalidatePath("/admin/shop");
    revalidatePath(`/admin/shop/${id}`);
    revalidatePath("/shop");
    revalidatePath(`/shop/${existing.slug}`);
    return { success: true };
  } catch (err) {
    console.error("updateProductAction error:", err);
    return { success: false, error: "Failed to update product." };
  }
}

// ─── Publish ───────────────────────────────────────────────────────────────

/**
 * Flips a product to PUBLISHED. If the product does not yet have a Stripe
 * Payment Link, this creates one and stores the price + payment-link ids on
 * the doc. Idempotent — re-publishing an already-published product just
 * ensures it has a payment link.
 */
export async function publishProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getProduct(id);
    if (!existing) return { success: false, error: "Product not found." };

    if (!existing.priceCents || existing.priceCents <= 0) {
      return {
        success: false,
        error: "Set a non-zero price before publishing.",
      };
    }

    const patch: Partial<ProductDoc> = {
      status: "PUBLISHED",
    };

    // Mint the Stripe payment link if missing.
    if (!existing.stripePaymentLinkUrl) {
      const link = await createProductPaymentLink({
        productId: existing.id,
        productTitle: existing.title,
        amountCents: existing.priceCents,
      });
      patch.stripePaymentLinkUrl = link.paymentLinkUrl;
      patch.stripePaymentLinkId = link.paymentLinkId;
      patch.stripePriceId = link.priceId;
    }

    await dbUpdateProduct(id, patch);

    await logActivity("NOTE_ADDED", `Product published: ${existing.title}`, {
      productId: id,
      slug: existing.slug,
    }).catch(() => {});

    revalidatePath("/admin/shop");
    revalidatePath(`/admin/shop/${id}`);
    revalidatePath("/shop");
    revalidatePath(`/shop/${existing.slug}`);
    return { success: true };
  } catch (err) {
    console.error("publishProductAction error:", err);
    return { success: false, error: "Failed to publish product." };
  }
}

// ─── Archive ───────────────────────────────────────────────────────────────

export async function archiveProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getProduct(id);
    if (!existing) return { success: false, error: "Product not found." };

    await dbUpdateProduct(id, { status: "ARCHIVED" });

    await logActivity("NOTE_ADDED", `Product archived: ${existing.title}`, {
      productId: id,
      slug: existing.slug,
    }).catch(() => {});

    revalidatePath("/admin/shop");
    revalidatePath(`/admin/shop/${id}`);
    revalidatePath("/shop");
    revalidatePath(`/shop/${existing.slug}`);
    return { success: true };
  } catch (err) {
    console.error("archiveProductAction error:", err);
    return { success: false, error: "Failed to archive product." };
  }
}

// ─── Delete ────────────────────────────────────────────────────────────────

export async function deleteProductAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  try {
    const existing = await getProduct(id);
    if (!existing) return { success: false, error: "Product not found." };

    await dbDeleteProduct(id);

    await logActivity("NOTE_ADDED", `Product deleted: ${existing.title}`, {
      productId: id,
      slug: existing.slug,
    }).catch(() => {});

    revalidatePath("/admin/shop");
    revalidatePath("/shop");
    revalidatePath(`/shop/${existing.slug}`);
    return { success: true };
  } catch (err) {
    console.error("deleteProductAction error:", err);
    return { success: false, error: "Failed to delete product." };
  }
}

// ─── Replace deliverable file ──────────────────────────────────────────────

export type ProductFileUrlResult =
  | { success: true; uploadUrl: string; r2Key: string }
  | { success: false; error: string };

/**
 * Issues a new presigned PUT URL targeting a fresh time-stamped key in
 * `products/{slug}/`. The product doc's `fileR2Key` is updated to the new
 * key so future deliveries serve the replaced file.
 */
export async function getR2PutUrlForProductFile(
  productId: string,
  contentType: string,
  fileName?: string
): Promise<ProductFileUrlResult> {
  await requireAdmin();

  try {
    const existing = await getProduct(productId);
    if (!existing) return { success: false, error: "Product not found." };

    const safeName = sanitiseFileName(
      (fileName ?? "").trim() || `${existing.slug}.zip`
    );
    const key = `products/${existing.slug}/${Date.now()}-${safeName}`;

    const { presignedUrl } = await generatePresignedUploadUrl({
      key,
      contentType: contentType?.trim() || "application/zip",
      eventId: `product-${existing.slug}`,
    });

    await productsCol().doc(productId).update({
      fileR2Key: key,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath("/admin/shop");
    revalidatePath(`/admin/shop/${productId}`);
    return { success: true, uploadUrl: presignedUrl, r2Key: key };
  } catch (err) {
    console.error("getR2PutUrlForProductFile error:", err);
    return { success: false, error: "Failed to issue upload URL." };
  }
}

// ─── Convenience redirect wrapper for <form> action ────────────────────────

export async function createProductRedirectAction(
  input: CreateProductInput
): Promise<void> {
  const res = await createProductAction(input);
  if (res.success) {
    redirect(`/admin/shop/${res.id}`);
  }
}

// Re-export types so consumers can import the doc shape from this module.
export type { ProductDoc, ProductStatus, ProductType };
