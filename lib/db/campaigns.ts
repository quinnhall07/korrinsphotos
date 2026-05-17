// lib/db/campaigns.ts
// Campaign / venue landing-page CMS (Phase 4.9). Each `campaigns/{id}` doc
// powers one focused public landing page at `/c/{slug}` (Google Ads target,
// IG-bio link, vendor partnership, etc). Carries its own hero, copy, default
// UTM, and inquiry-form prefills.
//
// Server-only: imports `adminDb`. Never import from a `"use client"` file.
// One file per Firestore collection per `lib/db/CLAUDE.md` — no aggregator.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

export const CAMPAIGN_STATUSES: CampaignStatus[] = ["DRAFT", "ACTIVE", "ARCHIVED"];

/**
 * Default UTM tuple stamped onto inquiries originating from this campaign.
 * Stored verbatim on `clients/{id}.firstTouch{Source,Medium,Campaign}` when
 * the booking submission carries the `__campaign` cookie set by the landing
 * page. Free-form strings (e.g. `"venue:bradford"`) so we can tag vendor
 * partnerships without bloating the closed `LeadSource` union on
 * `lib/db/clients.ts`.
 */
export interface CampaignDefaultUtm {
  source: string; // "google", "instagram", "venue:bradford", etc.
  medium: string; // "cpc", "bio", "partnership"
  campaign: string; // "wedding-2026-q1"
}

/**
 * Optional booking-form prefill applied when the visitor clicks the CTA. The
 * `packageSlug` matches `/investment` (`mini` | `story` | `day`) and threads
 * through to `?package=` on `/booking`, which already pre-selects the
 * matching session type tile.
 */
export interface CampaignInquiryPrefill {
  sessionType?: string;
  packageSlug?: string;
}

export interface CampaignDoc {
  id: string;
  slug: string; // /c/{slug}; immutable post-create; URL-safe
  status: CampaignStatus;
  title: string;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroPhotoCloudflareId?: string | null;
  bodyHtml: string; // free-form HTML body (rendered via dangerouslySetInnerHTML)
  ctaText: string; // "Inquire about your wedding"
  ctaHref?: string | null; // defaults to /booking?campaign={slug}&package=…
  galleryCategory?: string | null; // filters the embedded 6-photo strip
  defaultUtm: CampaignDefaultUtm;
  inquiryPrefill?: CampaignInquiryPrefill | null;
  visitCount: number; // bumped server-side on each `/c/{slug}` render
  inquiryCount: number; // bumped when an inquiry carries the `__campaign` cookie
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const campaignsCol = () => adminDb.collection("campaigns");

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function getCampaign(id: string): Promise<CampaignDoc | null> {
  const snap = await campaignsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as CampaignDoc) : null;
}

export async function getCampaignBySlug(slug: string): Promise<CampaignDoc | null> {
  const trimmed = slug?.trim();
  if (!trimmed) return null;
  const snap = await campaignsCol().where("slug", "==", trimmed).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as CampaignDoc;
}

export async function listCampaigns(status?: CampaignStatus): Promise<CampaignDoc[]> {
  let q: FirebaseFirestore.Query = campaignsCol();
  if (status) q = q.where("status", "==", status);
  const snap = await q.orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampaignDoc));
}

export async function listActiveCampaigns(): Promise<CampaignDoc[]> {
  return listCampaigns("ACTIVE");
}

// ─── Writes ────────────────────────────────────────────────────────────────

/**
 * Creates a campaign. The caller MUST pre-check slug uniqueness with
 * `getCampaignBySlug(slug)` — Firestore will not enforce it for us.
 * `visitCount` / `inquiryCount` default to 0.
 */
export async function createCampaign(
  data: Omit<CampaignDoc, "id" | "createdAt" | "updatedAt" | "visitCount" | "inquiryCount"> & {
    visitCount?: number;
    inquiryCount?: number;
  }
): Promise<CampaignDoc> {
  const ref = campaignsCol().doc();
  const now = Timestamp.now();
  const fullData = {
    visitCount: 0,
    inquiryCount: 0,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as CampaignDoc;
}

/**
 * Patches mutable fields on a campaign. `slug` is intentionally locked post-
 * create so existing `/c/{slug}` permalinks and the cookie value stay valid.
 */
export async function updateCampaign(
  id: string,
  data: Partial<Omit<CampaignDoc, "id" | "createdAt" | "slug">>
): Promise<void> {
  await campaignsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteCampaign(id: string): Promise<void> {
  await campaignsCol().doc(id).delete();
}

// ─── Counters ──────────────────────────────────────────────────────────────

/**
 * Best-effort visit counter. Eventually consistent — Firestore `increment`
 * is atomic but we deliberately don't `await` this on the render path; race
 * conditions across concurrent reads are acceptable for marketing metrics.
 * Returns void; callers MUST wrap in try/catch.
 */
export async function incrementCampaignVisit(slug: string): Promise<void> {
  const trimmed = slug?.trim();
  if (!trimmed) return;
  const snap = await campaignsCol().where("slug", "==", trimmed).limit(1).get();
  if (snap.empty) return;
  await snap.docs[0].ref.update({
    visitCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Best-effort inquiry counter. Called from `submitBooking` when the
 * `__campaign` cookie resolves to a known slug.
 */
export async function incrementCampaignInquiry(slug: string): Promise<void> {
  const trimmed = slug?.trim();
  if (!trimmed) return;
  const snap = await campaignsCol().where("slug", "==", trimmed).limit(1).get();
  if (snap.empty) return;
  await snap.docs[0].ref.update({
    inquiryCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
