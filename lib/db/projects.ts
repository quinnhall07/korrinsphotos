import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { LeadSource } from "./clients";

export type CommunicationChannel = "EMAIL" | "PHONE" | "SMS" | "IN_PERSON";

export type ProjectStatus =
  | "SITE_VISIT"
  | "INQUIRY"
  | "QUALIFYING"
  | "PROPOSAL_SENT"
  | "NEGOTIATING"
  | "CONTRACT_SENT"
  | "DEPOSIT_PENDING"
  | "BOOKED"
  | "SHOOT_READY"
  | "IN_EDITING"
  | "GALLERY_DELIVERED"
  | "REFERRAL_SENT"
  | "COMPLETED"
  | "LOST"
  | "ARCHIVED";

export type SessionType = "Wedding" | "Engagement" | "Portrait" | "Family" | "Editorial" | "Commercial" | string;

// Phase 3.13 — editing-workflow SLA constants live in a pure isomorphic
// module so client components can read them without dragging in the Admin
// SDK. Re-exported here for backwards compatibility with existing server
// callers; new client-side imports should target `@/lib/editing-sla` directly.
export {
  EDITING_SUB_STAGES,
  EDITING_SLA_DAYS_BY_SESSION_TYPE,
  DEFAULT_EDITING_SLA_DAYS,
  getEditingSlaDays,
  type EditingSubStage,
} from "@/lib/editing-sla";
import type { EditingSubStage } from "@/lib/editing-sla";

export interface Location {
  label: string;
  lat?: number;
  lng?: number;
  notes?: string;
}

export interface StatusHistoryEntry {
  status: ProjectStatus;
  at: Timestamp;
  byUid?: string;
}

export type LostReason =
  | "BUDGET"
  | "GHOSTED"
  | "DATE_UNAVAILABLE"
  | "LOST_TO_COMPETITOR"
  | "OTHER";

/**
 * Sun / golden-hour boundaries for a shoot, computed by `lib/golden-hour.ts`.
 * All fields are ISO-8601 timestamp strings in UTC. A field may be `null` if
 * the underlying calculation produced `NaN` (polar edge case where the sun
 * never rises or never sets on that calendar date).
 */
export interface SunTimesSnapshot {
  sunrise: string | null;
  sunset: string | null;
  goldenHourMorningStart: string | null;
  goldenHourMorningEnd: string | null;
  goldenHourEveningStart: string | null;
  goldenHourEveningEnd: string | null;
  blueHourMorning: string | null;
  blueHourEvening: string | null;
  solarNoon: string | null;
}

/**
 * Forecast + sun-times snapshot persisted on a project for the upcoming shoot.
 *
 * Populated by `lib/domain/weather-snapshots.ts > refreshWeatherSnapshotsDue`,
 * which is driven by the daily cron. Two passes overwrite each row:
 *   - 72h before `shootDate` (`forecastForHorizonHours === 72`)
 *   - 24h before `shootDate` (`forecastForHorizonHours === 24`)
 *
 * Original 3-field shape (`temp`, `conditions`, `fetchedAt`) is preserved so
 * older consumers continue to type-check; all other fields are optional and
 * may be absent on legacy rows.
 */
export interface WeatherSnapshot {
  /** Air temperature at shoot time, °F. */
  temp: number;
  /** Apparent ("feels like") temperature, °F. */
  feelsLike?: number;
  /** Low / high for the snapshot's day, °F. Reserved — not yet populated. */
  low?: number;
  high?: number;
  /** Normalized condition vocabulary from `lib/weather.ts > weatherCodeToCondition`. */
  conditions: string;
  /** 0–100. Precipitation probability at shoot time. */
  precipChance?: number;
  /** Sustained wind speed, mph. */
  windMph?: number;
  /** 0–100. Relative humidity. */
  humidityPct?: number;
  /** True when cloud cover, precip chance, and wind all fall inside the outdoor-friendly window. */
  isOutdoorFriendly?: boolean;
  /** When this snapshot was written. */
  fetchedAt: Timestamp;
  /** Which cron pass wrote this snapshot — 72h pre-shoot or 24h pre-shoot. */
  forecastForHorizonHours?: 72 | 24;
  /** Sun / golden-hour timing for the shoot date at the shoot location. */
  sunTimes?: SunTimesSnapshot;
}

export interface ProjectDoc {
  id: string;
  clientId: string;
  status: ProjectStatus;
  sessionType: SessionType;
  title: string;
  shootDate?: Timestamp | null;
  shootEndDate?: Timestamp | null;
  shootLocation?: Location | null;
  packageName?: string | null;
  packagePriceUsd?: number | null;
  discountApplied?: number | null;
  depositPaidAt?: Timestamp | null;
  balancePaidAt?: Timestamp | null;
  contractSignedAt?: Timestamp | null;
  deliveredAt?: Timestamp | null;
  referralLinkSentAt?: Timestamp | null;
  leadScore: number;
  leadSource: LeadSource;
  tags: string[];
  estimatedValue?: number | null;
  followUpDate?: Timestamp | null;
  lastContactedAt?: Timestamp | null;
  lastRespondedAt?: Timestamp | null;
  notes: string;
  /**
   * Phase 13.12 — "Off the record" notes. ADMIN-ONLY.
   *
   * ⚠️ NEVER send this field to the client, the portal, or any export
   * (welcome packet, shoot brief, journal post, contract, AI prompts, etc.).
   * Treat undefined and empty string identically. Only the admin
   * `/admin/projects/[id]` Notes tab is allowed to read this field.
   */
  offTheRecordNotes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  statusHistory?: StatusHistoryEntry[];
  lostReason?: LostReason;
  engagementScore?: number;
  lastEngagementAt?: Timestamp;
  clientNps?: 1 | 2 | 3 | 4 | 5;
  clientNpsAt?: Timestamp;
  weatherSnapshot?: WeatherSnapshot;
  /**
   * Admin override — when `true`, the daily weather cron skips this project
   * (used for studio / indoor shoots where forecasts are not useful).
   * Toggled from the Overview tab's WeatherCard.
   */
  weatherSnapshotIndoor?: boolean;
  shootBriefR2Key?: string;
  /** Phase 3.4 — set when the shoot-brief HTML packet is uploaded to R2. */
  shootBriefGeneratedAt?: Timestamp;
  /** Phase 2.7 welcome packet — set by `lib/domain/welcome-packet.ts`. */
  welcomePacketR2Key?: string;
  welcomePacketGeneratedAt?: Timestamp;
  /** 32-char hex token. Re-minted on each regeneration. The public read
   *  route checks `?t=<token>` against this; expiry is enforced by the R2
   *  presigned-URL lifetime. */
  welcomePacketToken?: string;
  /**
   * Phase 3.13 — sub-stage within IN_EDITING. Optional / back-compat: legacy
   * projects without this field are treated as having no sub-stage yet.
   */
  editingSubStage?: EditingSubStage;
  /**
   * Phase 3.13 — append-only sub-stage history. Each entry records when an
   * admin advanced (or set) the sub-stage and who did it.
   */
  editingSubStageHistory?: { stage: EditingSubStage; at: Timestamp; byUid?: string }[];

  // ─── Phase 3.9 — COI (Certificate of Insurance) workflow ────────────────────
  //
  // Venue-required shoots (most weddings, some commercial) need a COI issued
  // by the photographer's insurer naming the venue as an additional insured.
  // All fields are optional / back-compat — legacy projects render as "NONE".
  /**
   * Toggled by the admin on the Contract tab. When true, the request /
   * upload UI appears and the pipeline surfaces a "COI" chip.
   */
  coiRequired?: boolean;
  /** Set when `requestCoiAction` emails the insurer. */
  coiRequestedAt?: Timestamp;
  /** Insurer destination email captured from `users/{uid}.insurerContact.email`. */
  coiInsurerEmail?: string;
  /** Venue display name (e.g. "The Olde Mill"). */
  coiVenueName?: string;
  /** Full venue mailing address — printed on the cert. */
  coiVenueAddress?: string;
  /** Required additional-insured language. Defaults from user setting. */
  coiAdditionalInsuredText?: string;
  /** R2 object key under `coi/{projectId}/` once the cert PDF comes back. */
  coiR2Key?: string;
  /** Set when the cert PDF has been uploaded. */
  coiReceivedAt?: Timestamp;
  /** State machine: NONE (default) → REQUESTED → RECEIVED → EXPIRED. */
  coiStatus?: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED";

  // ─── Phase 13.11 — Cross-vendor day-of room ─────────────────────────────────
  //
  // A public, token-gated, read-only multi-vendor view of a wedding/event day.
  // Vendors open `${origin}/day-of-room/${projectId}?t=${token}` without
  // logging in. Token is constant-time compared on the public route; admin
  // can pause without revoking via `dayOfRoomEnabled`.
  /** 32-char hex; minted on demand by `mintDayOfRoomToken`. */
  dayOfRoomToken?: string;
  /** When the current `dayOfRoomToken` was minted. */
  dayOfRoomTokenIssuedAt?: Timestamp;
  /** Admin master switch — when false the public route rejects even with a valid token. */
  dayOfRoomEnabled?: boolean;
  /**
   * Explicit allow-list of vendor IDs surfaced in the room (overrides /
   * supplements the array-contains lookup on `vendors.linkedProjectIds`).
   */
  dayOfRoomVendorIds?: string[];

  /**
   * UX audit E.P0 — stamped when the client taps "Send my picks to Korrin"
   * in the gallery viewer. Signals to admin that favorites are final and
   * editing can proceed.
   */
  favoritesFinalizedAt?: Timestamp | null;
}

export interface MessageDoc {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: CommunicationChannel;
  subject?: string | null;
  body: string;
  adminUid?: string | null;
  sentAt: Timestamp;
  isAutomatic: boolean;
}

export const projectsCol = () => adminDb.collection("projects");
export const projectMessagesCol = (projectId: string) => projectsCol().doc(projectId).collection("messages");

export async function getProject(id: string): Promise<ProjectDoc | null> {
  const snap = await projectsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as ProjectDoc) : null;
}

export async function createProject(data: Omit<ProjectDoc, "id" | "createdAt" | "updatedAt">): Promise<ProjectDoc> {
  const ref = projectsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as ProjectDoc;
}

export async function updateProject(id: string, data: Partial<Omit<ProjectDoc, "id" | "createdAt" | "clientId">>): Promise<void> {
  await projectsCol().doc(id).update({ ...data, updatedAt: FieldValue.serverTimestamp() });
}

export async function listProjects(status?: ProjectStatus): Promise<ProjectDoc[]> {
  let query = projectsCol().orderBy("createdAt", "desc") as FirebaseFirestore.Query;
  if (status) query = query.where("status", "==", status);
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
}

export async function getProjectsByClientId(clientId: string): Promise<ProjectDoc[]> {
  const snap = await projectsCol().where("clientId", "==", clientId).orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
}

export async function addProjectMessage(projectId: string, message: Omit<MessageDoc, "id" | "sentAt">): Promise<MessageDoc> {
  const ref = projectMessagesCol(projectId).doc();
  const fullMessage = { ...message, sentAt: Timestamp.now() };
  await ref.set(fullMessage);
  return { id: ref.id, ...fullMessage } as MessageDoc;
}

// ---------------------------------------------------------------------------
// Wave 12 — Paginated listing
// ---------------------------------------------------------------------------
//
// `listProjects` reads the entire `projects/` collection in one shot, which is
// fine for the Kanban board (columns are inherently capped by status) but
// scales poorly for the table view as the pipeline grows. `listProjectsPaginated`
// is the cursor-based variant used by the table view at /admin/projects.
//
// Order: `updatedAt desc, __name__ desc` — most-recently-touched first, with
// the document ID as a stable tiebreaker (Firestore requires every orderBy
// field to participate in the cursor).
//
// Cursor: base64url-encoded `{ lastUpdatedAtMs, lastDocId }`. Forward-only —
// callers preserve the prior cursor in the URL stack if they want a back path.

export interface ListProjectsPage {
  projects: ProjectDoc[];
  nextCursor: string | null;
}

interface ProjectsCursorPayload {
  lastUpdatedAtMs: number;
  lastDocId: string;
}

function encodeProjectsCursor(payload: ProjectsCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodeProjectsCursor(cursor: string): ProjectsCursorPayload | null {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<ProjectsCursorPayload>;
    if (
      typeof parsed.lastUpdatedAtMs !== "number" ||
      typeof parsed.lastDocId !== "string"
    ) {
      return null;
    }
    return {
      lastUpdatedAtMs: parsed.lastUpdatedAtMs,
      lastDocId: parsed.lastDocId,
    };
  } catch {
    return null;
  }
}

/**
 * Cursor-paginated project list, ordered by `updatedAt desc` with the document
 * ID as a stable tiebreaker.
 *
 * - `pageSize` defaults to 50.
 * - `cursor` is the opaque token returned as `nextCursor` from the prior page.
 *   Invalid / undecodable cursors are silently ignored (page 1 is returned).
 * - `statusFilter` (when non-empty) adds `where("status", "in", statusFilter)`.
 *   Firestore's `in` operator caps at 30 values — passing more throws.
 *
 * Note: legacy projects written before `updatedAt` was always stamped will be
 * omitted from this list because Firestore drops docs missing the orderBy
 * field. The Kanban view (which still uses `listProjects`) is the safety net
 * for any such documents.
 */
export async function listProjectsPaginated(opts: {
  pageSize?: number;
  cursor?: string | null;
  statusFilter?: ProjectStatus[];
}): Promise<ListProjectsPage> {
  const pageSize = opts.pageSize ?? 50;
  if (opts.statusFilter && opts.statusFilter.length > 30) {
    throw new Error(
      "listProjectsPaginated: statusFilter exceeds Firestore 'in' cap of 30 values."
    );
  }

  let query: FirebaseFirestore.Query = projectsCol();
  if (opts.statusFilter && opts.statusFilter.length > 0) {
    query = query.where("status", "in", opts.statusFilter);
  }
  query = query
    .orderBy("updatedAt", "desc")
    .orderBy("__name__", "desc")
    .limit(pageSize + 1);

  if (opts.cursor) {
    const decoded = decodeProjectsCursor(opts.cursor);
    if (decoded) {
      query = query.startAfter(
        Timestamp.fromMillis(decoded.lastUpdatedAtMs),
        decoded.lastDocId
      );
    }
  }

  const snap = await query.get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectDoc));
  const hasMore = docs.length > pageSize;
  const trimmed = hasMore ? docs.slice(0, pageSize) : docs;

  let nextCursor: string | null = null;
  if (hasMore && trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    const lastUpdatedAtMs = last.updatedAt?.toMillis?.() ?? 0;
    nextCursor = encodeProjectsCursor({
      lastUpdatedAtMs,
      lastDocId: last.id,
    });
  }

  return { projects: trimmed, nextCursor };
}

// ---------------------------------------------------------------------------
// Phase 13.11 — Cross-vendor day-of room helpers
// ---------------------------------------------------------------------------
//
// Token model: a 32-char hex string (16 bytes from `crypto.randomBytes`)
// stored on the project. The public route at `app/day-of-room/[projectId]`
// constant-time compares against the stored token; admins can pause access
// without revoking by flipping `dayOfRoomEnabled` off (the token survives so
// re-enabling restores the same shareable URL).
//
// Index requirement: `findProjectByDayOfRoomToken` queries
// `where("dayOfRoomToken", "==", token).limit(1)`. Firestore satisfies this
// with the auto-built single-field index on `dayOfRoomToken`; no composite
// index is required. Documented in PROGRESS.md infra table.

import { randomBytes } from "crypto";

/**
 * Mint a fresh 32-char hex token for the day-of room, persist it, and return
 * the new value. Stamps `dayOfRoomTokenIssuedAt` and leaves `dayOfRoomEnabled`
 * untouched (callers flip the switch separately). Calling this rotates the
 * token — any previously-shared URL stops working.
 */
export async function mintDayOfRoomToken(projectId: string): Promise<string> {
  const token = randomBytes(16).toString("hex");
  await projectsCol().doc(projectId).update({
    dayOfRoomToken: token,
    dayOfRoomTokenIssuedAt: Timestamp.now(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return token;
}

/**
 * Clear the day-of room token AND set `dayOfRoomEnabled = false`. This is the
 * "kill the URL" path — re-enabling later requires `mintDayOfRoomToken` to
 * generate a fresh credential.
 */
export async function revokeDayOfRoomToken(projectId: string): Promise<void> {
  await projectsCol().doc(projectId).update({
    dayOfRoomToken: FieldValue.delete(),
    dayOfRoomTokenIssuedAt: FieldValue.delete(),
    dayOfRoomEnabled: false,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Look up a project by its day-of room token. Returns `null` when no doc
 * matches. Backed by Firestore's auto-built single-field index on
 * `dayOfRoomToken`; no composite index needed.
 */
export async function findProjectByDayOfRoomToken(
  token: string
): Promise<ProjectDoc | null> {
  if (!token) return null;
  const snap = await projectsCol()
    .where("dayOfRoomToken", "==", token)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ProjectDoc;
}
