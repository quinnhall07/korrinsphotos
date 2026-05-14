"use server";

// app/settings/actions.ts
// Server Action for saving client settings — phone + notification prefs.
// Display name is persisted in Firestore here; Firebase Auth's displayName
// is updated client-side after this action succeeds.

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { updateUserPreferences, type NotificationPrefs } from "@/lib/db/users";

export interface SaveSettingsInput {
  displayName?: string;
  phone?: string;
  notificationPrefs?: NotificationPrefs;
}

export async function saveSettings(
  input: SaveSettingsInput
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();
  try {
    await updateUserPreferences(session.uid, {
      displayName: input.displayName ?? null,
      phone: input.phone,
      notificationPrefs: input.notificationPrefs,
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("[saveSettings] failed:", err);
    return { success: false, error: "Failed to save settings." };
  }
}
