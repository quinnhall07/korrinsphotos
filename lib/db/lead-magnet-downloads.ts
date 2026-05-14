// lib/db/lead-magnet-downloads.ts
// Per-gate analytics log for `leadMagnets` — one row per successful download
// gating. Denormalises slug + first-touch attribution + UA so the admin
// detail page can read recent activity without joining.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export interface LeadMagnetDownloadDoc {
  id: string;
  leadMagnetId: string;
  leadMagnetSlug: string; // denormalized for cheap reads
  email: string;
  firstName?: string;
  clientId?: string; // resolved after upsert
  firstTouchSource?: string; // from __origin cookie
  firstTouchMedium?: string;
  firstTouchCampaign?: string;
  firstTouchLandingUrl?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Timestamp;
}

export const leadMagnetDownloadsCol = () =>
  adminDb.collection("leadMagnetDownloads");

export async function recordLeadMagnetDownload(
  data: Omit<LeadMagnetDownloadDoc, "id" | "createdAt">
): Promise<LeadMagnetDownloadDoc> {
  const ref = leadMagnetDownloadsCol().doc();
  const now = Timestamp.now();
  const cleaned: Record<string, unknown> = { createdAt: now };
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined && v !== null && v !== "") {
      cleaned[k] = v;
    }
  }
  await ref.set(cleaned);
  return { id: ref.id, ...(cleaned as Omit<LeadMagnetDownloadDoc, "id">) };
}

export async function listDownloadsForMagnet(
  magnetId: string,
  limit: number = 50
): Promise<LeadMagnetDownloadDoc[]> {
  const snap = await leadMagnetDownloadsCol()
    .where("leadMagnetId", "==", magnetId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as LeadMagnetDownloadDoc)
  );
}

export async function countDownloadsForMagnet(
  magnetId: string
): Promise<number> {
  const snap = await leadMagnetDownloadsCol()
    .where("leadMagnetId", "==", magnetId)
    .count()
    .get();
  return snap.data().count;
}
