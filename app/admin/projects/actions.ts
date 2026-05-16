"use server";

import { revalidatePath } from "next/cache";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  ProjectStatus,
  StatusHistoryEntry,
  EDITING_SUB_STAGES,
  type EditingSubStage,
  mintDayOfRoomToken,
  revokeDayOfRoomToken as revokeDayOfRoomTokenDb,
} from "@/lib/db/projects";
import { handleProjectTransition } from "@/lib/project-transitions";
import { generateAndUploadWelcomePacket } from "@/lib/domain/welcome-packet";
import {
  generateAndStoreShootBrief,
  dispatchShootBriefEmail,
} from "@/lib/domain/shoot-brief";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { logActivity } from "@/lib/db/activity";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  type SavedViewFilter,
} from "@/lib/db/saved-views";
import {
  instantiateGearLogFromTemplate,
  markGearItemPacked,
  addAdHocGearItem,
  removeGearItem,
} from "@/lib/db/gear-log";
import type { GearItemCategory } from "@/lib/db/gear-templates";
import {
  setClientRecurringCadence,
  bumpRecurringNextPromptAt,
  type RecurringCadence,
} from "@/lib/db/clients";
import { getLocation } from "@/lib/db/locations";

/**
 * Wave B Feature 2 — patch payload for {@link updateProjectDetails}. Either
 * `locationId` is provided (workspace location picker selected a scouted
 * record) or it's omitted/null (free-text mode — caller supplies `label`
 * directly). When `locationId` is set the server resolves the underlying
 * `LocationDoc` and overwrites the denormalised `label / lat / lng`; callers
 * cannot pass mismatched values.
 */
export interface ProjectShootLocationPatch {
  locationId?: string | null;
  label?: string | null;
  lat?: number | null;
  lng?: number | null;
  notes?: string | null;
}

export async function updateProjectStatus(
  projectId: string,
  newStatus: ProjectStatus
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  try {
    const doc = await adminDb.collection("projects").doc(projectId).get();
    if (!doc.exists) return { success: false, error: "Project not found" };

    const project = doc.data()!;
    const oldStatus = project.status as ProjectStatus;

    if (oldStatus === newStatus) return { success: true };

    const historyEntry: StatusHistoryEntry = {
      status: newStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    await adminDb.collection("projects").doc(projectId).update({
      status: newStatus,
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Handle lifecycle hooks
    await handleProjectTransition(projectId, oldStatus, newStatus);

    await logActivity(
      "STATUS_CHANGED",
      `Project "${project.title}" moved to ${newStatus.replace(/_/g, " ").toLowerCase()}`,
      { projectId, oldStatus, newStatus }
    ).catch(() => {});

    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    // Wave B Feature 2 — onProjectBooked may have appended this project's
    // event to a linked location's sampleEventIds. Revalidate that detail
    // page so the "Used on projects" list reflects the new visit. The
    // Stripe-webhook path is a known v1 staleness — webhooks cannot
    // revalidatePath cleanly.
    const linkedLocationId: unknown = project?.shootLocation?.locationId;
    if (typeof linkedLocationId === "string" && linkedLocationId.length > 0) {
      revalidatePath(`/admin/locations/${linkedLocationId}`);
    }
    return { success: true };
  } catch (err) {
    console.error("updateProjectStatus error:", err);
    return { success: false, error: "Failed to update status." };
  }
}

export async function updateProjectDetails(
  projectId: string,
  updates: {
    notes?: string;
    /**
     * Phase 13.12 — "Off the record" admin-only notes. NEVER rendered on the
     * client portal or in any export. Pass `null` to clear; an empty string
     * is treated identically to `null` (and undefined).
     */
    offTheRecordNotes?: string | null;
    estimatedValue?: number;
    packagePriceUsd?: number;
    /**
     * Wave 12 — admin-set follow-up reminder date for the OverviewTab card.
     * Pass `"YYYY-MM-DD"` (interpreted at noon UTC to dodge timezone-rollover
     * surprises), an ISO datetime string, or `null` to clear the field.
     */
    followUpDate?: string | null;
    /**
     * Wave B Feature 2 — shoot location patch. `null` clears the field
     * entirely. When `locationId` is provided the server looks up the
     * LocationDoc and snapshots its name/lat/lng over whatever the caller
     * passed for `label / lat / lng` (the picker is the source of truth in
     * that case). Pass `locationId: null` (with explicit label/lat/lng) to
     * keep free-text mode.
     */
    shootLocation?: ProjectShootLocationPatch | null;
  }
) {
  await requireAdmin();
  try {
    // Explicit allow-list so callers can never sneak un-vetted fields through.
    const safe: Record<string, unknown> = {};
    if (typeof updates.notes === "string") safe.notes = updates.notes;
    if ("offTheRecordNotes" in updates) {
      const v = updates.offTheRecordNotes;
      safe.offTheRecordNotes =
        typeof v === "string" && v.length > 0 ? v : "";
    }
    if (typeof updates.estimatedValue === "number") {
      safe.estimatedValue = updates.estimatedValue;
    }
    if (typeof updates.packagePriceUsd === "number") {
      safe.packagePriceUsd = updates.packagePriceUsd;
    }
    if ("followUpDate" in updates) {
      const v = updates.followUpDate;
      if (typeof v === "string" && v.trim()) {
        // Accept either YYYY-MM-DD or any ISO-parseable date. Normalise
        // bare dates to noon UTC so display rendering stays the same day
        // regardless of viewer timezone.
        const isBareDate = /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
        const ms = isBareDate
          ? Date.parse(`${v.trim()}T12:00:00Z`)
          : Date.parse(v);
        if (!Number.isNaN(ms)) {
          safe.followUpDate = Timestamp.fromMillis(ms);
        }
      } else {
        safe.followUpDate = null;
      }
    }

    // Track the previous/next linked locationId so we can revalidate the
    // location detail page (which renders "Used on projects") on both ends.
    let prevLocationId: string | null = null;
    let nextLocationId: string | null = null;

    if ("shootLocation" in updates) {
      const patch = updates.shootLocation;
      if (patch === null) {
        safe.shootLocation = null;
      } else if (patch && typeof patch === "object") {
        const locId =
          typeof patch.locationId === "string" && patch.locationId.trim().length > 0
            ? patch.locationId.trim()
            : null;
        nextLocationId = locId;

        if (locId) {
          // Picker path: snapshot label/lat/lng from the scouting record so
          // the weather cron (which reads the denormalised lat/lng) stays
          // accurate regardless of what the form payload contained.
          const loc = await getLocation(locId);
          if (!loc) {
            return { success: false, error: "Selected location no longer exists." };
          }
          const next: Record<string, unknown> = {
            locationId: locId,
            label: loc.name,
          };
          if (typeof loc.latitude === "number") next.lat = loc.latitude;
          if (typeof loc.longitude === "number") next.lng = loc.longitude;
          if (typeof patch.notes === "string" && patch.notes.trim().length > 0) {
            next.notes = patch.notes.trim();
          }
          safe.shootLocation = next;
        } else {
          // Free-text path: keep label/lat/lng as provided, never write
          // `locationId`. Empty label collapses the whole field to null.
          const label =
            typeof patch.label === "string" ? patch.label.trim() : "";
          if (!label) {
            safe.shootLocation = null;
          } else {
            const next: Record<string, unknown> = { label };
            if (typeof patch.lat === "number" && Number.isFinite(patch.lat)) {
              next.lat = patch.lat;
            }
            if (typeof patch.lng === "number" && Number.isFinite(patch.lng)) {
              next.lng = patch.lng;
            }
            if (typeof patch.notes === "string" && patch.notes.trim().length > 0) {
              next.notes = patch.notes.trim();
            }
            safe.shootLocation = next;
          }
        }
      }

      // If we changed the FK, capture the prior value so the old location's
      // detail page also revalidates. Best-effort — failure here doesn't
      // stop the write.
      try {
        const prev = await adminDb.collection("projects").doc(projectId).get();
        const prevRaw = prev.data()?.shootLocation;
        if (prevRaw && typeof prevRaw.locationId === "string") {
          prevLocationId = prevRaw.locationId;
        }
      } catch {
        // ignore
      }
    }

    await adminDb.collection("projects").doc(projectId).update({
      ...safe,
      updatedAt: FieldValue.serverTimestamp()
    });
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    if (prevLocationId) {
      revalidatePath(`/admin/locations/${prevLocationId}`);
    }
    if (nextLocationId && nextLocationId !== prevLocationId) {
      revalidatePath(`/admin/locations/${nextLocationId}`);
    }
    return { success: true };
  } catch (err) {
    console.error(err);
    return { success: false, error: "Failed to update project" };
  }
}

/**
 * Phase 2.7 — regenerate the welcome packet HTML and re-upload to R2.
 * Re-mints the read token (so any previously-sent links stop working).
 * Returns the new shareable URL so the admin can copy it directly.
 */
export async function regenerateWelcomePacket(
  projectId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireAdmin();
  try {
    const { token } = await generateAndUploadWelcomePacket(projectId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const url = `${appUrl}/welcome-packet/${projectId}?t=${token}`;
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, url };
  } catch (err) {
    console.error("[regenerateWelcomePacket] failed", { projectId, err });
    return { success: false, error: "Failed to regenerate welcome packet." };
  }
}

/**
 * Phase 3.4 — manually regenerate the shoot brief HTML packet, upload to R2,
 * and email Korrin a tracked download link. Used by the "Generate now" /
 * "Regenerate" buttons in the project workspace OverviewTab.
 */
export async function regenerateShootBrief(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    await generateAndStoreShootBrief(projectId);
    await dispatchShootBriefEmail(projectId);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("[regenerateShootBrief] failed", { projectId, err });
    return { success: false, error: "Failed to regenerate shoot brief." };
  }
}

/**
 * Phase 3.4 — mint a fresh 1h presigned GET URL for the most recently stored
 * shoot brief. Returns the URL so the workspace can open it in a new tab.
 */
export async function getShootBriefDownloadUrl(
  projectId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await requireAdmin();
  try {
    const snap = await adminDb.collection("projects").doc(projectId).get();
    if (!snap.exists) return { success: false, error: "Project not found." };
    const data = snap.data()!;
    const key: string | undefined = data.shootBriefR2Key;
    if (!key) return { success: false, error: "No shoot brief on file." };
    const url = await generatePresignedGetUrl(key, 60 * 60); // 1h
    return { success: true, url };
  } catch (err) {
    console.error("[getShootBriefDownloadUrl] failed", { projectId, err });
    return { success: false, error: "Failed to build download link." };
  }
}

/**
 * Bulk-archive a set of projects from the pipeline table view.
 *
 * Sets status: "ARCHIVED" and appends a statusHistory entry on each project
 * via a single batched write. Does NOT run handleProjectTransition (archive
 * is a terminal off-ramp with no lifecycle side effects).
 */
export async function bulkArchiveProjects(
  ids: string[]
): Promise<{ success: boolean; error?: string; archivedCount?: number }> {
  const session = await requireAdmin();

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: false, error: "No projects selected." };
  }

  try {
    const batch = adminDb.batch();
    const historyEntry: StatusHistoryEntry = {
      status: "ARCHIVED" as ProjectStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    for (const id of ids) {
      const ref = adminDb.collection("projects").doc(id);
      batch.update(ref, {
        status: "ARCHIVED",
        statusHistory: FieldValue.arrayUnion(historyEntry),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    await logActivity(
      "STATUS_CHANGED",
      `Bulk archived ${ids.length} project${ids.length === 1 ? "" : "s"}`,
      { projectIds: ids, newStatus: "ARCHIVED" }
    ).catch(() => {});

    revalidatePath("/admin/projects");
    return { success: true, archivedCount: ids.length };
  } catch (err) {
    console.error("bulkArchiveProjects error:", err);
    return { success: false, error: "Failed to archive projects." };
  }
}

/**
 * Archive a single project from the workspace header. Terminal off-ramp,
 * no lifecycle hook is fired (mirrors bulkArchiveProjects behaviour).
 */
export async function archiveProject(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!projectId) return { success: false, error: "Missing project id." };

  try {
    const ref = adminDb.collection("projects").doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Project not found." };

    const historyEntry: StatusHistoryEntry = {
      status: "ARCHIVED" as ProjectStatus,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    await ref.update({
      status: "ARCHIVED",
      statusHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await logActivity(
      "STATUS_CHANGED",
      `Archived project "${snap.data()?.title ?? projectId}"`,
      { projectId, newStatus: "ARCHIVED" },
    ).catch(() => {});

    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("archiveProject error:", err);
    return { success: false, error: "Failed to archive project." };
  }
}

/**
 * Phase 3.6 — admin override for the weather-snapshot cron.
 *
 * Toggled from the project workspace's WeatherCard. When `indoor === true`,
 * `lib/domain/weather-snapshots.ts > refreshWeatherSnapshotsDue` skips this
 * project entirely (no Tomorrow.io fetch, no sun-times write).
 *
 * Does not clear an existing `weatherSnapshot` — admins occasionally toggle
 * indoor mid-prep, and stale data is still better signal than no data.
 */
export async function setProjectIndoorOverride(
  projectId: string,
  indoor: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    await adminDb.collection("projects").doc(projectId).update({
      weatherSnapshotIndoor: indoor,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath("/admin/projects");
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("setProjectIndoorOverride error:", err);
    return { success: false, error: "Failed to update indoor override." };
  }
}

/* ─────────────────────────  Saved Views (per-admin)  ───────────────────── */

/** Plain-serialisable shape returned to client components. */
export type SavedViewPayload = {
  id: string;
  name: string;
  filter: SavedViewFilter;
};

/**
 * List the current admin's user-saved pipeline views. Built-in defaults
 * (DEFAULT_SAVED_VIEWS in the pipeline UI) are not stored — the client
 * concatenates them with this list.
 */
export async function listMySavedViews(): Promise<SavedViewPayload[]> {
  const session = await requireAdmin();
  const rows = await listSavedViews(session.uid);
  return rows.map((v) => ({ id: v.id, name: v.name, filter: v.filter }));
}

/**
 * Persist a new saved view for the current admin. Returns the created doc
 * (with its server-generated id) so the client can update local state.
 */
export async function createMySavedView(
  data: { name: string; filter: SavedViewFilter }
): Promise<{ success: boolean; view?: SavedViewPayload; error?: string }> {
  const session = await requireAdmin();
  try {
    const created = await createSavedView(session.uid, data);
    return {
      success: true,
      view: { id: created.id, name: created.name, filter: created.filter },
    };
  } catch (err) {
    console.error("createMySavedView error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to save view.";
    return { success: false, error: message };
  }
}

/** Delete a user-saved view by id. Built-in views are not deletable here. */
export async function deleteMySavedView(
  viewId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!viewId) return { success: false, error: "Missing view id." };
  try {
    await deleteSavedView(session.uid, viewId);
    return { success: true };
  } catch (err) {
    console.error("deleteMySavedView error:", err);
    return { success: false, error: "Failed to delete view." };
  }
}

/* ─────────────────────  Editing sub-stage (Phase 3.13)  ───────────────────── */

/**
 * Advance / set the in-editing sub-stage for a project. Five-step stepper:
 *   INGESTION → CULLED → EDITED → EXPORTED → DELIVERED
 *
 * Writes:
 *   - `editingSubStage` = `stage`
 *   - appends `{ stage, at, byUid }` to `editingSubStageHistory`
 *
 * If `stage === "DELIVERED"`, this is also the canonical signal that the
 * gallery is out the door. We:
 *   - stamp `deliveredAt` (if not already set)
 *   - delegate to `updateProjectStatus(projectId, "GALLERY_DELIVERED")` so the
 *     existing `handleProjectTransition` hook fires (referral task, etc.)
 *
 * Idempotent — calling with the current stage is a no-op (returns success).
 */
export async function setEditingSubStage(
  projectId: string,
  stage: EditingSubStage
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!projectId) return { success: false, error: "Missing project id." };
  if (!EDITING_SUB_STAGES.includes(stage)) {
    return { success: false, error: "Invalid sub-stage." };
  }

  try {
    const ref = adminDb.collection("projects").doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Project not found." };

    const data = snap.data()!;
    const current = data.editingSubStage as EditingSubStage | undefined;

    // No-op when the stage is already set to the requested value AND the
    // status transition (if any) is also already done.
    if (current === stage && stage !== "DELIVERED") {
      return { success: true };
    }

    const historyEntry: {
      stage: EditingSubStage;
      at: Timestamp;
      byUid?: string;
    } = {
      stage,
      at: Timestamp.now(),
      ...(session.uid ? { byUid: session.uid } : {}),
    };

    const update: Record<string, unknown> = {
      editingSubStage: stage,
      editingSubStageHistory: FieldValue.arrayUnion(historyEntry),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (stage === "DELIVERED" && !data.deliveredAt) {
      update.deliveredAt = Timestamp.now();
    }

    await ref.update(update);

    await logActivity(
      "STATUS_CHANGED",
      `Project "${data.title ?? projectId}" editing → ${stage.toLowerCase()}`,
      { projectId, editingSubStage: stage }
    ).catch(() => {});

    // When the sub-stage hits DELIVERED, also flip the canonical project
    // status to GALLERY_DELIVERED so the lifecycle hook (referral task, etc.)
    // runs. `updateProjectStatus` already revalidates the same paths.
    if (stage === "DELIVERED" && data.status !== "GALLERY_DELIVERED") {
      const res = await updateProjectStatus(projectId, "GALLERY_DELIVERED");
      if (!res.success) return res;
    } else {
      revalidatePath("/admin/projects");
      revalidatePath(`/admin/projects/${projectId}`);
    }

    return { success: true };
  } catch (err) {
    console.error("setEditingSubStage error:", err);
    return { success: false, error: "Failed to update editing sub-stage." };
  }
}

/* ─────────────────────  Gear log (Phase 3.7)  ───────────────────── */

/**
 * Seed the per-project gear log from a named template. Idempotent: if the
 * project's gearLog subcollection already has entries, this returns success
 * with `created: 0` and does NOT touch existing rows. Re-seeding requires
 * deleting the existing entries first.
 */
export async function initializeGearLog(
  projectId: string,
  templateId: string
): Promise<{ success: boolean; created?: number; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!templateId) return { success: false, error: "Missing template id." };

  try {
    const result = await instantiateGearLogFromTemplate(projectId, templateId);

    await logActivity(
      "NOTE_ADDED",
      `Gear log initialised from template (${result.created} items)`,
      { projectId, templateId, ...result }
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, created: result.created };
  } catch (err) {
    console.error("initializeGearLog error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to initialise gear log.",
    };
  }
}

export async function toggleGearItemPacked(
  projectId: string,
  entryId: string,
  packed: boolean
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!projectId || !entryId) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    await markGearItemPacked(projectId, entryId, packed, session.uid);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("toggleGearItemPacked error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update gear item.",
    };
  }
}

export async function addAdHocGearItemAction(
  projectId: string,
  input: { name: string; category: GearItemCategory; required?: boolean; notes?: string }
): Promise<{ success: boolean; entryId?: string; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!input?.name?.trim()) return { success: false, error: "Name is required." };
  try {
    const entry = await addAdHocGearItem(projectId, input);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, entryId: entry.id };
  } catch (err) {
    console.error("addAdHocGearItemAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add gear item.",
    };
  }
}

export async function removeGearItemAction(
  projectId: string,
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId || !entryId) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    await removeGearItem(projectId, entryId);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("removeGearItemAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to remove gear item.",
    };
  }
}

/* ─────────────────  Recurring revenue (Phase 13.6)  ───────────────────── */

const VALID_CADENCES: RecurringCadence[] = ["ANNUAL", "SEMI_ANNUAL", "NONE"];

/**
 * Set the client's recurring re-engagement cadence. Resolves clientId
 * from projectId so the admin UI can call this with the projectId it
 * already has on the workspace page.
 */
export async function setRecurringCadenceAction(
  projectId: string,
  cadence: RecurringCadence
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!VALID_CADENCES.includes(cadence)) {
    return { success: false, error: "Invalid cadence." };
  }
  try {
    const snap = await adminDb.collection("projects").doc(projectId).get();
    if (!snap.exists) return { success: false, error: "Project not found." };
    const clientId: string | undefined = snap.data()?.clientId;
    if (!clientId) return { success: false, error: "Project has no client." };

    await setClientRecurringCadence(clientId, cadence);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("setRecurringCadenceAction error:", err);
    return { success: false, error: "Failed to update cadence." };
  }
}

/**
 * Snooze the re-engagement prompt for a client by 30 days. Used by the
 * inbox detail panel's "Snooze 30 days" button. Does NOT touch cadence.
 */
export async function dismissReengagementPrompt(
  clientId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!clientId) return { success: false, error: "Missing client id." };
  try {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    await bumpRecurringNextPromptAt(clientId, next);
    revalidatePath("/admin/inbox");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    console.error("dismissReengagementPrompt error:", err);
    return { success: false, error: "Failed to snooze prompt." };
  }
}

/* ─────────────────  Day-of room (Phase 13.11)  ───────────────────── */

/**
 * Enable the cross-vendor day-of room. Mints a fresh token if the project
 * doesn't already have one, then sets `dayOfRoomEnabled = true`. Returns the
 * shareable URL so the workspace can copy it directly.
 */
export async function enableDayOfRoom(
  projectId: string
): Promise<{ success: boolean; url?: string; token?: string; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    const ref = adminDb.collection("projects").doc(projectId);
    const snap = await ref.get();
    if (!snap.exists) return { success: false, error: "Project not found." };

    const existing: string | undefined = snap.data()?.dayOfRoomToken;
    const token = existing && typeof existing === "string"
      ? existing
      : await mintDayOfRoomToken(projectId);

    await ref.update({
      dayOfRoomEnabled: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const url = `${appUrl}/day-of-room/${projectId}?t=${token}`;

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, url, token };
  } catch (err) {
    console.error("enableDayOfRoom error:", err);
    return { success: false, error: "Failed to enable day-of room." };
  }
}

/**
 * Pause access to the day-of room without rotating the token. Re-enabling
 * via `enableDayOfRoom` restores the same shareable URL.
 */
export async function disableDayOfRoom(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    await adminDb.collection("projects").doc(projectId).update({
      dayOfRoomEnabled: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("disableDayOfRoom error:", err);
    return { success: false, error: "Failed to disable day-of room." };
  }
}

/**
 * Rotate the day-of room token. Any previously-shared URL stops working
 * immediately. Leaves `dayOfRoomEnabled` untouched so the room stays live
 * with the new token.
 */
export async function mintNewDayOfRoomToken(
  projectId: string
): Promise<{ success: boolean; url?: string; token?: string; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    const token = await mintDayOfRoomToken(projectId);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
    const url = `${appUrl}/day-of-room/${projectId}?t=${token}`;
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true, url, token };
  } catch (err) {
    console.error("mintNewDayOfRoomToken error:", err);
    return { success: false, error: "Failed to mint new token." };
  }
}

/**
 * Revoke the day-of room: clears the token AND sets `dayOfRoomEnabled = false`.
 * Re-enabling later requires `enableDayOfRoom` to mint a fresh credential.
 */
export async function revokeDayOfRoomTokenAction(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  try {
    await revokeDayOfRoomTokenDb(projectId);
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("revokeDayOfRoomTokenAction error:", err);
    return { success: false, error: "Failed to revoke token." };
  }
}

/**
 * Replace the explicit allow-list of vendor IDs surfaced in the day-of room.
 * Pass an empty array to fall back to the `vendors.linkedProjectIds`-only
 * lookup. Filters out non-string entries defensively.
 */
export async function setDayOfRoomVendorIds(
  projectId: string,
  ids: string[]
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!Array.isArray(ids)) return { success: false, error: "Invalid vendor list." };
  const cleaned = Array.from(
    new Set(ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0))
  );
  try {
    await adminDb.collection("projects").doc(projectId).update({
      dayOfRoomVendorIds: cleaned,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("setDayOfRoomVendorIds error:", err);
    return { success: false, error: "Failed to update vendor list." };
  }
}
