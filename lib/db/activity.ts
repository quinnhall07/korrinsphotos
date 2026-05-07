import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

export type ActivityAction =
  | "LEAD_RECEIVED"
  | "STATUS_CHANGED"
  | "EMAIL_SENT"
  | "NOTE_ADDED";

export interface ActivityDoc {
  id: string;
  action: ActivityAction;
  message: string;
  timestamp: Timestamp;
  metadata?: Record<string, unknown>;
}

export const activityCol = () => adminDb.collection("activityFeed");

export async function logActivity(
  action: ActivityAction,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await activityCol().add({
    action,
    message,
    timestamp: FieldValue.serverTimestamp(),
    ...(metadata ? { metadata } : {}),
  });
}

export async function listRecentActivity(limit = 8): Promise<ActivityDoc[]> {
  try {
    const snap = await activityCol()
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ActivityDoc));
  } catch {
    return [];
  }
}
