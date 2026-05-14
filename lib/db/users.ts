import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

export type Role = "ADMIN" | "CLIENT";

export interface NotificationPrefs {
  galleryAlerts?: boolean;
  bookingReminders?: boolean;
}

/**
 * Per-recipe automation overrides keyed by `AutomationRecipe.key`
 * (see `lib/automations/recipes.ts`). Persisted as a plain map so new
 * recipes can be added without a schema migration. `paramsJson` stores
 * the recipe's parameter bag as a JSON-encoded string so Firestore does
 * not have to round-trip arbitrary nested shapes.
 */
export interface AutomationConfigEntry {
  enabled: boolean;
  paramsJson?: string;
}

export type AutomationConfigMap = { [recipeKey: string]: AutomationConfigEntry };

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: Role;
  phone?: string;
  notificationPrefs?: NotificationPrefs;
  automationConfig?: AutomationConfigMap;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export const usersCol = () => adminDb.collection("users");

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await usersCol().doc(uid).get();
  if (!snap.exists) return null;
  return { uid: snap.id, ...(snap.data() as Omit<UserDoc, "uid">) };
}

export async function upsertUser(uid: string, data: Partial<UserDoc>): Promise<void> {
  const ref = usersCol().doc(uid);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      tx.set(ref, { ...data, createdAt: now, updatedAt: now });
    } else {
      tx.set(ref, { ...data, updatedAt: now }, { merge: true });
    }
  });
}

export interface UpdateUserPreferencesInput {
  phone?: string;
  notificationPrefs?: NotificationPrefs;
  displayName?: string | null;
}

export async function updateUserPreferences(
  uid: string,
  prefs: UpdateUserPreferencesInput
): Promise<void> {
  const ref = usersCol().doc(uid);
  await ref.set(
    { ...prefs, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Replace the user's full `automationConfig` map. Callers should merge
 * with `AUTOMATION_RECIPES` defaults at the read site rather than
 * persisting defaults — that way new recipes adopt their default
 * enabled/params values for free.
 */
export async function updateUserAutomationConfig(
  uid: string,
  config: AutomationConfigMap
): Promise<void> {
  const ref = usersCol().doc(uid);
  await ref.set(
    { automationConfig: config, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

/**
 * Find the first user with `role == "ADMIN"`. The automation config
 * is a per-user document, but project transitions don't currently know
 * which admin owns the action — see the comment on
 * `getEffectiveAutomationConfig` in `lib/automations/recipes.ts`.
 * Returns `null` if no admin exists yet.
 */
export async function getFirstAdminUser(): Promise<UserDoc | null> {
  const snap = await usersCol().where("role", "==", "ADMIN").limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { uid: doc.id, ...(doc.data() as Omit<UserDoc, "uid">) };
}
