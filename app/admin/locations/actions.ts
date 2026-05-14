"use server";

// app/admin/locations/actions.ts
// Server Actions for the location-scouting database.
// All mutations require admin and log to the activity feed best-effort.

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  createLocation as dbCreateLocation,
  updateLocation as dbUpdateLocation,
  deleteLocation as dbDeleteLocation,
  recordVisit as dbRecordVisit,
  type LocationDoc,
  type LocationType,
  type LocationRating,
  type LightingWindow,
} from "@/lib/db/locations";

export type LocationInput = {
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
  permitCost?: number;
  permitContact?: string;
  accessibilityNotes?: string;
  capacityMax?: number;
  weatherDependent?: boolean;
  rating?: LocationRating;
  notes?: string;
  tags?: string[];
};

type ActionResult<T = void> =
  | (T extends void ? { success: true } : { success: true; data: T })
  | { success: false; error: string };

// ─── Create Location ──────────────────────────────────────────────────────────

export async function createLocation(
  input: LocationInput
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin();

  try {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      return { success: false, error: "Name is required." };
    }

    const doc: Omit<LocationDoc, "id" | "createdAt" | "updatedAt"> = {
      name: trimmedName,
      type: input.type,
      ...(input.address ? { address: input.address } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.state ? { state: input.state } : {}),
      ...(typeof input.latitude === "number" ? { latitude: input.latitude } : {}),
      ...(typeof input.longitude === "number" ? { longitude: input.longitude } : {}),
      ...(input.bestLightWindow ? { bestLightWindow: input.bestLightWindow } : {}),
      ...(input.parkingNotes ? { parkingNotes: input.parkingNotes } : {}),
      ...(typeof input.permitRequired === "boolean"
        ? { permitRequired: input.permitRequired }
        : {}),
      ...(typeof input.permitCost === "number" ? { permitCost: input.permitCost } : {}),
      ...(input.permitContact ? { permitContact: input.permitContact } : {}),
      ...(input.accessibilityNotes ? { accessibilityNotes: input.accessibilityNotes } : {}),
      ...(typeof input.capacityMax === "number" ? { capacityMax: input.capacityMax } : {}),
      ...(typeof input.weatherDependent === "boolean"
        ? { weatherDependent: input.weatherDependent }
        : {}),
      ...(input.rating ? { rating: input.rating } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.tags && input.tags.length ? { tags: input.tags } : {}),
      visitCount: 0,
      sampleEventIds: [],
    };

    const created = await dbCreateLocation(doc);

    await logActivity("NOTE_ADDED", `Scouted location added: ${created.name}`, {
      locationId: created.id,
      type: created.type,
    }).catch(() => {});

    revalidatePath("/admin/locations");
    revalidatePath("/admin");

    return { success: true, data: { id: created.id } };
  } catch (err) {
    console.error("createLocation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create location.",
    };
  }
}

// ─── Update Location ──────────────────────────────────────────────────────────

export async function updateLocation(
  id: string,
  patch: Partial<LocationInput>
): Promise<ActionResult> {
  await requireAdmin();

  try {
    // Drop undefined keys so Firestore doesn't reject them.
    const cleaned: Partial<LocationDoc> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (value !== undefined) {
        (cleaned as Record<string, unknown>)[key] = value;
      }
    }

    await dbUpdateLocation(id, cleaned);

    await logActivity("NOTE_ADDED", `Location updated`, {
      locationId: id,
    }).catch(() => {});

    revalidatePath("/admin/locations");
    revalidatePath(`/admin/locations/${id}`);

    return { success: true };
  } catch (err) {
    console.error("updateLocation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update location.",
    };
  }
}

// ─── Delete Location ──────────────────────────────────────────────────────────

export async function deleteLocation(id: string): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbDeleteLocation(id);

    await logActivity("NOTE_ADDED", `Location deleted`, {
      locationId: id,
    }).catch(() => {});

    revalidatePath("/admin/locations");
    revalidatePath("/admin");

    return { success: true };
  } catch (err) {
    console.error("deleteLocation error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to delete location.",
    };
  }
}

// ─── Record Visit ─────────────────────────────────────────────────────────────

/**
 * Wires a shot event into the location's history.
 * Intended to be called from event-create / project-transition flows
 * once event-to-location linking is added in a later phase.
 */
export async function recordLocationVisit(
  locationId: string,
  eventId: string
): Promise<ActionResult> {
  await requireAdmin();

  try {
    await dbRecordVisit(locationId, eventId);

    revalidatePath("/admin/locations");
    revalidatePath(`/admin/locations/${locationId}`);

    return { success: true };
  } catch (err) {
    console.error("recordLocationVisit error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record visit.",
    };
  }
}
