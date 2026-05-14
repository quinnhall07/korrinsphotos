// lib/db/email-events.ts
// Phase 1.6 / 4.3 — Email engagement events. One top-level collection,
// `emailEvents/{id}`, written by:
//   - `lib/email/tracking.ts > enqueueTrackedMail()` on every outbound send
//     (type: "sent")
//   - `app/t/o/[sendId]/route.ts` open-pixel hit (type: "opened")
//   - `app/t/c/[sendId]/route.ts` click-redirector hit (type: "clicked")
//
// Future event types ("bounced", "unsub") will be written by an inbound
// webhook handler once a deliverability provider is wired up.
//
// Server-only. Imports `adminDb`.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type EmailEventType = "sent" | "opened" | "clicked" | "bounced" | "unsub";

export interface EmailEventDoc {
  id: string;
  sendId: string;
  recipientClientId?: string | null;
  recipientEmail: string;
  type: EmailEventType;
  /** Decoded destination URL — only set for "clicked". */
  url?: string | null;
  /** User-Agent header captured at open/click time. */
  userAgent?: string | null;
  /** projectId attribution — set on the "sent" row when known, copied through
   *  by aggregations rather than re-stamped on opens/clicks (we look up by
   *  sendId instead so we don't re-write the field on every pixel hit). */
  projectId?: string | null;
  /** Free-form bucket tag for grouping sends (e.g. "contract", "invoice",
   *  "auto-responder"). Useful for broadcast/sequence engagement rates. */
  sendKind?: string | null;
  at: Timestamp;
}

export const emailEventsCol = () => adminDb.collection("emailEvents");

export interface CreateEmailEventInput {
  sendId: string;
  recipientEmail: string;
  type: EmailEventType;
  recipientClientId?: string | null;
  url?: string | null;
  userAgent?: string | null;
  projectId?: string | null;
  sendKind?: string | null;
}

/**
 * Insert a single emailEvents row. Uses `serverTimestamp()` for `at` so the
 * write order is preserved even when many rows arrive in the same millisecond.
 */
export async function createEmailEvent(
  data: CreateEmailEventInput
): Promise<string> {
  const ref = emailEventsCol().doc();
  // Drop undefined fields so Firestore doesn't blow up on `undefined` values —
  // it accepts null but not undefined. Hand-pick to stay explicit.
  const payload: Record<string, unknown> = {
    sendId: data.sendId,
    recipientEmail: data.recipientEmail,
    type: data.type,
    at: FieldValue.serverTimestamp(),
  };
  if (data.recipientClientId !== undefined) payload.recipientClientId = data.recipientClientId;
  if (data.url !== undefined) payload.url = data.url;
  if (data.userAgent !== undefined) payload.userAgent = data.userAgent;
  if (data.projectId !== undefined) payload.projectId = data.projectId;
  if (data.sendKind !== undefined) payload.sendKind = data.sendKind;
  await ref.set(payload);
  return ref.id;
}

/**
 * Return every event row for one send. Used by the Messages-tab engagement
 * chips ("opened 3×, clicked invoice link"). Ordered by `at` ascending so the
 * caller can render a mini-timeline if it wants.
 */
export async function listEmailEventsForSendId(
  sendId: string
): Promise<EmailEventDoc[]> {
  const snap = await emailEventsCol()
    .where("sendId", "==", sendId)
    .orderBy("at", "asc")
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmailEventDoc));
}

/**
 * All events for a given recipient. Used by the client engagement-score
 * calculator (engagement events bump the score, replacing the decay-only
 * formula — see roadmap §1.6).
 */
export async function listEmailEventsForClient(
  clientId: string,
  limit = 100
): Promise<EmailEventDoc[]> {
  const snap = await emailEventsCol()
    .where("recipientClientId", "==", clientId)
    .orderBy("at", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as EmailEventDoc));
}

/**
 * Aggregate every event row for one project across all its sends. Used by
 * Project workspace + the "Hot Today" ribbon on `/admin` (filter to
 * `at >= now - 24h` at the caller).
 *
 * Note: the `projectId` field is only stamped on rows where the caller had a
 * projectId at send time. Opens/clicks inherit the project via their sendId,
 * so callers needing "all events for this project" should:
 *   1. fetch all `emailEvents.where(projectId == X)` (sent rows) → collect sendIds
 *   2. fetch all `emailEvents.where(sendId in [...])` (opens/clicks)
 *
 * For convenience, `listEmailEventsForProject` does the two-step expansion.
 */
export async function listEmailEventsForProject(
  projectId: string
): Promise<EmailEventDoc[]> {
  // Step 1 — sent rows tagged with this projectId.
  const sentSnap = await emailEventsCol()
    .where("projectId", "==", projectId)
    .get();
  const sentRows = sentSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as EmailEventDoc)
  );
  const sendIds = Array.from(new Set(sentRows.map((r) => r.sendId)));
  if (sendIds.length === 0) return sentRows;

  // Step 2 — open/click events keyed by those sendIds. Firestore `in` queries
  // cap at 30 ids per call, so chunk.
  const followUps: EmailEventDoc[] = [];
  const CHUNK = 30;
  for (let i = 0; i < sendIds.length; i += CHUNK) {
    const chunk = sendIds.slice(i, i + CHUNK);
    const snap = await emailEventsCol()
      .where("sendId", "in", chunk)
      .where("type", "in", ["opened", "clicked", "bounced", "unsub"])
      .get();
    for (const d of snap.docs) {
      followUps.push({ id: d.id, ...d.data() } as EmailEventDoc);
    }
  }

  // Concatenate + sort ascending by `at`.
  const all = [...sentRows, ...followUps];
  all.sort((a, b) => {
    const am = a.at?.toMillis?.() ?? 0;
    const bm = b.at?.toMillis?.() ?? 0;
    return am - bm;
  });
  return all;
}

/**
 * Lightweight `.count()`-backed aggregation for a single `(sendId, type)` or
 * `(projectId, type)` filter. Falls back to a doc-scan if the underlying
 * driver lacks `count()` (it shouldn't on modern firebase-admin).
 */
export async function countEvents(filter: {
  sendId?: string;
  projectId?: string;
  recipientClientId?: string;
  type?: EmailEventType;
}): Promise<number> {
  let query: FirebaseFirestore.Query = emailEventsCol();
  if (filter.sendId) query = query.where("sendId", "==", filter.sendId);
  if (filter.projectId) query = query.where("projectId", "==", filter.projectId);
  if (filter.recipientClientId)
    query = query.where("recipientClientId", "==", filter.recipientClientId);
  if (filter.type) query = query.where("type", "==", filter.type);
  try {
    const agg = await query.count().get();
    return agg.data().count;
  } catch {
    // Defensive fallback — costs reads but won't 500 callers.
    const snap = await query.get();
    return snap.size;
  }
}
