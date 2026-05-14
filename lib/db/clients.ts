import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { Role } from "./users";

export type LeadSource = "WEBSITE" | "INSTAGRAM" | "GOOGLE" | "REFERRAL" | "DIRECT" | "OTHER";

/**
 * Phase 13.6 — recurring revenue cadence.
 *
 * Drives the re-engagement prompts that surface in the admin inbox on or
 * near the anniversary of a delivered shoot. `NONE` (or absent) opts the
 * client out entirely. Defaulted to `ANNUAL` for Family/Portrait/
 * Engagement/Wedding session types when `onGalleryDelivered` fires, unless
 * the admin has already chosen a value.
 */
export type RecurringCadence = "ANNUAL" | "SEMI_ANNUAL" | "NONE";

export type ReferralRewardKind = "CREDIT" | "MINI_SESSION" | "GIFT";

/**
 * Referral reward log entry.
 *
 * `referralCredit` on the parent client is stored in **cents** (matches the
 * existing `referralCredit: number // in cents` invariant and `InvoiceDoc.amountCents`).
 * Tier rewards that deliver dollars use `rewardKind: "CREDIT"` and set
 * `amountCents`. Non-monetary tiers (mini-session, printed album) record
 * the human-readable description in `reward` and omit `amountCents`.
 *
 * `at` and `grantedAt` are kept as aliases for backwards compatibility —
 * the engine writes both on new entries.
 */
export interface ReferralRewardLogEntry {
  at: Timestamp;
  grantedAt?: Timestamp;
  tier: number;
  rewardKind: ReferralRewardKind;
  reward: string;
  amountCents?: number;
  projectId?: string;
}

export type LifecycleStage = "INQUIRED" | "BOOKED" | "DELIVERED" | "REPEAT" | "CHURNED";

export interface ClientDoc {
  id: string; // Firebase UID once registered, otherwise generated
  email: string; // UNIQUE
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: Role;
  referralCode: string;
  referredBy?: string | null;
  referralCredit: number; // in cents
  totalSessionsBooked: number;
  firstTouchSource: LeadSource;
  firstTouchMedium?: string | null;
  firstTouchCampaign?: string | null;
  firstTouchLandingUrl?: string | null;
  firstTouchAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  referralCount?: number;
  referralTier?: 1 | 2 | 3 | 4 | 5;
  referralRewardsLog?: ReferralRewardLogEntry[];
  /** Tracks which refereeProjectIds have already been credited to this referrer. Idempotency guard. */
  referralAttributions?: string[];
  smsConsent?: boolean;
  lifecycleStage?: LifecycleStage;
  lifeEventTags?: string[];
  instagramHandle?: string;
  /**
   * Phase 13.6 — recurring revenue layer. Cadence controls whether (and how
   * often) the cron sweep enqueues a `RE_ENGAGEMENT_DUE` inbox prompt for
   * Korrin. `recurringNextPromptAt` is the next time the sweep should fire;
   * `lastReengagementInboxItemAt` is the idempotency guard so two cron runs
   * within 30 days do not double-queue. `recurringPromptsSent` is a simple
   * lifetime counter — useful for dashboards / debugging.
   */
  recurringCadence?: RecurringCadence;
  recurringNextPromptAt?: Timestamp;
  recurringPromptsSent?: number;
  lastReengagementInboxItemAt?: Timestamp;
  /**
   * Phase 3.11 — sales tax engine.
   *
   * Two-letter USPS state code (e.g. "NC") used to look up the applicable
   * sales-tax rule when an invoice is generated. Falls back to the project's
   * shoot location state, then the admin's `taxConfig.defaultBusinessStateCode`.
   */
  billingStateCode?: string;
}

/**
 * Tiered referral rewards (Phase 4.4).
 *
 * Tiers are 1-indexed and triggered the moment `referralCount` crosses the
 * tier threshold (count >= tier). Tier 4 is intentionally a "silent" level
 * with no extra reward — Tier 5 is the climax (printed album). Add to this
 * table to add new rungs.
 */
export type ReferralTier = 1 | 2 | 3 | 4 | 5;

export interface ReferralTierReward {
  tier: ReferralTier;
  rewardKind: ReferralRewardKind;
  reward: string;
  amountCents?: number;
}

export const REFERRAL_TIER_REWARDS: Record<ReferralTier, ReferralTierReward> = {
  1: { tier: 1, rewardKind: "CREDIT", reward: "$50 credit", amountCents: 5000 },
  2: { tier: 2, rewardKind: "CREDIT", reward: "$100 credit", amountCents: 10000 },
  3: { tier: 3, rewardKind: "MINI_SESSION", reward: "Free mini-session voucher" },
  4: { tier: 4, rewardKind: "CREDIT", reward: "Loyalty tier" },
  5: { tier: 5, rewardKind: "GIFT", reward: "Printed album gift" },
};

export const clientsCol = () => adminDb.collection("clients");

export async function getClient(id: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ClientDoc) : null;
}

export async function getClientByEmail(email: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().where("email", "==", email).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ClientDoc;
}

export async function getClientByReferralCode(referralCode: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().where("referralCode", "==", referralCode).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() } as ClientDoc;
}

export function generateReferralCode(firstName: string): string {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const randomChars = Math.random().toString(36).substring(2, 6);
  return `${slug}-${randomChars}`;
}

/* ─── Phase 13.6 — recurring revenue helpers ─────────────────────────────── */

/**
 * Set (or clear) the client's recurring re-engagement cadence. Bumps
 * `updatedAt` via `serverTimestamp()`. Does NOT touch
 * `recurringNextPromptAt` — that is owned by the cron sweep and the
 * gallery-delivered lifecycle hook.
 */
export async function setClientRecurringCadence(
  clientId: string,
  cadence: RecurringCadence
): Promise<void> {
  await clientsCol().doc(clientId).update({
    recurringCadence: cadence,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Advance `recurringNextPromptAt` to the given moment. Used by the cron
 * sweep (after a prompt fires) and by `dismissReengagementPrompt` (snooze).
 */
export async function bumpRecurringNextPromptAt(
  clientId: string,
  next: Date | Timestamp
): Promise<void> {
  const value =
    next instanceof Timestamp ? next : Timestamp.fromDate(next);
  await clientsCol().doc(clientId).update({
    recurringNextPromptAt: value,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
