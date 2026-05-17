import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

// ---------------------------------------------------------------------------
// Paginated listing
// ---------------------------------------------------------------------------

export interface ListEventsPage {
  events: EventDoc[];
  nextCursor: string | null;
}

interface EventCursorPayload {
  lastDocId: string;
  lastCreatedAtMs: number;
}

function encodeEventCursor(payload: EventCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeEventCursor(cursor: string): EventCursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<EventCursorPayload>;
    if (
      typeof parsed.lastDocId !== "string" ||
      typeof parsed.lastCreatedAtMs !== "number"
    ) {
      return null;
    }
    return {
      lastDocId: parsed.lastDocId,
      lastCreatedAtMs: parsed.lastCreatedAtMs,
    };
  } catch {
    return null;
  }
}

/**
 * Cursor-based paginated event list.
 *
 * Sort: `createdAt desc` with `__name__ desc` as the stable tiebreaker. The
 * canonical "when did this happen" field for an event is the string `startDate`,
 * but that isn't a Firestore-sortable type and isn't populated on legacy /
 * manual events — so the list view uses `createdAt` (which every event has),
 * matching the legacy `/admin/events` behaviour.
 *
 * The optional `statusFilter` applies a `where("status", "in", […])` clause.
 * Firestore caps `in` arrays at 30, which is well above the 5-member
 * `EventStatus` union so we don't bother chunking. If the caller passes an
 * empty array we ignore the filter (treat as "All").
 */
export async function listEventsPaginated(opts: {
  pageSize?: number;
  cursor?: string | null;
  statusFilter?: EventStatus[];
}): Promise<ListEventsPage> {
  const pageSize = opts.pageSize ?? 30;
  // Fetch one extra to detect whether a next page exists.
  const fetchLimit = pageSize + 1;

  let query: FirebaseFirestore.Query = eventsCol();

  if (opts.statusFilter && opts.statusFilter.length > 0) {
    query = query.where("status", "in", opts.statusFilter);
  }

  query = query
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(fetchLimit);

  if (opts.cursor) {
    const decoded = decodeEventCursor(opts.cursor);
    if (decoded) {
      query = query.startAfter(
        Timestamp.fromMillis(decoded.lastCreatedAtMs),
        decoded.lastDocId,
      );
    }
  }

  const snap = await query.get();
  const docs = snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<EventDoc, "id">),
  }));

  const hasMore = docs.length > pageSize;
  const trimmed = hasMore ? docs.slice(0, pageSize) : docs;

  let nextCursor: string | null = null;
  if (hasMore && trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const lastCreatedAtMs = last.createdAt?.toMillis?.() ?? 0;
    nextCursor = encodeEventCursor({
      lastDocId: last.id,
      lastCreatedAtMs,
    });
  }

  return { events: trimmed, nextCursor };
}
