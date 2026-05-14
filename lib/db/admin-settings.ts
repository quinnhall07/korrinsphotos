// lib/db/admin-settings.ts
// Phase 13.2 — Studio Hours auto-responder.
//
// Studio Hours are persisted as a nested map on the admin's
// `users/{uid}` doc (NOT a separate collection — the admin is the user).
// This file exposes typed read/write helpers and re-exports the shape so
// callers (booking actions, settings page, cron) can stay strongly typed
// without having to depend on the full `UserDoc`.
//
// Server-only.

import { FieldValue } from "firebase-admin/firestore";
import { usersCol, type UserDoc } from "@/lib/db/users";
import type { StateTaxRule } from "@/lib/sales-tax-rules";

/** Day of week, 0 = Sunday … 6 = Saturday. Matches `Date.getDay()`. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface DaySchedule {
  dayOfWeek: DayOfWeek;
  /** "HH:MM" 24h, or null if closed. */
  open: string | null;
  /** "HH:MM" 24h, or null if closed. */
  close: string | null;
}

export interface StudioHours {
  /** IANA tz name, e.g. "America/New_York". Required. */
  timezone: string;
  /** Length 7, indexed by dayOfWeek. */
  weeklySchedule: DaySchedule[];
  /** "YYYY-MM-DD" — fully closed days regardless of weekly schedule. */
  holidayDates?: string[];
  /** "YYYY-MM-DD" inclusive — start of vacation. */
  vacationStart?: string | null;
  /** "YYYY-MM-DD" inclusive — end of vacation. */
  vacationEnd?: string | null;
  /** Optional custom body fragment for the off-hours email. */
  offHoursMessage?: string;
}

/**
 * Default Studio Hours used when an admin has never configured them.
 * Mon–Fri 9am-5pm, weekends closed, America/New_York, no vacation, no
 * custom message (the email composer falls back to a built-in copy).
 */
export const DEFAULT_STUDIO_HOURS: StudioHours = {
  timezone: "America/New_York",
  weeklySchedule: [
    { dayOfWeek: 0, open: null, close: null },        // Sun closed
    { dayOfWeek: 1, open: "09:00", close: "17:00" },  // Mon
    { dayOfWeek: 2, open: "09:00", close: "17:00" },  // Tue
    { dayOfWeek: 3, open: "09:00", close: "17:00" },  // Wed
    { dayOfWeek: 4, open: "09:00", close: "17:00" },  // Thu
    { dayOfWeek: 5, open: "09:00", close: "17:00" },  // Fri
    { dayOfWeek: 6, open: null, close: null },        // Sat closed
  ],
  holidayDates: [],
  vacationStart: null,
  vacationEnd: null,
  offHoursMessage: "",
};

/**
 * Default off-hours email copy. Uses a `{nextOpenLabel}` token that
 * the caller swaps before send.
 */
export const DEFAULT_OFF_HOURS_MESSAGE =
  "Thanks for reaching out — Korrin is outside studio hours right now. " +
  "You'll hear back by {nextOpenLabel}.";

/**
 * Read the admin's stored Studio Hours. Returns `null` if the user doc
 * doesn't exist or has never had studio hours set — callers should fall
 * back to `DEFAULT_STUDIO_HOURS` (see `getStudioHoursOrDefault`).
 */
export async function getStudioHours(uid: string): Promise<StudioHours | null> {
  const snap = await usersCol().doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<UserDoc> & { studioHours?: StudioHours };
  return data.studioHours ?? null;
}

/**
 * Convenience wrapper that always returns a usable StudioHours — falls
 * back to `DEFAULT_STUDIO_HOURS` when the user has none set.
 */
export async function getStudioHoursOrDefault(uid: string): Promise<StudioHours> {
  const hours = await getStudioHours(uid);
  return hours ?? DEFAULT_STUDIO_HOURS;
}

/**
 * Partial-merge update — preserves keys the caller didn't touch. We write
 * to a nested field with merge:true so other fields on the user doc
 * (role, automationConfig, notificationPrefs, …) are not disturbed.
 */
export async function updateStudioHours(
  uid: string,
  patch: Partial<StudioHours>
): Promise<void> {
  const ref = usersCol().doc(uid);

  // Read-merge-write so partial patches don't drop existing keys (e.g.
  // changing only `timezone` should not blow away `weeklySchedule`).
  const snap = await ref.get();
  const existing =
    (snap.exists ? (snap.data() as Partial<UserDoc> & { studioHours?: StudioHours }).studioHours : undefined) ??
    DEFAULT_STUDIO_HOURS;

  const next: StudioHours = {
    timezone: patch.timezone ?? existing.timezone,
    weeklySchedule: patch.weeklySchedule ?? existing.weeklySchedule,
    holidayDates: patch.holidayDates ?? existing.holidayDates ?? [],
    vacationStart: patch.vacationStart ?? existing.vacationStart ?? null,
    vacationEnd: patch.vacationEnd ?? existing.vacationEnd ?? null,
    offHoursMessage: patch.offHoursMessage ?? existing.offHoursMessage ?? "",
  };

  await ref.set(
    { studioHours: next, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}

// ─── Phase 3.11 — Sales tax engine ────────────────────────────────────────────

/**
 * Per-admin sales-tax configuration. Stored as a nested map on the same
 * `users/{uid}` doc as Studio Hours (`taxConfig`) so a future migration to
 * a per-studio settings collection only has to move one path. All fields
 * optional — sensible defaults are baked into the read helpers below.
 *
 *  collectSalesTax           — master switch. When `false`, every invoice
 *                              gets `taxCents = 0` regardless of the client
 *                              state and the per-state overrides.
 *  defaultBusinessStateCode  — Korrin's home state (Cary, NC ⇒ "NC"). Used
 *                              as the fallback when a client has no
 *                              `billingStateCode` and the project carries no
 *                              `shootStateCode`.
 *  overrideRulesByState      — partial overrides keyed by the same two-letter
 *                              codes as `STATE_TAX_RULES`. The value is a
 *                              shallow partial — only the keys present
 *                              override the seeded rule.
 */
export interface TaxConfig {
  collectSalesTax: boolean;
  defaultBusinessStateCode: string;
  overrideRulesByState?: Record<string, Partial<StateTaxRule>>;
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  collectSalesTax: false,
  defaultBusinessStateCode: "NC",
  overrideRulesByState: {},
};

/**
 * Read the admin's stored tax config. Returns `null` when the user doc
 * doesn't exist or has never had a config set — callers should fall back
 * to `DEFAULT_TAX_CONFIG` (see `getTaxConfigOrDefault`).
 */
export async function getTaxConfig(uid: string): Promise<TaxConfig | null> {
  const snap = await usersCol().doc(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<UserDoc> & { taxConfig?: TaxConfig };
  return data.taxConfig ?? null;
}

/**
 * Convenience wrapper. Always returns a usable `TaxConfig` by falling back
 * to `DEFAULT_TAX_CONFIG`. The merge is shallow — `overrideRulesByState`
 * is replaced entirely when the user has any value.
 */
export async function getTaxConfigOrDefault(uid: string): Promise<TaxConfig> {
  const cfg = await getTaxConfig(uid);
  if (!cfg) return DEFAULT_TAX_CONFIG;
  return {
    collectSalesTax: !!cfg.collectSalesTax,
    defaultBusinessStateCode: cfg.defaultBusinessStateCode || DEFAULT_TAX_CONFIG.defaultBusinessStateCode,
    overrideRulesByState: cfg.overrideRulesByState ?? {},
  };
}

/**
 * Read the first admin user's tax config — convenience for server code that
 * needs the studio-wide policy without a session UID (e.g. invoice-creation
 * inside `project-transitions.ts`). Falls back to `DEFAULT_TAX_CONFIG` when
 * no admin exists yet.
 */
export async function getStudioTaxConfig(): Promise<TaxConfig> {
  const snap = await usersCol().where("role", "==", "ADMIN").limit(1).get();
  if (snap.empty) return DEFAULT_TAX_CONFIG;
  const data = snap.docs[0].data() as Partial<UserDoc> & { taxConfig?: TaxConfig };
  const cfg = data.taxConfig;
  if (!cfg) return DEFAULT_TAX_CONFIG;
  return {
    collectSalesTax: !!cfg.collectSalesTax,
    defaultBusinessStateCode: cfg.defaultBusinessStateCode || DEFAULT_TAX_CONFIG.defaultBusinessStateCode,
    overrideRulesByState: cfg.overrideRulesByState ?? {},
  };
}

/**
 * Partial-merge update. Preserves keys the caller didn't touch.
 */
export async function updateTaxConfig(
  uid: string,
  patch: Partial<TaxConfig>
): Promise<void> {
  const ref = usersCol().doc(uid);
  const snap = await ref.get();
  const existing =
    (snap.exists ? (snap.data() as Partial<UserDoc> & { taxConfig?: TaxConfig }).taxConfig : undefined) ??
    DEFAULT_TAX_CONFIG;

  const next: TaxConfig = {
    collectSalesTax:
      typeof patch.collectSalesTax === "boolean"
        ? patch.collectSalesTax
        : existing.collectSalesTax,
    defaultBusinessStateCode:
      patch.defaultBusinessStateCode ?? existing.defaultBusinessStateCode,
    overrideRulesByState:
      patch.overrideRulesByState ?? existing.overrideRulesByState ?? {},
  };

  await ref.set(
    { taxConfig: next, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
}
