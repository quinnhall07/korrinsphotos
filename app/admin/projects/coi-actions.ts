"use server";

// app/admin/projects/coi-actions.ts
// Phase 3.9 — Server Actions for the per-project COI (Certificate of
// Insurance) workflow. Co-located with `actions.ts` / `contract-actions.ts` /
// `invoice-actions.ts`. Every mutation guards with `requireAdmin()` and
// revalidates the project detail + pipeline routes.

import { revalidatePath } from "next/cache";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { getUser } from "@/lib/db/users";
import { getProject, updateProject } from "@/lib/db/projects";
import { createInboxItem } from "@/lib/db/inbox";
import { logActivity } from "@/lib/db/activity";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import { generatePresignedUploadUrl } from "@/lib/storage/r2";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDate(ts?: Timestamp | null): string {
  if (!ts) return "TBD";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "TBD";
  }
}

/**
 * Cert is typically wanted at least a week before the shoot. Returns null if
 * we can't compute (no shootDate).
 */
function computeCertNeededByLabel(shootDate?: Timestamp | null): string | null {
  if (!shootDate) return null;
  try {
    const d = shootDate.toDate();
    const needed = new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000);
    return needed.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

// ─── setCoiRequired ──────────────────────────────────────────────────────────

export async function setCoiRequiredAction(
  projectId: string,
  required: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };

  try {
    const project = await getProject(projectId);
    if (!project) return { success: false, error: "Project not found." };

    const patch: Record<string, unknown> = { coiRequired: required };
    // When toggling on for a project that has no status yet, seed to NONE so
    // the workspace + pipeline chip have a value to compare against.
    if (required && !project.coiStatus) patch.coiStatus = "NONE";
    // When toggling off, leave existing artefacts alone (admin may toggle
    // back and forth without losing the requested/received metadata).

    await updateProject(projectId, patch as never);

    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/admin/projects`);
    return { success: true };
  } catch (err) {
    console.error("setCoiRequiredAction error:", err);
    return { success: false, error: "Failed to update COI flag." };
  }
}

// ─── updateCoiVenueAction — capture venue details before requesting ──────────

export interface UpdateCoiVenueInput {
  coiVenueName?: string;
  coiVenueAddress?: string;
  coiAdditionalInsuredText?: string;
}

export async function updateCoiVenueAction(
  projectId: string,
  input: UpdateCoiVenueInput
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };

  try {
    const patch: Record<string, unknown> = {};
    if (input.coiVenueName !== undefined) {
      patch.coiVenueName = input.coiVenueName.trim();
    }
    if (input.coiVenueAddress !== undefined) {
      patch.coiVenueAddress = input.coiVenueAddress.trim();
    }
    if (input.coiAdditionalInsuredText !== undefined) {
      patch.coiAdditionalInsuredText = input.coiAdditionalInsuredText.trim();
    }
    if (Object.keys(patch).length === 0) return { success: true };

    await updateProject(projectId, patch as never);

    revalidatePath(`/admin/projects/${projectId}`);
    return { success: true };
  } catch (err) {
    console.error("updateCoiVenueAction error:", err);
    return { success: false, error: "Failed to save venue details." };
  }
}

// ─── requestCoiAction — email the insurer ────────────────────────────────────

export async function requestCoiAction(
  projectId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };

  try {
    const project = await getProject(projectId);
    if (!project) return { success: false, error: "Project not found." };
    if (!project.coiRequired) {
      return {
        success: false,
        error: "COI is not flagged as required for this project.",
      };
    }

    const adminUser = await getUser(session.uid);
    const insurer = adminUser?.insurerContact ?? {};
    const insurerEmail = insurer.email?.trim();
    if (!insurerEmail) {
      return {
        success: false,
        error:
          "Insurer email is not configured. Visit /admin/settings/insurer to set it.",
      };
    }

    const venueName = project.coiVenueName?.trim();
    const venueAddress = project.coiVenueAddress?.trim();
    if (!venueName || !venueAddress) {
      return {
        success: false,
        error: "Venue name and address are required before requesting a COI.",
      };
    }

    const additionalInsuredText =
      project.coiAdditionalInsuredText?.trim() ||
      insurer.defaultAdditionalInsuredText?.trim() ||
      "";

    // Pull the client doc for context lines in the email.
    const clientSnap = await adminDb
      .collection("clients")
      .doc(project.clientId)
      .get();
    const clientData = clientSnap.data() ?? {};
    const clientName = [clientData.firstName, clientData.lastName]
      .filter((s) => typeof s === "string" && s.trim())
      .join(" ")
      .trim();

    const shootDateLabel = fmtDate(project.shootDate ?? null);
    const certNeededBy = computeCertNeededByLabel(project.shootDate ?? null);

    const adminName = adminUser?.displayName?.trim() || "Korrin";
    const adminEmail = adminUser?.email ?? "";

    const subject = `Certificate of Insurance request — ${project.title || "shoot"} on ${shootDateLabel}`;
    const html = `<p>Hi${insurer.name ? ` ${escapeHtml(insurer.name)}` : ""},</p>
<p>I have a shoot coming up that requires a Certificate of Insurance naming the venue as an additional insured. Details below.</p>
<table style="border-collapse:collapse;font-family:Jost,sans-serif;font-size:14px;line-height:1.55">
  <tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Project</td><td>${escapeHtml(project.title || "Photography session")}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Session type</td><td>${escapeHtml(project.sessionType || "—")}</td></tr>
  ${clientName ? `<tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Client</td><td>${escapeHtml(clientName)}</td></tr>` : ""}
  <tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Shoot date</td><td>${escapeHtml(shootDateLabel)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Venue</td><td>${escapeHtml(venueName)}</td></tr>
  <tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px;vertical-align:top">Address</td><td>${escapeHtml(venueAddress).replace(/\n/g, "<br/>")}</td></tr>
  ${certNeededBy ? `<tr><td style="padding:4px 12px 4px 0;color:#6B7845;text-transform:uppercase;letter-spacing:0.15em;font-size:11px">Needed by</td><td>${escapeHtml(certNeededBy)}</td></tr>` : ""}
</table>
${additionalInsuredText ? `<p style="margin-top:18px"><strong>Additional insured language requested:</strong></p><blockquote style="border-left:2px solid #6B7845;padding:6px 12px;margin:8px 0;color:#2A2A28;font-style:italic">${escapeHtml(additionalInsuredText).replace(/\n/g, "<br/>")}</blockquote>` : ""}
<p>Please send the cert PDF back to this email when ready and I'll attach it to the booking. Let me know if you need any additional information.</p>
<p>Thanks,<br/>${escapeHtml(adminName)}${adminEmail ? `<br/><a href="mailto:${escapeHtml(adminEmail)}">${escapeHtml(adminEmail)}</a>` : ""}</p>`;

    await enqueueTrackedMail({
      to: insurerEmail,
      subject,
      html,
      projectId,
      sendKind: "coi-request",
    });

    // Best-effort copy back to Korrin so she has the request in her own inbox.
    // `enqueueTrackedMail` doesn't support CC natively — send a separate
    // tracked email and swallow failures.
    if (adminEmail && adminEmail.toLowerCase() !== insurerEmail.toLowerCase()) {
      try {
        await enqueueTrackedMail({
          to: adminEmail,
          subject: `[copy] ${subject}`,
          html:
            `<p style="color:#8A8A85;font-size:12px">Copy of the COI request sent to ${escapeHtml(insurerEmail)}.</p>` +
            html,
          projectId,
          sendKind: "coi-request-copy",
        });
      } catch (err) {
        console.error("[coi-actions] Failed to send admin copy", err);
      }
    }

    await updateProject(projectId, {
      coiStatus: "REQUESTED",
      coiRequestedAt: Timestamp.now(),
      coiInsurerEmail: insurerEmail,
      coiAdditionalInsuredText: additionalInsuredText || undefined,
    } as never);

    // Best-effort triage row.
    await createInboxItem({
      type: "COI_REQUESTED",
      projectId,
      clientId: project.clientId,
      title: `COI requested · ${venueName}`,
      body: `Sent to ${insurerEmail}. Shoot ${shootDateLabel}.`,
      link: `/admin/projects/${projectId}`,
      read: false,
    }).catch(() => {});

    await logActivity(
      "EMAIL_SENT",
      `COI requested for ${project.title || projectId}`,
      { projectId, venueName, insurerEmail }
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/admin/projects`);
    return { success: true };
  } catch (err) {
    console.error("requestCoiAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to request COI.",
    };
  }
}

// ─── presignCoiUploadAction — Step 1 of the PDF upload flow ──────────────────
//
// Returns a short-lived R2 PUT URL the browser uses to upload the cert PDF
// directly (bypasses Vercel's 4.5MB body cap). Server-side counterpart of the
// existing `/api/upload` route, but specific to COI PDFs.

export async function presignCoiUploadAction(
  projectId: string,
  fileName: string,
  contentType: string
): Promise<
  | { success: true; presignedUrl: string; key: string }
  | { success: false; error: string }
> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };

  // PDF only — the upload UI restricts file type, but defence-in-depth.
  if (contentType !== "application/pdf") {
    return { success: false, error: "Only PDF uploads are supported for COIs." };
  }
  if (!fileName || typeof fileName !== "string") {
    return { success: false, error: "Missing file name." };
  }

  try {
    const project = await getProject(projectId);
    if (!project) return { success: false, error: "Project not found." };

    const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
    const key = `coi/${projectId}/${Date.now()}_${safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`}`;

    const { presignedUrl } = await generatePresignedUploadUrl({
      key,
      contentType,
      // R2 metadata.eventId is required by the helper; reuse it for project
      // pivot so the object metadata records the project this cert belongs to.
      eventId: projectId,
    });

    return { success: true, presignedUrl, key };
  } catch (err) {
    console.error("presignCoiUploadAction error:", err);
    return { success: false, error: "Failed to mint upload URL." };
  }
}

// ─── confirmCoiUploadAction — Step 2 of the PDF upload flow ──────────────────

export async function confirmCoiUploadAction(
  projectId: string,
  r2Key: string
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  if (!projectId) return { success: false, error: "Missing project id." };
  if (!r2Key) return { success: false, error: "Missing R2 key." };

  // Trust-but-verify: the key must live under this project's COI prefix so
  // a bad caller can't point coiR2Key at an arbitrary R2 object.
  const expectedPrefix = `coi/${projectId}/`;
  if (!r2Key.startsWith(expectedPrefix)) {
    return { success: false, error: "R2 key does not belong to this project." };
  }

  try {
    const project = await getProject(projectId);
    if (!project) return { success: false, error: "Project not found." };

    await updateProject(projectId, {
      coiR2Key: r2Key,
      coiReceivedAt: Timestamp.now(),
      coiStatus: "RECEIVED",
    } as never);

    const venue = project.coiVenueName?.trim();
    await createInboxItem({
      type: "COI_RECEIVED",
      projectId,
      clientId: project.clientId,
      title: venue ? `COI received · ${venue}` : "COI received",
      body: "Cert PDF uploaded to project files.",
      link: `/admin/projects/${projectId}`,
      read: false,
    }).catch(() => {});

    await logActivity(
      "NOTE_ADDED",
      `COI received for ${project.title || projectId}`,
      { projectId, r2Key }
    ).catch(() => {});

    revalidatePath(`/admin/projects/${projectId}`);
    revalidatePath(`/admin/projects`);
    return { success: true };
  } catch (err) {
    console.error("confirmCoiUploadAction error:", err);
    return { success: false, error: "Failed to record COI upload." };
  }
}

