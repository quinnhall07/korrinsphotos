// app/settings/page.tsx
// Client settings — display name, contact info, connected accounts, notification preferences.
// Server Component shell: reads the signed-in user's Firestore doc and passes
// initial state to the client form. requireSession() enforces auth.

import { requireSession } from "@/lib/session";
import { getUser } from "@/lib/db/users";
import SettingsClient, { type SettingsInitialData } from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const userDoc = await getUser(session.uid);

  const initial: SettingsInitialData = {
    uid: session.uid,
    email: session.email ?? userDoc?.email ?? "",
    displayName: userDoc?.displayName ?? "",
    phone: userDoc?.phone ?? "",
    notificationPrefs: {
      galleryAlerts: userDoc?.notificationPrefs?.galleryAlerts ?? true,
      bookingReminders: userDoc?.notificationPrefs?.bookingReminders ?? true,
    },
  };

  return <SettingsClient initial={initial} />;
}
