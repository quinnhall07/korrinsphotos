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
  | "GALLERY_REQUESTED"
  | "UNMATCHED_INBOUND"
  | "TASK_FIRED";

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
    createdAt: now,
    updatedAt: now,
  };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as InboxItemDoc;
}

export async function listInboxItems(
  opts: { includeRead?: boolean; includeSnoozed?: boolean } = {}
): Promise<InboxItemDoc[]> {
  const { includeRead = false, includeSnoozed = false } = opts;

  // Fetch broadly (single orderBy) and filter in-memory to avoid composite-index
  // requirements that proliferate quickly with `where(...) + orderBy(...)`.
  const snap = await inboxItemsCol().orderBy("createdAt", "desc").limit(500).get();
  const now = Timestamp.now();

  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InboxItemDoc));

  return all.filter((item) => {
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

export async function archiveItem(id: string): Promise<void> {
  await inboxItemsCol().doc(id).delete();
}

export async function snoozeItem(id: string, until: Date): Promise<void> {
  await inboxItemsCol().doc(id).update({
    snoozedUntil: Timestamp.fromDate(until),
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
    batch.delete(inboxItemsCol().doc(id));
  }
  await batch.commit();
}

export async function countUnread(): Promise<number> {
  try {
    const snap = await inboxItemsCol().where("read", "==", false).count().get();
    return snap.data().count;
  } catch {
    return 0;
  }
}
