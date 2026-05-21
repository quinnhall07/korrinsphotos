// lib/db/site-assets.ts
// Global photo library for the site editor — not tied to any event.
// Server-only. Pipeline mirrors /api/upload + /api/upload/confirm but writes to siteAssets/{id}.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export interface SiteAssetDoc {
  id: string;
  cloudflareImageId: string;
  cloudflareUrl: string;
  r2Key: string;
  label: string;
  altText: string;
  uploadedByUid: string;
  uploadedAt: Timestamp;
}

export const siteAssetsCol = () => adminDb.collection("siteAssets");

export async function getSiteAsset(id: string): Promise<SiteAssetDoc | null> {
  const snap = await siteAssetsCol().doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as Omit<SiteAssetDoc, "id">) };
}

export async function listSiteAssets(limit = 60): Promise<SiteAssetDoc[]> {
  const snap = await siteAssetsCol()
    .orderBy("uploadedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SiteAssetDoc, "id">) }));
}

export async function createSiteAsset(input: {
  cloudflareImageId: string;
  cloudflareUrl: string;
  r2Key: string;
  label: string;
  altText: string;
  uploadedByUid: string;
}): Promise<SiteAssetDoc> {
  const ref = siteAssetsCol().doc();
  const now = Timestamp.now();
  await ref.set({
    cloudflareImageId: input.cloudflareImageId,
    cloudflareUrl: input.cloudflareUrl,
    r2Key: input.r2Key,
    label: input.label,
    altText: input.altText,
    uploadedByUid: input.uploadedByUid,
    uploadedAt: FieldValue.serverTimestamp(),
  });
  return {
    id: ref.id,
    cloudflareImageId: input.cloudflareImageId,
    cloudflareUrl: input.cloudflareUrl,
    r2Key: input.r2Key,
    label: input.label,
    altText: input.altText,
    uploadedByUid: input.uploadedByUid,
    uploadedAt: now,
  };
}

export async function deleteSiteAsset(id: string): Promise<void> {
  await siteAssetsCol().doc(id).delete();
}

export interface ProjectPhotoSummary {
  photoId: string;
  eventId: string;
  cloudflareImageId: string;
  label: string | null;
  category: string | null;
}

export async function listProjectPhotos(limit = 60): Promise<ProjectPhotoSummary[]> {
  // Mirrors the index profile used by /app/page.tsx and /app/portfolio/page.tsx
  // (where("category","!=",null) + orderBy(category) + orderBy(uploadedAt))
  // so no new composite index is required.
  const snap = await adminDb
    .collectionGroup("photos")
    .where("category", "!=", null)
    .orderBy("category")
    .orderBy("uploadedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      const eventId = d.ref.parent.parent?.id;
      if (!eventId || !data.cloudflareImageId) return null;
      return {
        photoId: d.id,
        eventId,
        cloudflareImageId: data.cloudflareImageId as string,
        label: (data.label as string | null) ?? null,
        category: (data.category as string | null) ?? null,
      } satisfies ProjectPhotoSummary;
    })
    .filter((p): p is ProjectPhotoSummary => p !== null);
}
