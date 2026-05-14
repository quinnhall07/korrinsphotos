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
