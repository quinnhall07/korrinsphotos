// lib/db/products.ts
// Digital products store (Phase 4.13). Two collections live here for
// convenience: `products` (catalog) and `productPurchases` (purchase ledger
// for post-Stripe delivery). They are tightly coupled — the webhook reads a
// product to know which R2 key to deliver, and writes a purchase row keyed
// off the Stripe checkout session id for idempotency.
//
// Server-only — uses `adminDb`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Catalog ────────────────────────────────────────────────────────────────

export type ProductType =
  | "PRESET_DESKTOP"
  | "PRESET_MOBILE"
  | "COURSE"
  | "EBOOK"
  | "OTHER";

export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export const PRODUCT_TYPES: ProductType[] = [
  "PRESET_DESKTOP",
  "PRESET_MOBILE",
  "COURSE",
  "EBOOK",
  "OTHER",
];

export const PRODUCT_STATUSES: ProductStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
];

export interface ProductDoc {
  id: string;
  slug: string; // url-safe; locked after create
  title: string;
  type: ProductType;
  status: ProductStatus;
  shortDescription: string;
  longDescriptionHtml: string;
  priceCents: number;
  heroImageUrl?: string;
  galleryImageUrls?: string[];
  fileR2Key: string;
  fileSizeBytes?: number;
  stripePaymentLinkUrl?: string;
  stripePaymentLinkId?: string;
  stripePriceId?: string;
  purchaseCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const productsCol = () => adminDb.collection("products");

export async function getProduct(id: string): Promise<ProductDoc | null> {
  const snap = await productsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ProductDoc) : null;
}

export async function getProductBySlug(
  slug: string
): Promise<ProductDoc | null> {
  const snap = await productsCol().where("slug", "==", slug).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ProductDoc;
}

export async function listProducts(opts?: {
  status?: ProductStatus;
}): Promise<ProductDoc[]> {
  let q: FirebaseFirestore.Query = productsCol();
  if (opts?.status) q = q.where("status", "==", opts.status);
  const snap = await q.orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProductDoc));
}

export async function listPublishedProducts(): Promise<ProductDoc[]> {
  return listProducts({ status: "PUBLISHED" });
}

export async function createProduct(
  data: Omit<ProductDoc, "id" | "createdAt" | "updatedAt" | "purchaseCount"> & {
    purchaseCount?: number;
  }
): Promise<ProductDoc> {
  const ref = productsCol().doc();
  const now = Timestamp.now();
  const fullData = {
    purchaseCount: 0,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as ProductDoc;
}

export async function updateProduct(
  id: string,
  data: Partial<Omit<ProductDoc, "id" | "createdAt" | "slug">>
): Promise<void> {
  await productsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteProduct(id: string): Promise<void> {
  await productsCol().doc(id).delete();
}

/**
 * Idempotent `+1` on `purchaseCount`. Best-effort — never block delivery on
 * this write succeeding.
 */
export async function incrementPurchaseCount(id: string): Promise<void> {
  await productsCol().doc(id).update({
    purchaseCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

// ─── Purchases ──────────────────────────────────────────────────────────────

export interface ProductPurchaseDoc {
  id: string;
  productId: string;
  productSlug: string;
  buyerEmail: string;
  buyerName?: string;
  amountCents: number;
  stripeCheckoutSessionId: string;
  deliveryR2Key: string;
  deliveredAt?: Timestamp;
  createdAt: Timestamp;
}

export const productPurchasesCol = () =>
  adminDb.collection("productPurchases");

export async function getPurchaseBySessionId(
  sessionId: string
): Promise<ProductPurchaseDoc | null> {
  const snap = await productPurchasesCol()
    .where("stripeCheckoutSessionId", "==", sessionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ProductPurchaseDoc;
}

/**
 * Idempotent on `stripeCheckoutSessionId`. If a purchase already exists for
 * the given session, returns it without writing.
 */
export async function recordProductPurchase(
  data: Omit<ProductPurchaseDoc, "id" | "createdAt" | "deliveredAt">
): Promise<ProductPurchaseDoc> {
  const existing = await getPurchaseBySessionId(data.stripeCheckoutSessionId);
  if (existing) return existing;

  const ref = productPurchasesCol().doc();
  const now = Timestamp.now();
  const cleaned: Record<string, unknown> = { createdAt: now };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && v !== "") {
      cleaned[k] = v;
    }
  }
  await ref.set(cleaned);
  return { id: ref.id, ...(cleaned as Omit<ProductPurchaseDoc, "id">) };
}

export async function markPurchaseDelivered(id: string): Promise<void> {
  await productPurchasesCol().doc(id).update({
    deliveredAt: FieldValue.serverTimestamp(),
  });
}
