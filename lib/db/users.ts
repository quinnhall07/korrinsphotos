import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

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

/**
 * Phase 3.9 — Insurer contact for the COI (Certificate of Insurance) request
 * workflow. Stored on each admin's user doc so the "Request COI" action on a
 * project can auto-populate the insurer email and the additional-insured
 * language without re-prompting. All fields optional — feature degrades to
 * a prompt-on-send if absent.
 */
export interface InsurerContact {
  name?: string;
  email?: string;
  phone?: string;
  /**
   * Boilerplate additional-insured clause the venue's COI must contain.
   * Used as the default for the per-project `coiAdditionalInsuredText`.
   */
  defaultAdditionalInsuredText?: string;
}

export interface UserDoc {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: Role;
  phone?: string;
  notificationPrefs?: NotificationPrefs;
  automationConfig?: AutomationConfigMap;
  /** Phase 3.9 — per-admin insurer contact used by the COI request flow. */
  insurerContact?: InsurerContact;
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
 * Phase 3.9 — Persist (or update) the per-admin insurer contact. Stored on
 * `users/{uid}.insurerContact`. Empty-string fields are normalised to
 * `undefined` so the read site doesn't have to special-case blank values.
 */
export async function updateUserInsurerContact(
  uid: string,
  contact: InsurerContact
): Promise<void> {
  const trimmed: InsurerContact = {};
  if (contact.name && contact.name.trim()) trimmed.name = contact.name.trim();
  if (contact.email && contact.email.trim()) trimmed.email = contact.email.trim();
  if (contact.phone && contact.phone.trim()) trimmed.phone = contact.phone.trim();
  if (
    contact.defaultAdditionalInsuredText &&
    contact.defaultAdditionalInsuredText.trim()
  ) {
    trimmed.defaultAdditionalInsuredText = contact.defaultAdditionalInsuredText.trim();
  }

  const ref = usersCol().doc(uid);
  await ref.set(
    { insurerContact: trimmed, updatedAt: FieldValue.serverTimestamp() },
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

// ---------------------------------------------------------------------------
// Paginated listing
// ---------------------------------------------------------------------------

export interface ListUsersPage {
  users: UserDoc[];
  nextCursor: string | null;
}

interface CursorPayload {
  lastUid: string;
  lastCreatedAtMs: number;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (typeof parsed.lastUid !== "string" || typeof parsed.lastCreatedAtMs !== "number") {
      return null;
    }
    return { lastUid: parsed.lastUid, lastCreatedAtMs: parsed.lastCreatedAtMs };
  } catch {
    return null;
  }
}

/**
 * Cursor-based paginated user list, ordered by `createdAt desc` then `uid` for
 * a stable tiebreaker. Substring search is applied in-memory after fetching
 * `pageSize × 3` rows because Firestore does not index substrings; pure prefix
 * matching would miss "smith" when the email is "j.smith@…". The over-fetch
 * factor keeps the post-filter page reasonably full without paying for a full
 * collection scan on every keystroke.
 */
export async function listUsersPaginated(opts: {
  pageSize?: number;
  cursor?: string | null;
  search?: string;
}): Promise<ListUsersPage> {
  const pageSize = opts.pageSize ?? 50;
  const search = opts.search?.trim().toLowerCase() ?? "";
  const overFetch = search ? pageSize * 3 : pageSize;
  // Fetch one extra to detect whether a next page exists.
  const fetchLimit = overFetch + 1;

  let query = usersCol()
    .orderBy("createdAt", "desc")
    .orderBy("__name__", "desc")
    .limit(fetchLimit);

  if (opts.cursor) {
    const decoded = decodeCursor(opts.cursor);
    if (decoded) {
      query = query.startAfter(Timestamp.fromMillis(decoded.lastCreatedAtMs), decoded.lastUid);
    }
  }

  const snap = await query.get();
  const docs = snap.docs.map((doc) => ({
    uid: doc.id,
    ...(doc.data() as Omit<UserDoc, "uid">),
  }));

  const filtered = search
    ? docs.filter((u) => {
      const email = (u.email ?? "").toLowerCase();
      const name = (u.displayName ?? "").toLowerCase();
      return email.includes(search) || name.includes(search);
    })
    : docs;

  const trimmed = filtered.slice(0, pageSize);
  const hasMore = search ? filtered.length > pageSize : docs.length > pageSize;

  let nextCursor: string | null = null;
  if (hasMore && trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const lastCreatedAtMs = last.createdAt?.toMillis?.() ?? 0;
    nextCursor = encodeCursor({ lastUid: last.uid, lastCreatedAtMs });
  }

  return { users: trimmed, nextCursor };
}
