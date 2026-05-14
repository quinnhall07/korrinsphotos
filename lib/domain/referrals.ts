/**
 * Tiered referral engine.
 *
 * Server-only. Crosses `clients/` + `projects/` + `mail/` and the
 * `REFERRAL_TIER_REWARDS` constant in `lib/db/clients.ts`. Lives in
 * `lib/domain/` rather than `lib/db/clients.ts` because it spans more
 * than one collection and queues an email side-effect.
 *
 * Idempotency contract: every successful attribution writes the
 * `refereeProjectId` into `clients/{referrerId}.referralAttributions[]`.
 * Re-running the engine for the same `(referrer, refereeProjectId)` pair
 * is a no-op — `referralCount` is not incremented and no extra reward
 * row is added to `referralRewardsLog`. The transaction wraps the read
 * of `referralAttributions` and the write of the new state, so two
 * concurrent invocations cannot both pass the guard.
 *
 * Reward currency: `referralCredit` is stored in **cents** (matches
 * `referralCredit: number // in cents` in `ClientDoc` and
 * `InvoiceDoc.amountCents`).
 */

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  clientsCol,
  REFERRAL_TIER_REWARDS,
  type ClientDoc,
  type ReferralRewardLogEntry,
  type ReferralTier,
  type ReferralTierReward,
} from "@/lib/db/clients";

export type AttributionLookup =
  | { kind: "email"; value: string }
  | { kind: "referralCode"; value: string }
  | { kind: "clientId"; value: string };

export interface ApplyReferralResult {
  applied: boolean;
  reason?:
    | "REFERRER_NOT_FOUND"
    | "ALREADY_ATTRIBUTED"
    | "SELF_REFERRAL"
    | "REFEREE_PROJECT_NOT_FOUND";
  referrerId?: string;
  tierAwarded?: ReferralTier;
  reward?: ReferralTierReward;
  newReferralCount?: number;
}

/**
 * Looks the referrer up. Tries (in order):
 *   1. If the lookup string contains "@", treat as email.
 *   2. Otherwise treat as referralCode.
 *   3. As a final fallback, treat as a raw clientId (`clients/{id}`).
 */
async function resolveReferrer(lookup: string): Promise<ClientDoc | null> {
  const trimmed = lookup.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const snap = await clientsCol().where("email", "==", trimmed).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as ClientDoc;
    }
  } else {
    const snap = await clientsCol().where("referralCode", "==", trimmed).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as ClientDoc;
    }
  }

  // Final fallback — treat as clientId.
  const direct = await clientsCol().doc(trimmed).get();
  if (direct.exists) {
    return { id: direct.id, ...direct.data() } as ClientDoc;
  }
  return null;
}

/**
 * Apply referral attribution for one referee project. Idempotent.
 *
 * @param referrerLookup Email, referralCode, or clientId of the referrer.
 * @param refereeProjectId The booked project that triggered this attribution.
 */
export async function applyReferralAttribution(
  referrerLookup: string,
  refereeProjectId: string,
): Promise<ApplyReferralResult> {
  if (!referrerLookup || !refereeProjectId) {
    return { applied: false, reason: "REFERRER_NOT_FOUND" };
  }

  const referrer = await resolveReferrer(referrerLookup);
  if (!referrer) {
    return { applied: false, reason: "REFERRER_NOT_FOUND" };
  }

  // Refuse to credit a client for referring themselves.
  const projectSnap = await adminDb.collection("projects").doc(refereeProjectId).get();
  if (!projectSnap.exists) {
    return { applied: false, reason: "REFEREE_PROJECT_NOT_FOUND" };
  }
  const refereeClientId = projectSnap.data()?.clientId as string | undefined;
  if (refereeClientId && refereeClientId === referrer.id) {
    return { applied: false, reason: "SELF_REFERRAL", referrerId: referrer.id };
  }

  const referrerRef = clientsCol().doc(referrer.id);

  // Transaction guards against concurrent BOOKED transitions for the same
  // referee project (e.g. Stripe webhook + admin button click racing).
  const txResult = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(referrerRef);
    if (!snap.exists) {
      return { applied: false as const, reason: "REFERRER_NOT_FOUND" as const };
    }
    const data = snap.data() as ClientDoc;
    const alreadyAttributed = (data.referralAttributions ?? []).includes(refereeProjectId);
    if (alreadyAttributed) {
      return {
        applied: false as const,
        reason: "ALREADY_ATTRIBUTED" as const,
        referrerId: referrer.id,
      };
    }

    const previousCount = data.referralCount ?? 0;
    const newCount = previousCount + 1;
    const previousTier = (data.referralTier ?? 0) as 0 | ReferralTier;

    // Determine the highest reward tier that the new count satisfies (count >= tier).
    const allTiers = Object.keys(REFERRAL_TIER_REWARDS)
      .map((k) => Number(k) as ReferralTier)
      .sort((a, b) => a - b);
    const earnedTier = allTiers
      .filter((t) => newCount >= t)
      .reduce<ReferralTier | 0>((acc, t) => (t > acc ? t : acc), 0);

    const update: Record<string, unknown> = {
      referralCount: FieldValue.increment(1),
      referralAttributions: FieldValue.arrayUnion(refereeProjectId),
      updatedAt: FieldValue.serverTimestamp(),
    };

    let rewardAwarded: ReferralTierReward | undefined;
    if (earnedTier && earnedTier > previousTier) {
      const reward = REFERRAL_TIER_REWARDS[earnedTier];
      rewardAwarded = reward;

      const now = Timestamp.now();
      const logEntry: ReferralRewardLogEntry = {
        at: now,
        grantedAt: now,
        tier: reward.tier,
        rewardKind: reward.rewardKind,
        reward: reward.reward,
        ...(reward.amountCents ? { amountCents: reward.amountCents } : {}),
        projectId: refereeProjectId,
      };

      update.referralTier = reward.tier;
      update.referralRewardsLog = FieldValue.arrayUnion(logEntry);
      if (reward.amountCents && reward.amountCents > 0) {
        update.referralCredit = FieldValue.increment(reward.amountCents);
      }
    }

    tx.update(referrerRef, update);

    return {
      applied: true as const,
      newCount,
      earnedTier,
      previousTier,
      rewardAwarded,
    };
  });

  if (!txResult.applied) {
    return {
      applied: false,
      reason: txResult.reason,
      referrerId: referrer.id,
    };
  }

  // Best-effort tier-up notification (only when an actual new tier crossed).
  if (txResult.rewardAwarded && txResult.earnedTier && txResult.earnedTier > txResult.previousTier) {
    try {
      await adminDb.collection("mail").add({
        to: referrer.email,
        message: {
          subject: `You unlocked a referral reward — Tier ${txResult.earnedTier}`,
          html: buildTierUpEmailHtml({
            firstName: referrer.firstName,
            tier: txResult.earnedTier,
            reward: txResult.rewardAwarded.reward,
            referralCount: txResult.newCount,
          }),
        },
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("[applyReferralAttribution] mail enqueue failed", {
        referrerId: referrer.id,
        err,
      });
    }
  }

  return {
    applied: true,
    referrerId: referrer.id,
    tierAwarded:
      txResult.earnedTier && txResult.earnedTier > txResult.previousTier
        ? (txResult.earnedTier as ReferralTier)
        : undefined,
    reward: txResult.rewardAwarded,
    newReferralCount: txResult.newCount,
  };
}

function buildTierUpEmailHtml({
  firstName,
  tier,
  reward,
  referralCount,
}: {
  firstName: string;
  tier: number;
  reward: string;
  referralCount: number;
}): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Georgia',serif;">
  <div style="max-width:560px;margin:40px auto;background:#FAF9F6;border:0.5px solid rgba(42,42,40,0.15);">
    <div style="background:#2A2A28;padding:32px 40px;">
      <p style="margin:0;font-size:22px;font-weight:300;color:#FAF9F6;letter-spacing:0.04em;">
        Korrin&apos;s Photography<span style="color:#6B7845;">.</span>
      </p>
    </div>
    <div style="padding:40px;">
      <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6B7845;">
        Referral Tier ${tier} Unlocked
      </p>
      <h1 style="margin:0 0 24px;font-size:28px;font-weight:300;color:#2A2A28;line-height:1.2;">
        Thank you, ${firstName}
      </h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        Your ${referralCount === 1 ? "first referral" : `${referralCount} referrals`} just unlocked a new reward:
      </p>
      <div style="background:#E8EBD8;border-left:2px solid #6B7845;padding:16px 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:17px;color:#2A2A28;line-height:1.6;">${reward}</p>
      </div>
      <p style="margin:0 0 20px;font-size:15px;color:#4A4A47;line-height:1.8;">
        Credits will apply automatically to your next invoice. Non-monetary rewards will be coordinated by Korrin directly.
      </p>
    </div>
  </div>
</body>
</html>`.trim();
}
