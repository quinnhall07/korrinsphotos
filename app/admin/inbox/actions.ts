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
  snoozeItem,
  bulkMarkRead as dbBulkMarkRead,
  bulkArchive as dbBulkArchive,
} from "@/lib/db/inbox";

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
