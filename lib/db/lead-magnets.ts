// lib/db/lead-magnets.ts
// Lead magnets: gated downloadable assets (pricing guides, prep guides) that
// trade for an email + first-touch attribution and auto-enroll the visitor
// into a follow-up sequence. One file per Firestore collection per
// `lib/db/CLAUDE.md`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type LeadMagnetStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export const LEAD_MAGNET_STATUSES: LeadMagnetStatus[] = [
  "ACTIVE",
  "DRAFT",
  "ARCHIVED",
];

export interface LeadMagnetDoc {
  id: string;
  slug: string; // URL-safe; immutable post-create
  title: string;
  description: string;
  coverImageId?: string | null; // Cloudflare Images id (optional)
  r2Key: string; // path inside `lead-magnets/` in R2
  downloadFileName: string; // e.g. "Korrin-Pricing-Guide-2026.pdf"
  followUpSequenceId?: string | null;
  status: LeadMagnetStatus;
  downloadCount: number; // incremented on every successful gate
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const leadMagnetsCol = () => adminDb.collection("leadMagnets");

export async function getLeadMagnet(
  id: string
): Promise<LeadMagnetDoc | null> {
  const snap = await leadMagnetsCol().doc(id).get();
  return snap.exists
    ? ({ id: snap.id, ...snap.data() } as LeadMagnetDoc)
    : null;
}

export async function getLeadMagnetBySlug(
  slug: string
): Promise<LeadMagnetDoc | null> {
  const snap = await leadMagnetsCol()
    .where("slug", "==", slug)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as LeadMagnetDoc;
}

export async function listLeadMagnets(): Promise<LeadMagnetDoc[]> {
  const snap = await leadMagnetsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadMagnetDoc));
}

export async function listActiveLeadMagnets(): Promise<LeadMagnetDoc[]> {
  const snap = await leadMagnetsCol()
    .where("status", "==", "ACTIVE")
    .orderBy("createdAt", "desc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LeadMagnetDoc));
}

export async function createLeadMagnet(
  data: Omit<LeadMagnetDoc, "id" | "createdAt" | "updatedAt" | "downloadCount"> & {
    downloadCount?: number;
  }
): Promise<LeadMagnetDoc> {
  const ref = leadMagnetsCol().doc();
  const now = Timestamp.now();
  const fullData = {
    downloadCount: 0,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as LeadMagnetDoc;
}

export async function updateLeadMagnet(
  id: string,
  data: Partial<Omit<LeadMagnetDoc, "id" | "createdAt" | "slug">>
): Promise<void> {
  await leadMagnetsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteLeadMagnet(id: string): Promise<void> {
  await leadMagnetsCol().doc(id).delete();
}

/**
 * Idempotent `+1` on `downloadCount`. Best-effort — callers should not block
 * the user-facing download URL on this write succeeding.
 */
export async function incrementDownloadCount(id: string): Promise<void> {
  await leadMagnetsCol().doc(id).update({
    downloadCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
