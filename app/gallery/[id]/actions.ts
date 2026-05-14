"use server";

// app/gallery/[id]/actions.ts
// Server Actions invoked by the client gallery viewer.
//
// `submitClientNps` captures the 5-star "how does this feel?" widget from
// Phase 2.11 (delivery + reaction capture). It is gated by:
//   1. `requireSession()` — the user must be signed in.
//   2. An `eventAccess/{uid}_{eventId}` doc must exist (or admin role).
//   3. The event must have a `projectId` so we can write `clientNps` to the
//      matching `projects/{id}` doc.
//   4. The signed-in user's email must match the project's client (looked
//      up via `clients/{clientId}.email`). Prevents an admin's session OR a
//      separately-authorised gallery user from clobbering someone else's
//      project NPS.
//
// On success we call `maybeScheduleReviewRequests(projectId)` which fans
// out 3 review request docs when NPS >= 4. The actual emails are deferred
// to the cron — see `lib/domain/reviews.ts`.

import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireSession } from "@/lib/session";
import { maybeScheduleReviewRequests } from "@/lib/domain/reviews";

export type SubmitNpsResult =
  | { success: true; scheduled: number }
  | { success: false; error: string };

const VALID_RATINGS = new Set([1, 2, 3, 4, 5]);

export async function submitClientNps(
  eventId: string,
  rating: number
): Promise<SubmitNpsResult> {
  if (!eventId || typeof eventId !== "string") {
    return { success: false, error: "Missing event." };
  }
  if (!VALID_RATINGS.has(rating)) {
    return { success: false, error: "Rating must be 1–5." };
  }

  const session = await requireSession();

  // Access gate: explicit eventAccess doc OR ADMIN session.
  const accessId = `${session.uid}_${eventId}`;
  const accessDoc = await adminDb.collection("eventAccess").doc(accessId).get();
  if (!accessDoc.exists && session.role !== "ADMIN") {
    return { success: false, error: "Not authorised for this event." };
  }

  // Need the event so we can find its project.
  const eventSnap = await adminDb.collection("events").doc(eventId).get();
  if (!eventSnap.exists) return { success: false, error: "Event not found." };
  const eventData = eventSnap.data()!;
  const projectId = (eventData.projectId as string | undefined) ?? null;
  if (!projectId) {
    return { success: false, error: "This gallery is not linked to a project yet." };
  }

  // Cross-check: the signed-in user's email must match the project's client.
  // Admins bypass — they may submit on behalf for testing/QA.
  if (session.role !== "ADMIN") {
    const projectSnap = await adminDb.collection("projects").doc(projectId).get();
    if (!projectSnap.exists) return { success: false, error: "Project not found." };
    const projectClientId = projectSnap.data()?.clientId as string | undefined;
    if (!projectClientId) return { success: false, error: "Project missing client." };
    const clientSnap = await adminDb
      .collection("clients")
      .doc(projectClientId)
      .get();
    const clientEmail = (clientSnap.data()?.email as string | undefined) ?? "";
    if (!session.email || clientEmail.toLowerCase() !== session.email.toLowerCase()) {
      return { success: false, error: "Signed-in user does not own this project." };
    }
  }

  try {
    await adminDb.collection("projects").doc(projectId).update({
      clientNps: rating,
      clientNpsAt: Timestamp.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error("[submitClientNps] update failed", { projectId, err });
    return { success: false, error: "Failed to save your rating." };
  }

  let scheduled = 0;
  if (rating >= 4) {
    try {
      scheduled = await maybeScheduleReviewRequests(projectId);
    } catch (err) {
      // Best-effort: NPS is already recorded; surface no error to client.
      console.error("[submitClientNps] scheduling failed", { projectId, err });
    }
  }

  revalidatePath(`/gallery/${eventId}`);
  revalidatePath(`/admin/projects/${projectId}`);
  return { success: true, scheduled };
}
