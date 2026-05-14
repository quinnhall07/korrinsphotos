import { adminDb } from "@/lib/firebase-admin";
import type { Timestamp } from "firebase-admin/firestore";
import type { Role } from "./users";

export type LeadSource = "WEBSITE" | "INSTAGRAM" | "GOOGLE" | "REFERRAL" | "DIRECT" | "OTHER";

export type ReferralRewardKind = "CREDIT" | "MINI_SESSION" | "GIFT";

export interface ReferralRewardLogEntry {
  at: Timestamp;
  tier: number;
  rewardKind: ReferralRewardKind;
  amountCents?: number;
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
  smsConsent?: boolean;
  lifecycleStage?: LifecycleStage;
  lifeEventTags?: string[];
  instagramHandle?: string;
}

export const clientsCol = () => adminDb.collection("clients");

export async function getClient(id: string): Promise<ClientDoc | null> {
  const snap = await clientsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ClientDoc) : null;
}

export function generateReferralCode(firstName: string): string {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const randomChars = Math.random().toString(36).substring(2, 6);
  return `${slug}-${randomChars}`;
}
