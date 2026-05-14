"use server";

// app/admin/settings/studio-hours/actions.ts
// Phase 13.2 — Server Action for the Studio Hours settings page.
//
// The form posts:
//   - `timezone` (string)
//   - `open_<day>` / `close_<day>` / `closed_<day>` for day 0–6
//   - `holidayDates` (one input per holiday OR comma-separated)
//   - `vacationStart`, `vacationEnd`
//   - `offHoursMessage`

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";
import { logActivity } from "@/lib/db/activity";
import {
  updateStudioHours,
  type StudioHours,
  type DayOfWeek,
  type DaySchedule,
} from "@/lib/db/admin-settings";

export type SaveStudioHoursResult =
  | { success: true }
  | { success: false; error: string };

/** "HH:MM" validator. Coerces invalid strings to null. */
function coerceTime(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  // Accept "HH:MM" or "H:MM" 24h.
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Validate "YYYY-MM-DD" — return null if malformed. */
function coerceDateKey(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  return trimmed;
}

export async function updateStudioHoursAction(
  formData: FormData
): Promise<SaveStudioHoursResult> {
  const session = await requireAdmin();

  try {
    const timezone =
      typeof formData.get("timezone") === "string"
        ? (formData.get("timezone") as string).trim()
        : "";
    if (!timezone) {
      return { success: false, error: "Timezone is required." };
    }

    // Build 7-day schedule.
    const weeklySchedule: DaySchedule[] = [];
    for (let i = 0; i < 7; i++) {
      const day = i as DayOfWeek;
      const closed = formData.get(`closed_${day}`) === "on";
      const open = closed ? null : coerceTime(formData.get(`open_${day}`));
      const close = closed ? null : coerceTime(formData.get(`close_${day}`));
      weeklySchedule.push({ dayOfWeek: day, open, close });
    }

    // Holidays: free-form textarea, one date per line OR comma-separated.
    const holidayRaw = formData.get("holidayDates");
    let holidayDates: string[] = [];
    if (typeof holidayRaw === "string") {
      holidayDates = holidayRaw
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    }

    const vacationStart = coerceDateKey(formData.get("vacationStart"));
    const vacationEnd = coerceDateKey(formData.get("vacationEnd"));

    const offHoursRaw = formData.get("offHoursMessage");
    const offHoursMessage =
      typeof offHoursRaw === "string" ? offHoursRaw.trim() : "";

    const patch: Partial<StudioHours> = {
      timezone,
      weeklySchedule,
      holidayDates,
      vacationStart,
      vacationEnd,
      offHoursMessage,
    };

    await updateStudioHours(session.uid, patch);

    await logActivity(
      "NOTE_ADDED",
      "Studio Hours settings updated",
      { uid: session.uid }
    ).catch(() => {});

    revalidatePath("/admin/settings/studio-hours");

    return { success: true };
  } catch (err) {
    console.error("updateStudioHoursAction error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to save settings.",
    };
  }
}
