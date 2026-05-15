"use server";

// app/admin/inbox/actions.ts
// Server Actions for /admin/inbox triage. Every action gates on requireAdmin()
// and revalidates /admin/inbox + /admin (unread count badge lives on the dashboard).

import { requireAdmin } from "@/lib/session";
import { revalidatePath } from "next/cache";
import {
  markRead,
  markUnread,
  archiveItem,
  unarchiveItem,
  snoozeItem,
  clearSnooze,
  bulkMarkRead as dbBulkMarkRead,
  bulkArchive as dbBulkArchive,
  bulkUnarchive as dbBulkUnarchive,
} from "@/lib/db/inbox";
import { adminDb } from "@/lib/firebase-admin";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import { bumpRecurringNextPromptAt } from "@/lib/db/clients";
import {
  DEFAULT_REENGAGEMENT_BODY,
  DEFAULT_REENGAGEMENT_SUBJECT,
} from "@/lib/domain/recurring-revenue";

type ActionResult = { success: boolean; error?: string };

function revalidate() {
  revalidatePath("/admin/inbox");
  revalidatePath("/admin");
}

export async function markInboxRead(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await markRead(id);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("markInboxRead error:", err);
    return { success: false, error: "Failed to mark read." };
  }
}

export async function markInboxUnread(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await markUnread(id);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("markInboxUnread error:", err);
    return { success: false, error: "Failed to mark unread." };
  }
}

export async function archiveInboxItem(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await archiveItem(id);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("archiveInboxItem error:", err);
    return { success: false, error: "Failed to archive." };
  }
}

export async function unarchiveInboxItem(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await unarchiveItem(id);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("unarchiveInboxItem error:", err);
    return { success: false, error: "Failed to restore." };
  }
}

export async function unsnoozeInboxItem(id: string): Promise<ActionResult> {
  await requireAdmin();
  try {
    await clearSnooze(id);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("unsnoozeInboxItem error:", err);
    return { success: false, error: "Failed to unsnooze." };
  }
}

export async function snoozeInboxItem(
  id: string,
  hours: number = 24
): Promise<ActionResult> {
  await requireAdmin();
  try {
    const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
    const until = new Date(Date.now() + safeHours * 60 * 60 * 1000);
    await snoozeItem(id, until);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("snoozeInboxItem error:", err);
    return { success: false, error: "Failed to snooze." };
  }
}

export async function bulkMarkRead(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  try {
    await dbBulkMarkRead(ids);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("bulkMarkRead error:", err);
    return { success: false, error: "Failed to mark all read." };
  }
}

export async function bulkArchiveInboxItems(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  try {
    await dbBulkArchive(ids);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("bulkArchiveInboxItems error:", err);
    return { success: false, error: "Failed to archive selected." };
  }
}

export async function bulkUnarchiveInboxItems(ids: string[]): Promise<ActionResult> {
  await requireAdmin();
  try {
    await dbBulkUnarchive(ids);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("bulkUnarchiveInboxItems error:", err);
    return { success: false, error: "Failed to restore selected." };
  }
}

/* ─────────────── Phase 13.6 — re-engagement quick actions ─────────────── */

/**
 * Plain-text default copy for the re-engagement email. Exposed so the
 * inbox detail panel can render the textarea with the same string.
 */
export async function getDefaultReengagementBody(
  clientId: string
): Promise<{ subject: string; body: string }> {
  await requireAdmin();
  let firstName = "there";
  if (clientId) {
    try {
      const snap = await adminDb.collection("clients").doc(clientId).get();
      const fn = snap.data()?.firstName;
      if (typeof fn === "string" && fn.trim().length > 0) {
        firstName = fn.trim();
      }
    } catch {
      // Fallback — keep default firstName.
    }
  }
  return {
    subject: DEFAULT_REENGAGEMENT_SUBJECT,
    body: DEFAULT_REENGAGEMENT_BODY(firstName),
  };
}

/**
 * One-tap action from the inbox detail panel: enqueue a tracked
 * re-engagement email, advance `recurringNextPromptAt` by 12 months, and
 * archive the inbox item. The body comes from the panel (admin may have
 * edited the default copy in the textarea).
 */
export async function sendReengagementEmail(
  inboxItemId: string,
  clientId: string,
  override?: { subject?: string; body?: string }
): Promise<ActionResult> {
  await requireAdmin();
  if (!inboxItemId || !clientId) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    const snap = await adminDb.collection("clients").doc(clientId).get();
    if (!snap.exists) return { success: false, error: "Client not found." };
    const c = snap.data() ?? {};
    const email: string | undefined = c.email;
    if (!email) return { success: false, error: "Client has no email on file." };

    const firstName: string =
      typeof c.firstName === "string" && c.firstName.trim().length > 0
        ? c.firstName.trim()
        : "there";

    const subject =
      override?.subject?.trim() || DEFAULT_REENGAGEMENT_SUBJECT;
    const bodyText =
      override?.body?.trim() || DEFAULT_REENGAGEMENT_BODY(firstName);

    // Convert plain-text linebreaks into <p>/<br> wrappers — keeps the
    // email well-formatted while still letting Korrin edit prose without
    // touching HTML.
    const html =
      bodyText
        .split(/\n{2,}/)
        .map(
          (block) =>
            `<p>${block
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br/>")}</p>`
        )
        .join("");

    await enqueueTrackedMail({
      to: email,
      subject,
      html,
      text: bodyText,
      recipientClientId: clientId,
      sendKind: "re-engagement",
    });

    // Advance the next-prompt window 12 months so the cron doesn't
    // re-fire next month. Don't touch cadence — admin's choice.
    const next = new Date();
    next.setMonth(next.getMonth() + 12);
    await bumpRecurringNextPromptAt(clientId, next);

    // Archive the inbox row so it disappears from triage.
    await archiveItem(inboxItemId);

    revalidate();
    return { success: true };
  } catch (err) {
    console.error("sendReengagementEmail error:", err);
    return { success: false, error: "Failed to send re-engagement email." };
  }
}

/**
 * Snooze the recurring re-engagement window forward by 30 days and
 * archive the inbox prompt. Mirrors `dismissReengagementPrompt` in
 * `app/admin/projects/actions.ts` but co-located with the inbox UI so
 * the detail panel only needs one server-action import.
 */
export async function snoozeReengagement30Days(
  inboxItemId: string,
  clientId: string
): Promise<ActionResult> {
  await requireAdmin();
  if (!inboxItemId || !clientId) {
    return { success: false, error: "Missing identifiers." };
  }
  try {
    const next = new Date();
    next.setDate(next.getDate() + 30);
    await bumpRecurringNextPromptAt(clientId, next);
    await archiveItem(inboxItemId);
    revalidate();
    return { success: true };
  } catch (err) {
    console.error("snoozeReengagement30Days error:", err);
    return { success: false, error: "Failed to snooze." };
  }
}
