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
  /**
   * Wave 11 — admin-only "internal notes" written from the client detail page.
   * Distinct from any per-project `notes` on `projects/{projectId}`. Free text.
   */
  notes?: string;
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

/* ─── Wave 11 — admin client directory ───────────────────────────────────── */

export type ClientSort = "recent" | "ltv" | "sessions";

export interface ListClientsPage {
  clients: ClientDoc[];
  nextCursor: string | null;
}

interface ClientCursorPayload {
  lastId: string;
  lastSortKey: number;
  sort: ClientSort;
}

function encodeClientCursor(payload: ClientCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeClientCursor(cursor: string): ClientCursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<ClientCursorPayload>;
    if (
      typeof parsed.lastId !== "string" ||
      typeof parsed.lastSortKey !== "number" ||
      (parsed.sort !== "recent" && parsed.sort !== "ltv" && parsed.sort !== "sessions")
    ) {
      return null;
    }
    return { lastId: parsed.lastId, lastSortKey: parsed.lastSortKey, sort: parsed.sort };
  } catch {
    return null;
  }
}

/**
 * Paginated client list ordered by createdAt desc. Cursor encodes
 * `{ lastId, lastSortKey: createdAtMs, sort }` for forward navigation.
 *
 * Sort modes: `"recent"` (default) uses Firestore `orderBy("createdAt", "desc")`.
 * `"ltv"` and `"sessions"` are sorted in memory by the caller because lifetime
 * value is derived from invoices and `totalSessionsBooked` is updated lazily —
 * for those modes we currently fetch a wider slice and let the page sort it.
 */
export async function listClientsPaginated(opts?: {
  pageSize?: number;
  cursor?: string | null;
  sort?: ClientSort;
}): Promise<ListClientsPage> {
  const pageSize = opts?.pageSize ?? 100;
  const sort: ClientSort = opts?.sort ?? "recent";

  // Only `recent` is paginated server-side. `ltv` / `sessions` need cross-collection
  // aggregation (invoices) so the page handler reads more rows and sorts in memory.
  if (sort !== "recent") {
    const snap = await clientsCol().orderBy("createdAt", "desc").limit(pageSize * 3).get();
    const clients = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDoc));
    return { clients, nextCursor: null };
  }

  const fetchLimit = pageSize + 1;
  let query = clientsCol()
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(fetchLimit);

  if (opts?.cursor) {
    const decoded = decodeClientCursor(opts.cursor);
    if (decoded && decoded.sort === "recent") {
      query = query.startAfter(Timestamp.fromMillis(decoded.lastSortKey), decoded.lastId);
    }
  }

  const snap = await query.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDoc));
  const hasMore = docs.length > pageSize;
  const trimmed = docs.slice(0, pageSize);

  let nextCursor: string | null = null;
  if (hasMore && trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const lastSortKey = last.createdAt?.toMillis?.() ?? 0;
    nextCursor = encodeClientCursor({ lastId: last.id, lastSortKey, sort });
  }

  return { clients: trimmed, nextCursor };
}

/**
 * Substring search across email + first/last name. Firestore can't do
 * substring matches, so we fetch the most recent 500 clients and filter
 * in memory. Caps results at 50.
 */
export async function searchClients(query: string): Promise<ClientDoc[]> {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const snap = await clientsCol().orderBy("createdAt", "desc").limit(500).get();
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClientDoc));
  const matches = all.filter((c) => {
    const email = (c.email ?? "").toLowerCase();
    const first = (c.firstName ?? "").toLowerCase();
    const last = (c.lastName ?? "").toLowerCase();
    return email.includes(needle) || first.includes(needle) || last.includes(needle);
  });
  return matches.slice(0, 50);
}

/**
 * Wave 11 — Admin-only edit affordance for the client detail page.
 *
 * Allow-list of editable fields. Notes is a free-text "internal notes"
 * field that the admin uses on the client detail page — distinct from any
 * per-project `notes` on `projects/{projectId}`.
 */
export interface UpdateClientDetailsInput {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  notes?: string;
  recurringCadence?: RecurringCadence;
}

export async function updateClientDetails(
  clientId: string,
  updates: UpdateClientDetailsInput
): Promise<void> {
  const safe: Record<string, unknown> = {};
  if (typeof updates.firstName === "string") safe.firstName = updates.firstName.trim();
  if (typeof updates.lastName === "string") safe.lastName = updates.lastName.trim();
  if ("phone" in updates) {
    const v = updates.phone;
    safe.phone = typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
  }
  if (typeof updates.notes === "string") safe.notes = updates.notes;
  if (
    updates.recurringCadence === "ANNUAL" ||
    updates.recurringCadence === "SEMI_ANNUAL" ||
    updates.recurringCadence === "NONE"
  ) {
    safe.recurringCadence = updates.recurringCadence;
  }
  if (Object.keys(safe).length === 0) return;
  safe.updatedAt = FieldValue.serverTimestamp();
  await clientsCol().doc(clientId).update(safe);
}
