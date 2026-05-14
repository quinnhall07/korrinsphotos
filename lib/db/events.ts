import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

/**
 * Canonical EventDoc.status lifecycle (in order):
 *   UPCOMING  — created, shoot has not happened yet (default for new events).
 *   ACTIVE    — shoot is in progress / day-of (optional intermediate state).
 *   COMPLETED — shoot finished, editing/delivery pending or done.
 *   DELIVERED — gallery delivered to client (legacy/manual marker).
 *   ARCHIVED  — terminal off-ramp; event hidden from primary lists.
 */
export type EventStatus =
  | "UPCOMING"
  | "ACTIVE"
  | "COMPLETED"
  | "DELIVERED"
  | "ARCHIVED";

export interface EventDoc {
  id: string;
  title: string;
  bookingId?: string;
  projectId?: string;
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
  status?: EventStatus;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isMultiDay?: boolean;
  location?: string;
  shootDate?: Timestamp;
  shootEndDate?: Timestamp;
  /**
   * Phase 2.6 — Optional 4–6 digit numeric PIN required before zip downloads.
   * When set, both `/api/download/[eventId]/zip` and
   * `/api/download/[eventId]/favorites` require `?pin=...` to match.
   */
  downloadPin?: string;
  downloadPinSetAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const eventsCol = () => adminDb.collection("events");

/**
 * Phase 2.6 — Set or clear the per-event download PIN.
 *
 * @param eventId Firestore event document id.
 * @param pin     4–6 numeric chars to lock downloads behind, or `null` to clear.
 *
 * Validation lives at the call site (Server Action). This helper trusts that
 * the PIN has been sanitised already; it only writes the doc.
 */
export async function setDownloadPin(
  eventId: string,
  pin: string | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (pin === null) {
    update.downloadPin = FieldValue.delete();
    update.downloadPinSetAt = FieldValue.delete();
  } else {
    update.downloadPin = pin;
    update.downloadPinSetAt = FieldValue.serverTimestamp();
  }
  await adminDb.collection("events").doc(eventId).update(update);
}

/**
 * Phase 2.6 — Constant-time PIN comparison.
 *
 * Returns `true` if the event has no PIN set (no gate), or if the supplied
 * PIN matches the stored one. Uses `crypto.timingSafeEqual` after equalising
 * the buffer lengths to avoid leaking the PIN length through timing.
 */
export async function verifyDownloadPin(
  eventId: string,
  supplied: string | null | undefined,
): Promise<{ required: boolean; ok: boolean }> {
  const doc = await adminDb.collection("events").doc(eventId).get();
  const stored = (doc.data()?.downloadPin as string | undefined) ?? null;
  if (!stored) return { required: false, ok: true };
  if (!supplied) return { required: true, ok: false };

  // Constant-time compare. We pad both sides to the same fixed length to
  // hide which input is longer; timingSafeEqual itself requires equal-length
  // buffers, so length must be normalised before the call.
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(supplied, "utf8");
  const max = Math.max(a.length, b.length);
  const ap = Buffer.alloc(max);
  const bp = Buffer.alloc(max);
  a.copy(ap);
  b.copy(bp);
  const equal = timingSafeEqual(ap, bp) && a.length === b.length;
  return { required: true, ok: equal };
}
