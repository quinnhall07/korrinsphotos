import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";
import type { Role } from "./users";

export type LeadSource = "WEBSITE" | "INSTAGRAM" | "GOOGLE" | "REFERRAL" | "DIRECT" | "OTHER";

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
