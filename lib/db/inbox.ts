import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type InboxItemType =
  | "INQUIRY_RECEIVED"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_DISPUTE_CREATED"
  | "PAYMENT_DISPUTE_CLOSED"
  | "CONTRACT_SIGNED"
  | "MESSAGE_RECEIVED"
  | "CLIENT_MESSAGE"
  | "GALLERY_REQUESTED"
  | "UNMATCHED_INBOUND"
  | "TASK_FIRED"
  | "PRESS_LINK_DOWN"
  | "RE_ENGAGEMENT_DUE"
  | "FAR_FUTURE_RISK"
  | "COI_REQUESTED"
  | "COI_RECEIVED"
  | "SALES_TAX_OVERDUE";

export interface InboxItemDoc {
  id: string;
  type: InboxItemType;
  projectId?: string | null;
  clientId?: string | null;
  title: string;
  body?: string | null;
  link?: string | null;
  read: boolean;
  snoozedUntil?: Timestamp | null;
  /**
   * When set, the item is considered archived and is hidden from the default
   * triage list. Unset (or null) ⇒ active. Archive is a soft state — items are
   * never `.delete()`d from Firestore so archived rows can be restored.
   */
  archivedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const inboxItemsCol = () => adminDb.collection("inboxItems");

export async function createInboxItem(
  data: Omit<InboxItemDoc, "id" | "createdAt" | "updatedAt">
): Promise<InboxItemDoc> {
  const ref = inboxItemsCol().doc();
  const now = Timestamp.now();
  const fullData = {
    type: data.type,
    projectId: data.projectId ?? null,
    clientId: data.clientId ?? null,
    title: data.title,
    body: data.body ?? null,
    link: data.link ?? null,
    read: data.read ?? false,
    snoozedUntil: data.snoozedUntil ?? null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as InboxItemDoc;
}

export async function listInboxItems(
  opts: {
    includeRead?: boolean;
    includeSnoozed?: boolean;
    /** When true, return ONLY archived rows (for the Archived view). */
    archivedOnly?: boolean;
    /** When true, include archived rows alongside active ones (rare). */
    includeArchived?: boolean;
    /**
     * When set, narrow the result to inbox rows whose `projectId` matches.
     * Filtered in-memory (same 500-row read horizon) so this doesn't require
     * a composite index. Used by the project workspace InboxPill.
     */
    projectId?: string;
  } = {}
): Promise<InboxItemDoc[]> {
  const {
    includeRead = false,
    includeSnoozed = false,
    archivedOnly = false,
    includeArchived = false,
    projectId,
  } = opts;

  // Fetch broadly (single orderBy) and filter in-memory to avoid composite-index
  // requirements that proliferate quickly with `where(...) + orderBy(...)`.
  const snap = await inboxItemsCol().orderBy("createdAt", "desc").limit(500).get();
  const now = Timestamp.now();

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InboxItemDoc));

  return all.filter((item) => {
    if (projectId && item.projectId !== projectId) return false;
    const isArchived = !!item.archivedAt;
    if (archivedOnly) return isArchived;
    if (!includeArchived && isArchived) return false;
    if (!includeRead && item.read) return false;
    if (!includeSnoozed) {
      // Hide items whose snooze window is still in the future.
      if (item.snoozedUntil && item.snoozedUntil.toMillis() > now.toMillis()) {
        return false;
      }
    }
    return true;
  });
}

export async function markRead(id: string): Promise<void> {
  await inboxItemsCol().doc(id).update({
    read: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function markUnread(id: string): Promise<void> {
  await inboxItemsCol().doc(id).update({
    read: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Soft-delete: mark an inbox row archived. The doc is preserved so it can be
 * restored from the Archived view.
 *
 * Historical note: this used to `.delete()` the doc — that made archive a
 * one-way operation and effectively a black hole. Existing callers (cron
 * sweeps, sequence transitions, etc.) still work unchanged.
 */
export async function archiveItem(id: string): Promise<void> {
  await inboxItemsCol().doc(id).update({
    archivedAt: FieldValue.serverTimestamp(),
    read: true,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Clear `archivedAt` and `read`, returning the row to the active triage list. */
export async function unarchiveItem(id: string): Promise<void> {
  await inboxItemsCol().doc(id).update({
    archivedAt: null,
    read: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function snoozeItem(id: string, until: Date): Promise<void> {
  await inboxItemsCol().doc(id).update({
    snoozedUntil: Timestamp.fromDate(until),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/** Clear an active snooze window so the item returns to triage immediately. */
export async function clearSnooze(id: string): Promise<void> {
  await inboxItemsCol().doc(id).update({
    snoozedUntil: null,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function bulkMarkRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = adminDb.batch();
  for (const id of ids) {
    batch.update(inboxItemsCol().doc(id), {
      read: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function bulkArchive(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = adminDb.batch();
  for (const id of ids) {
    batch.update(inboxItemsCol().doc(id), {
      archivedAt: FieldValue.serverTimestamp(),
      read: true,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function bulkUnarchive(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const batch = adminDb.batch();
  for (const id of ids) {
    batch.update(inboxItemsCol().doc(id), {
      archivedAt: null,
      read: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function countUnread(): Promise<number> {
  try {
    // Count unread + non-archived. We fetch ids only (with a tight limit) and
    // filter `archivedAt == null` in-memory to avoid a composite index on
    // `(read, archivedAt)`. Cap matches the listInboxItems read horizon.
    const snap = await inboxItemsCol().where("read", "==", false).limit(500).get();
    let n = 0;
    snap.docs.forEach((d) => {
      if (!d.data().archivedAt) n += 1;
    });
    return n;
  } catch {
    return 0;
  }
}
