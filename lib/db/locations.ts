// lib/db/locations.ts
// Persistence layer for the location-scouting database.
// One row per real-world place Korrin has scouted or shot at.
// Server-only — imports the admin SDK.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationType =
  | "OUTDOOR_PARK"
  | "OUTDOOR_BEACH"
  | "OUTDOOR_FIELD"
  | "OUTDOOR_URBAN"
  | "INDOOR_STUDIO"
  | "INDOOR_VENUE"
  | "INDOOR_HOME"
  | "OTHER";

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  OUTDOOR_PARK: "Outdoor — Park",
  OUTDOOR_BEACH: "Outdoor — Beach",
  OUTDOOR_FIELD: "Outdoor — Field",
  OUTDOOR_URBAN: "Outdoor — Urban",
  INDOOR_STUDIO: "Indoor — Studio",
  INDOOR_VENUE: "Indoor — Venue",
  INDOOR_HOME: "Indoor — Home",
  OTHER: "Other",
};

export type LocationRating = 1 | 2 | 3 | 4 | 5;

export interface LightingWindow {
  startHour: number; // 0-23
  endHour: number; // 0-23
  notes?: string; // e.g. "best in summer with the trees blocking harsh sun"
}

export interface LocationDoc {
  id: string;
  name: string;
  type: LocationType;
  address?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  bestLightWindow?: LightingWindow;
  parkingNotes?: string;
  permitRequired?: boolean;
  permitCost?: number; // USD
  permitContact?: string; // free-text
  accessibilityNotes?: string;
  capacityMax?: number; // max group size that works here
  weatherDependent?: boolean; // if true, schedule reminder for weather check
  sampleEventIds?: string[]; // events where this location was used
  rating?: LocationRating; // Korrin's subjective rating
  lastVisited?: Timestamp;
  visitCount?: number;
  notes?: string;
  tags?: string[]; // free-form
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Collection handle ────────────────────────────────────────────────────────

export const locationsCol = () => adminDb.collection("locations");

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function getLocation(id: string): Promise<LocationDoc | null> {
  const snap = await locationsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as LocationDoc) : null;
}

export async function listLocations(): Promise<LocationDoc[]> {
  const snap = await locationsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LocationDoc));
}

export async function createLocation(
  data: Omit<LocationDoc, "id" | "createdAt" | "updatedAt">
): Promise<LocationDoc> {
  const ref = locationsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as LocationDoc;
}

export async function updateLocation(
  id: string,
  data: Partial<Omit<LocationDoc, "id" | "createdAt">>
): Promise<void> {
  await locationsCol()
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function deleteLocation(id: string): Promise<void> {
  await locationsCol().doc(id).delete();
}

/**
 * Records that an event was shot at this location.
 * Appends the eventId to `sampleEventIds`, increments `visitCount`,
 * and stamps `lastVisited` to now. Idempotent on eventId.
 *
 * Intended to be called from the event-create / project-transitions
 * flow in a later phase, once location linking is wired into events.
 */
export async function recordVisit(id: string, eventId: string): Promise<void> {
  const ref = locationsCol().doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;

  const existing = (snap.data()?.sampleEventIds as string[] | undefined) ?? [];
  if (existing.includes(eventId)) {
    // Still bump lastVisited so multi-visit metadata stays accurate.
    await ref.update({
      lastVisited: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return;
  }

  await ref.update({
    sampleEventIds: FieldValue.arrayUnion(eventId),
    visitCount: FieldValue.increment(1),
    lastVisited: Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });
}
