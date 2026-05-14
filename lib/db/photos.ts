import type { Timestamp } from "firebase-admin/firestore";

export interface PhotoDoc {
  id: string;
  eventId: string;
  cloudflareUrl: string;
  cloudflareImageId: string;
  /** R2 key for the original object (single-PUT pipeline). Used for cleanup on delete. */
  r2Key?: string;
  /** R2 key for the original object (multipart pipeline). Used for cleanup on delete. */
  storageKey?: string;
  label?: string;
  category?: string;
  uploadedAt: Timestamp;
}
