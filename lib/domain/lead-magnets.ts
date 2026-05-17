// lib/domain/lead-magnets.ts
// Cross-collection orchestration for gated lead-magnet downloads.
//
// `gateLeadMagnetDownload` is the single entry point used by the public
// `/magnet/[slug]` Server Action. It:
//   1. Looks up the magnet by slug and asserts ACTIVE status.
//   2. Upserts a `clients/{clientId}` doc (email = key), stamping first-touch
//      attribution from the `__origin` cookie on the create path only.
//   3. Records a `leadMagnetDownloads` analytics row.
//   4. Bumps the magnet's `downloadCount`.
//   5. If `followUpSequenceId` is set, enrolls the client into the sequence
//      with `projectId: null` (lead magnets capture clients, not projects —
//      `enrollInSequence` already supports `projectId?: string | null`).
//   6. Generates an 8-hour presigned R2 GET URL for the file.

import { Timestamp, FieldValue } from "firebase-admin/firestore";
import {
  getLeadMagnetBySlug,
  incrementDownloadCount,
  type LeadMagnetDoc,
} from "@/lib/db/lead-magnets";
import { recordLeadMagnetDownload } from "@/lib/db/lead-magnet-downloads";
import {
  clientsCol,
  getClientByEmail,
  generateReferralCode,
  type LeadSource,
} from "@/lib/db/clients";
import { enrollInSequence } from "@/lib/db/sequence-enrollments";
import { generatePresignedGetUrl } from "@/lib/storage/r2";

/**
 * Shape of the `__origin` cookie written by `middleware.ts`. Mirrors the
 * fields stamped onto `clients/{id}` on first-touch creation.
 */
export interface OriginCookie {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  referralCode?: string | null;
  landingUrl?: string | null;
  ts?: number | null;
}

export interface GateInput {
  slug: string;
  email: string;
  firstName?: string;
  originCookie: OriginCookie | null;
  ip?: string;
  userAgent?: string;
}

export interface GateResult {
  downloadUrl: string;
  magnet: LeadMagnetDoc;
}

/** 8 hours, in seconds. */
const DOWNLOAD_URL_TTL_SECONDS = 8 * 60 * 60;

const LEAD_SOURCES: readonly LeadSource[] = [
  "WEBSITE",
  "INSTAGRAM",
  "GOOGLE",
  "REFERRAL",
  "DIRECT",
  "OTHER",
];

function normaliseLeadSource(raw: string | null | undefined): LeadSource {
  if (!raw) return "WEBSITE";
  const upper = raw.toUpperCase();
  return (LEAD_SOURCES as readonly string[]).includes(upper)
    ? (upper as LeadSource)
    : "WEBSITE";
}

/**
 * Upsert a client by email. Returns the clientId. On the *create* path the
 * function stamps first-touch attribution from the supplied `__origin`
 * cookie; on the *update* path it leaves first-touch untouched (ADR-016 —
 * first-touch is immutable).
 */
async function upsertClientByEmail(args: {
  email: string;
  firstName?: string;
  originCookie: OriginCookie | null;
}): Promise<string> {
  const existing = await getClientByEmail(args.email);
  if (existing) return existing.id;

  const firstName = (args.firstName ?? "").trim() || "Friend";
  const referralCode = generateReferralCode(firstName);

  const origin = args.originCookie ?? {};
  const firstTouchSource = normaliseLeadSource(origin.source ?? null);
  const firstTouchAt =
    typeof origin.ts === "number" && Number.isFinite(origin.ts)
      ? Timestamp.fromDate(new Date(origin.ts))
      : Timestamp.now();

  const ref = clientsCol().doc();
  await ref.set({
    email: args.email,
    firstName,
    lastName: "",
    phone: null,
    role: "CLIENT",
    referralCode,
    referredBy:
      typeof origin.referralCode === "string" && origin.referralCode.trim()
        ? null // referrer resolution happens in booking; lead magnets stay neutral
        : null,
    referralCredit: 0,
    totalSessionsBooked: 0,
    firstTouchSource,
    firstTouchMedium: origin.medium ?? null,
    firstTouchCampaign: origin.campaign ?? null,
    firstTouchLandingUrl: origin.landingUrl ?? null,
    firstTouchAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

/**
 * Gate a lead-magnet download. Throws on lookup miss or non-ACTIVE status.
 * Everything else is best-effort — a sequence enrollment failure does not
 * block the download URL.
 */
export async function gateLeadMagnetDownload(
  input: GateInput
): Promise<GateResult> {
  const slug = input.slug.trim();
  const email = input.email.trim().toLowerCase();
  if (!slug) throw new Error("Magnet slug is required.");
  if (!email) throw new Error("Email is required.");

  const magnet = await getLeadMagnetBySlug(slug);
  if (!magnet) throw new Error(`Lead magnet "${slug}" not found.`);
  if (magnet.status !== "ACTIVE") {
    throw new Error(`Lead magnet "${slug}" is not active.`);
  }

  // 1. Upsert client.
  const clientId = await upsertClientByEmail({
    email,
    firstName: input.firstName,
    originCookie: input.originCookie,
  });

  // 2. Record the download analytics row.
  await recordLeadMagnetDownload({
    leadMagnetId: magnet.id,
    leadMagnetSlug: magnet.slug,
    email,
    firstName: input.firstName?.trim() || undefined,
    clientId,
    firstTouchSource: input.originCookie?.source ?? undefined,
    firstTouchMedium: input.originCookie?.medium ?? undefined,
    firstTouchCampaign: input.originCookie?.campaign ?? undefined,
    firstTouchLandingUrl: input.originCookie?.landingUrl ?? undefined,
    ip: input.ip,
    userAgent: input.userAgent,
  }).catch((err) => {
    console.error("recordLeadMagnetDownload failed", { magnetId: magnet.id, err });
  });

  // 3. Bump the download counter — best-effort.
  await incrementDownloadCount(magnet.id).catch((err) => {
    console.error("incrementDownloadCount failed", { magnetId: magnet.id, err });
  });

  // 4. Enroll into the follow-up sequence if configured. Lead magnets capture
  //    clients without a project context, so we pass `projectId: null` — the
  //    existing `enrollInSequence` helper already supports that case.
  if (magnet.followUpSequenceId) {
    try {
      await enrollInSequence({
        sequenceId: magnet.followUpSequenceId,
        clientId,
        projectId: null,
      });
    } catch (err) {
      console.error("enrollInSequence (lead magnet) failed", {
        magnetId: magnet.id,
        sequenceId: magnet.followUpSequenceId,
        clientId,
        err,
      });
    }
  }

  // 5. Mint the short-lived download URL. The presigned URL leaks the bucket
  //    layout — that is the deliberate trade for not proxying through Vercel.
  const downloadUrl = await generatePresignedGetUrl(
    magnet.r2Key,
    DOWNLOAD_URL_TTL_SECONDS
  );

  return { downloadUrl, magnet };
}
