import type { Metadata } from "next";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/session";
import { notFound } from "next/navigation";
import type { ProjectStatus } from "@/lib/db/projects";
import { listQuestionnairesForProject } from "@/lib/db/questionnaires";
import { listReviewRequestsForProject } from "@/lib/db/reviews";
import { listEmailEventsForProject } from "@/lib/db/email-events";
import { listProjectGearLog } from "@/lib/db/gear-log";
import {
  getDefaultGearTemplateForSessionType,
  listGearTemplatesForSessionType,
  type GearItemCategory,
} from "@/lib/db/gear-templates";
import {
  listPressSubmissionsForProject,
  type PressSubmissionStatus,
} from "@/lib/db/press-submissions";
import {
  listDayOfTimeline,
  type TimelineBlockType,
} from "@/lib/db/day-of-timeline";
import { getStyleProfile } from "@/lib/db/style-profiles";
import { STYLE_QUESTIONS } from "@/app/style/questions";
import { formatDisplayDate } from "@/lib/date";
import { getReplyTemplates } from "@/lib/db/admin-settings";
import { ProjectWorkspaceClient } from "./ProjectWorkspaceClient";

export const metadata: Metadata = { title: "Project Detail | Admin" };
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/**
 * Next-best-action hint per status. Pure mapping. Kept local — Next.js 16
 * disallows non-page exports from a route file. If another surface needs
 * the same chip, lift this into a shared helper module.
 */
function getNextBestAction(status: ProjectStatus | string): string {
  switch (status) {
    case "SITE_VISIT":
      return "Confirm site visit";
    case "INQUIRY":
      return "Send proposal";
    case "QUALIFYING":
      return "Qualify lead";
    case "PROPOSAL_SENT":
      return "Follow up";
    case "NEGOTIATING":
      return "Close the deal";
    case "CONTRACT_SENT":
      return "Nudge for signature";
    case "DEPOSIT_PENDING":
      return "Resend invoice";
    case "BOOKED":
      return "Send questionnaire";
    case "SHOOT_READY":
      return "Confirm logistics";
    case "IN_EDITING":
      return "Update editing ETA";
    case "GALLERY_DELIVERED":
      return "Request review";
    case "REFERRAL_SENT":
      return "Thank for referral";
    case "COMPLETED":
      return "Archive";
    case "LOST":
      return "Move to nurture";
    case "ARCHIVED":
      return "—";
    default:
      return "Review";
  }
}

// ─── Serialisable shapes for the client component ─────────────────────────────

export type SerialProject = {
  id: string;
  clientId: string;
  status: ProjectStatus | string;
  sessionType: string;
  title: string;
  shootDate: string | null;
  shootEndDate: string | null;
  shootLocation: { label?: string | null; lat?: number | null; lng?: number | null; notes?: string | null } | null;
  packageName: string | null;
  packagePriceUsd: number | null;
  discountApplied: number | null;
  estimatedValue: number | null;
  leadScore: number;
  leadSource: string;
  tags: string[];
  notes: string;
  /**
   * Phase 13.12 — admin-only "off the record" notes. NEVER rendered on
   * the client portal or in any export. Safe to ship to the admin
   * workspace because `/admin/**` is server-guarded by `requireAdmin()`.
   */
  offTheRecordNotes: string;
  followUpDate: string | null;
  lastContactedAt: string | null;
  lastRespondedAt: string | null;
  depositPaidAt: string | null;
  balancePaidAt: string | null;
  contractSignedAt: string | null;
  deliveredAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  statusHistory: { status: string; at: string; byUid?: string | null }[];
  clientNps: 1 | 2 | 3 | 4 | 5 | null;
  clientNpsAt: string | null;
  /** Phase 3.4 — set when the shoot brief HTML has been uploaded to R2. */
  shootBriefGeneratedAt: string | null;
  /** Phase 3.6 — admin override that suppresses the daily weather cron. */
  weatherSnapshotIndoor: boolean;
  /** Phase 3.6 — populated by `lib/domain/weather-snapshots.ts`. ISO strings. */
  weatherSnapshot: SerialWeatherSnapshot | null;
  /** Phase 3.13 — editing-workflow sub-stage. */
  editingSubStage: string | null;
  // ── Phase 3.9 — COI workflow ──────────────────────────────────────────────
  coiRequired: boolean;
  coiStatus: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED";
  coiRequestedAt: string | null;
  coiReceivedAt: string | null;
  coiInsurerEmail: string | null;
  coiVenueName: string | null;
  coiVenueAddress: string | null;
  coiAdditionalInsuredText: string | null;
  coiR2Key: string | null;
  // ── Phase 13.11 — Cross-vendor day-of room ────────────────────────────────
  dayOfRoomEnabled: boolean;
  dayOfRoomToken: string | null;
  dayOfRoomTokenIssuedAt: string | null;
  dayOfRoomVendorIds: string[];
};

export type SerialSunTimes = {
  sunrise: string | null;
  sunset: string | null;
  goldenHourMorningStart: string | null;
  goldenHourMorningEnd: string | null;
  goldenHourEveningStart: string | null;
  goldenHourEveningEnd: string | null;
  blueHourMorning: string | null;
  blueHourEvening: string | null;
  solarNoon: string | null;
};

export type SerialWeatherSnapshot = {
  temp: number;
  feelsLike: number | null;
  low: number | null;
  high: number | null;
  conditions: string;
  precipChance: number | null;
  windMph: number | null;
  humidityPct: number | null;
  isOutdoorFriendly: boolean | null;
  fetchedAt: string | null;
  forecastForHorizonHours: 72 | 24 | null;
  sunTimes: SerialSunTimes | null;
};

export type SerialClient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  avatarUrl: string | null;
  firstTouchSource: string;
  referralCredit: number;
  totalSessionsBooked: number;
  /** Phase 13.6 — recurring revenue layer. */
  recurringCadence: "ANNUAL" | "SEMI_ANNUAL" | "NONE";
  recurringNextPromptAt: string | null;
  recurringPromptsSent: number;
};

export type SerialMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: string;
  subject: string | null;
  body: string;
  adminUid: string | null;
  sentAt: string | null;
  isAutomatic: boolean;
  /** Phase 1.6 — present on outbound messages enqueued through
   *  `enqueueTrackedMail`. Used to render engagement chips below. */
  sendId: string | null;
  /** Phase 1.6 engagement counts (joined server-side from `emailEvents`). */
  openCount: number;
  clickCount: number;
};

export type SerialContract = {
  id: string;
  projectId: string;
  clientId: string;
  status: "DRAFT" | "SENT" | "SIGNED" | "VOIDED" | string;
  templateId: string;
  renderedHtml: string;
  signerIp: string | null;
  signerUserAgent: string | null;
  sentAt: string | null;
  signedAt: string | null;
  createdAt: string | null;
};

export type SerialQuestionnaire = {
  id: string;
  status: "PENDING" | "COMPLETED";
  sentAt: string | null;
  completedAt: string | null;
};

export type SerialReviewRequest = {
  id: string;
  platform: "GOOGLE" | "KNOT" | "FACEBOOK";
  status: "QUEUED" | "SENT" | "CLICKED" | "SUBMITTED";
  scheduledFor: string | null;
  sentAt: string | null;
  clickedAt: string | null;
  submittedAt: string | null;
};

export type SerialGearLogEntry = {
  id: string;
  gearItemId: string;
  name: string;
  category: GearItemCategory;
  required: boolean;
  packed: boolean;
  packedAt: string | null;
  packedByUid: string | null;
  notes: string | null;
};

export type SerialGearTemplateOption = {
  id: string;
  name: string;
  itemCount: number;
  isDefault: boolean;
};

export type SerialTimelineBlock = {
  id: string;
  order: number;
  title: string;
  startTime: string;
  durationMinutes: number;
  location: string | null;
  blockType: TimelineBlockType;
  notes: string | null;
  visibleToClient: boolean;
};

/** Phase 13.11 — vendor entry rendered in the Day-of room admin card. */
export type SerialDayOfRoomVendorOption = {
  id: string;
  name: string;
  category: string;
  /** True when the vendor's `linkedProjectIds` already contains this project. */
  linkedToProject: boolean;
  /** True when the vendor is currently in `dayOfRoomVendorIds`. */
  inAllowList: boolean;
};

export type SerialPressSubmission = {
  id: string;
  publicationName: string;
  publicationUrl: string | null;
  contactName: string | null;
  contactEmail: string | null;
  submittedAt: string | null;
  status: PressSubmissionStatus | string;
  statusChangedAt: string | null;
  publishedUrl: string | null;
  publishedAt: string | null;
  lastLinkCheckAt: string | null;
  linkAlive: boolean | null;
  linkLastHttpStatus: number | null;
  consecutiveLinkFailures: number;
  notes: string | null;
};

export type SerialInvoice = {
  id: string;
  projectId: string;
  clientId: string;
  type: string;
  status: string;
  amountCents: number;
  dueDate: string | null;
  paidAt: string | null;
  sentAt: string | null;
  stripePaymentLinkUrl: string | null;
  createdAt: string | null;

  // Refund / dispute ledger (Phase 3.12)
  refundCents: number | null;
  refundReason: string | null;
  refundedAt: string | null;
  disputeStatus: string | null;
  disputeReason: string | null;
  disputeAmountCents: number | null;
  disputeOpenedAt: string | null;
  disputeClosedAt: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts(value: any): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && typeof value.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function boolOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function isoOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function serialiseWeatherSnapshot(raw: any): SerialWeatherSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.temp !== "number" || typeof raw.conditions !== "string") return null;

  const horizon =
    raw.forecastForHorizonHours === 72 || raw.forecastForHorizonHours === 24
      ? (raw.forecastForHorizonHours as 72 | 24)
      : null;

  const sunRaw = raw.sunTimes;
  const sunTimes: SerialSunTimes | null =
    sunRaw && typeof sunRaw === "object"
      ? {
          sunrise: isoOrNull(sunRaw.sunrise),
          sunset: isoOrNull(sunRaw.sunset),
          goldenHourMorningStart: isoOrNull(sunRaw.goldenHourMorningStart),
          goldenHourMorningEnd: isoOrNull(sunRaw.goldenHourMorningEnd),
          goldenHourEveningStart: isoOrNull(sunRaw.goldenHourEveningStart),
          goldenHourEveningEnd: isoOrNull(sunRaw.goldenHourEveningEnd),
          blueHourMorning: isoOrNull(sunRaw.blueHourMorning),
          blueHourEvening: isoOrNull(sunRaw.blueHourEvening),
          solarNoon: isoOrNull(sunRaw.solarNoon),
        }
      : null;

  return {
    temp: raw.temp,
    feelsLike: numOrNull(raw.feelsLike),
    low: numOrNull(raw.low),
    high: numOrNull(raw.high),
    conditions: raw.conditions,
    precipChance: numOrNull(raw.precipChance),
    windMph: numOrNull(raw.windMph),
    humidityPct: numOrNull(raw.humidityPct),
    isOutdoorFriendly: boolOrNull(raw.isOutdoorFriendly),
    fetchedAt: ts(raw.fetchedAt),
    forecastForHorizonHours: horizon,
    sunTimes,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({ params }: Props) {
  const session = await requireAdmin();
  const { id } = await params;

  const projectSnap = await adminDb.collection("projects").doc(id).get();
  if (!projectSnap.exists) notFound();
  const projectData = projectSnap.data()!;

  const clientId: string = projectData.clientId;

  // Fan-out: client, messages, invoices, latest contract, linked event.
  const [clientSnap, messagesSnap, invoicesSnap, contractsSnap, eventsSnap] = await Promise.all([
    adminDb.collection("clients").doc(clientId).get(),
    adminDb
      .collection("projects")
      .doc(id)
      .collection("messages")
      .orderBy("sentAt", "asc")
      .get(),
    adminDb.collection("invoices").where("projectId", "==", id).get(),
    adminDb
      .collection("contracts")
      .where("projectId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get(),
    adminDb.collection("events").where("projectId", "==", id).limit(1).get(),
  ]);

  const clientData = clientSnap.data();

  const project: SerialProject = {
    id,
    clientId,
    status: projectData.status,
    sessionType: projectData.sessionType ?? "",
    title: projectData.title ?? "Untitled project",
    shootDate: ts(projectData.shootDate),
    shootEndDate: ts(projectData.shootEndDate),
    shootLocation: projectData.shootLocation
      ? {
          label: projectData.shootLocation.label ?? null,
          lat: projectData.shootLocation.lat ?? null,
          lng: projectData.shootLocation.lng ?? null,
          notes: projectData.shootLocation.notes ?? null,
        }
      : null,
    packageName: projectData.packageName ?? null,
    packagePriceUsd: projectData.packagePriceUsd ?? null,
    discountApplied: projectData.discountApplied ?? null,
    estimatedValue: projectData.estimatedValue ?? null,
    leadScore: projectData.leadScore ?? 0,
    leadSource: projectData.leadSource ?? "DIRECT",
    tags: Array.isArray(projectData.tags) ? projectData.tags : [],
    notes: typeof projectData.notes === "string" ? projectData.notes : "",
    offTheRecordNotes:
      typeof projectData.offTheRecordNotes === "string"
        ? projectData.offTheRecordNotes
        : "",
    followUpDate: ts(projectData.followUpDate),
    lastContactedAt: ts(projectData.lastContactedAt),
    lastRespondedAt: ts(projectData.lastRespondedAt),
    depositPaidAt: ts(projectData.depositPaidAt),
    balancePaidAt: ts(projectData.balancePaidAt),
    contractSignedAt: ts(projectData.contractSignedAt),
    deliveredAt: ts(projectData.deliveredAt),
    createdAt: ts(projectData.createdAt),
    updatedAt: ts(projectData.updatedAt),
    statusHistory: Array.isArray(projectData.statusHistory)
      ? projectData.statusHistory.map((h: any) => ({
          status: h.status,
          at: ts(h.at) ?? "",
          byUid: h.byUid ?? null,
        }))
      : [],
    clientNps:
      typeof projectData.clientNps === "number" &&
      projectData.clientNps >= 1 &&
      projectData.clientNps <= 5
        ? (projectData.clientNps as 1 | 2 | 3 | 4 | 5)
        : null,
    clientNpsAt: ts(projectData.clientNpsAt),
    shootBriefGeneratedAt: ts(projectData.shootBriefGeneratedAt),
    weatherSnapshotIndoor: !!projectData.weatherSnapshotIndoor,
    weatherSnapshot: serialiseWeatherSnapshot(projectData.weatherSnapshot),
    editingSubStage:
      typeof projectData.editingSubStage === "string"
        ? projectData.editingSubStage
        : null,
    coiRequired: !!projectData.coiRequired,
    coiStatus:
      projectData.coiStatus === "REQUESTED" ||
      projectData.coiStatus === "RECEIVED" ||
      projectData.coiStatus === "EXPIRED"
        ? (projectData.coiStatus as "REQUESTED" | "RECEIVED" | "EXPIRED")
        : "NONE",
    coiRequestedAt: ts(projectData.coiRequestedAt),
    coiReceivedAt: ts(projectData.coiReceivedAt),
    coiInsurerEmail:
      typeof projectData.coiInsurerEmail === "string"
        ? projectData.coiInsurerEmail
        : null,
    coiVenueName:
      typeof projectData.coiVenueName === "string" ? projectData.coiVenueName : null,
    coiVenueAddress:
      typeof projectData.coiVenueAddress === "string"
        ? projectData.coiVenueAddress
        : null,
    coiAdditionalInsuredText:
      typeof projectData.coiAdditionalInsuredText === "string"
        ? projectData.coiAdditionalInsuredText
        : null,
    coiR2Key:
      typeof projectData.coiR2Key === "string" ? projectData.coiR2Key : null,
    dayOfRoomEnabled: projectData.dayOfRoomEnabled === true,
    dayOfRoomToken:
      typeof projectData.dayOfRoomToken === "string" ? projectData.dayOfRoomToken : null,
    dayOfRoomTokenIssuedAt: ts(projectData.dayOfRoomTokenIssuedAt),
    dayOfRoomVendorIds: Array.isArray(projectData.dayOfRoomVendorIds)
      ? (projectData.dayOfRoomVendorIds as unknown[]).filter(
          (id): id is string => typeof id === "string"
        )
      : [],
  };

  const rawCadence =
    typeof clientData?.recurringCadence === "string"
      ? clientData.recurringCadence
      : "NONE";
  const cadence: "ANNUAL" | "SEMI_ANNUAL" | "NONE" =
    rawCadence === "ANNUAL" || rawCadence === "SEMI_ANNUAL" || rawCadence === "NONE"
      ? rawCadence
      : "NONE";

  const client: SerialClient = {
    id: clientId,
    email: clientData?.email ?? "",
    firstName: clientData?.firstName ?? "",
    lastName: clientData?.lastName ?? "",
    phone: clientData?.phone ?? null,
    avatarUrl: clientData?.avatarUrl ?? null,
    firstTouchSource: clientData?.firstTouchSource ?? "DIRECT",
    referralCredit: clientData?.referralCredit ?? 0,
    totalSessionsBooked: clientData?.totalSessionsBooked ?? 0,
    recurringCadence: cadence,
    recurringNextPromptAt: ts(clientData?.recurringNextPromptAt),
    recurringPromptsSent:
      typeof clientData?.recurringPromptsSent === "number"
        ? clientData.recurringPromptsSent
        : 0,
  };

  // Phase 1.6 — fetch all emailEvents for this project and roll up per-sendId
  // open/click counts. Best-effort: if the query fails (missing index, etc.)
  // we still render the messages tab without chips.
  const engagementBySendId = new Map<string, { opened: number; clicked: number }>();
  try {
    const events = await listEmailEventsForProject(id);
    for (const e of events) {
      if (!e.sendId) continue;
      const cur = engagementBySendId.get(e.sendId) ?? { opened: 0, clicked: 0 };
      if (e.type === "opened") cur.opened += 1;
      else if (e.type === "clicked") cur.clicked += 1;
      engagementBySendId.set(e.sendId, cur);
    }
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load email events", err);
  }

  const messages: SerialMessage[] = messagesSnap.docs.map((d) => {
    const m = d.data();
    const sendId: string | null = typeof m.sendId === "string" ? m.sendId : null;
    const eng = sendId ? engagementBySendId.get(sendId) : undefined;
    return {
      id: d.id,
      direction: m.direction === "INBOUND" ? "INBOUND" : "OUTBOUND",
      channel: m.channel ?? "EMAIL",
      subject: m.subject ?? null,
      body: m.body ?? "",
      adminUid: m.adminUid ?? null,
      sentAt: ts(m.sentAt),
      isAutomatic: !!m.isAutomatic,
      sendId,
      openCount: eng?.opened ?? 0,
      clickCount: eng?.clicked ?? 0,
    };
  });

  const invoices: SerialInvoice[] = invoicesSnap.docs
    .map((d) => {
      const i = d.data();
      return {
        id: d.id,
        projectId: i.projectId,
        clientId: i.clientId,
        type: i.type,
        status: i.status,
        amountCents: i.amountCents ?? 0,
        dueDate: ts(i.dueDate),
        paidAt: ts(i.paidAt),
        sentAt: ts(i.sentAt),
        stripePaymentLinkUrl: i.stripePaymentLinkUrl ?? null,
        createdAt: ts(i.createdAt),
        refundCents: typeof i.refundCents === "number" ? i.refundCents : null,
        refundReason: typeof i.refundReason === "string" ? i.refundReason : null,
        refundedAt: ts(i.refundedAt),
        disputeStatus: typeof i.disputeStatus === "string" ? i.disputeStatus : null,
        disputeReason: typeof i.disputeReason === "string" ? i.disputeReason : null,
        disputeAmountCents:
          typeof i.disputeAmountCents === "number" ? i.disputeAmountCents : null,
        disputeOpenedAt: ts(i.disputeOpenedAt),
        disputeClosedAt: ts(i.disputeClosedAt),
      };
    })
    // Order: DEPOSIT first, then BALANCE, then FULL, then by createdAt
    .sort((a, b) => {
      const order: Record<string, number> = { DEPOSIT: 0, BALANCE: 1, FULL: 2 };
      const oa = order[a.type] ?? 9;
      const ob = order[b.type] ?? 9;
      if (oa !== ob) return oa - ob;
      return (a.createdAt ?? "").localeCompare(b.createdAt ?? "");
    });

  let contract: SerialContract | null = null;
  if (!contractsSnap.empty) {
    const c = contractsSnap.docs[0].data();
    contract = {
      id: contractsSnap.docs[0].id,
      projectId: c.projectId,
      clientId: c.clientId,
      status: c.status,
      templateId: c.templateId ?? "",
      renderedHtml: c.renderedHtml ?? "",
      signerIp: c.signerIp ?? null,
      signerUserAgent: c.signerUserAgent ?? null,
      sentAt: ts(c.sentAt),
      signedAt: ts(c.signedAt),
      createdAt: ts(c.createdAt),
    };
  }

  const eventId: string | null = eventsSnap.empty ? null : eventsSnap.docs[0].id;

  // Pull every questionnaire instance for this project so the workspace can
  // show PENDING/COMPLETED state in the Overview tab.
  let questionnaires: SerialQuestionnaire[] = [];
  try {
    const docs = await listQuestionnairesForProject(id);
    questionnaires = docs.map((q) => ({
      id: q.id,
      status: q.status,
      sentAt: ts(q.sentAt),
      completedAt: ts(q.completedAt),
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load questionnaires", err);
  }

  // Phase 4.6: pull review request rotation state so the Overview tab can
  // render the "{n} of 3 sent" badge alongside the NPS score.
  let reviewRequests: SerialReviewRequest[] = [];
  try {
    const docs = await listReviewRequestsForProject(id);
    reviewRequests = docs.map((r) => ({
      id: r.id,
      platform: r.platform,
      status: r.status,
      scheduledFor: ts(r.scheduledFor),
      sentAt: ts(r.sentAt),
      clickedAt: ts(r.clickedAt),
      submittedAt: ts(r.submittedAt),
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load review requests", err);
  }

  // Phase 3.7: pull the project's gear log (per-shoot pack-check) plus all
  // candidate templates for the project's sessionType so the Gear tab can
  // render either an empty-state "Initialize from template" CTA or the live
  // check-off list.
  let gearLog: SerialGearLogEntry[] = [];
  try {
    const entries = await listProjectGearLog(id);
    gearLog = entries.map((e) => ({
      id: e.id,
      gearItemId: e.gearItemId,
      name: e.name,
      category: e.category,
      required: !!e.required,
      packed: !!e.packed,
      packedAt: ts(e.packedAt),
      packedByUid: e.packedByUid ?? null,
      notes: e.notes ?? null,
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load gear log", err);
  }

  let gearTemplateOptions: SerialGearTemplateOption[] = [];
  let defaultGearTemplateId: string | null = null;
  let defaultGearTemplateName: string | null = null;
  try {
    const sessionType = projectData.sessionType as string | undefined;
    if (sessionType) {
      const [candidates, def] = await Promise.all([
        listGearTemplatesForSessionType(sessionType),
        getDefaultGearTemplateForSessionType(sessionType),
      ]);
      gearTemplateOptions = candidates.map((t) => ({
        id: t.id,
        name: t.name,
        itemCount: Array.isArray(t.items) ? t.items.length : 0,
        isDefault: !!t.isDefault,
      }));
      if (def) {
        defaultGearTemplateId = def.id;
        defaultGearTemplateName = def.name;
      } else if (candidates.length > 0) {
        // No flagged default — fall back to the first candidate so the Gear
        // tab still has something to offer in its empty state.
        defaultGearTemplateId = candidates[0].id;
        defaultGearTemplateName = candidates[0].name;
      }
    }
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load gear templates", err);
  }

  // Phase 2.8: pull the project's day-of timeline blocks (drag-orderable list
  // of "12:00 — First look @ Garden" entries). Best-effort — if the read
  // fails the workspace renders an empty timeline tab.
  let dayOfTimeline: SerialTimelineBlock[] = [];
  try {
    const blocks = await listDayOfTimeline(id);
    dayOfTimeline = blocks.map((b) => ({
      id: b.id,
      order: b.order,
      title: b.title,
      startTime: b.startTime,
      durationMinutes: b.durationMinutes,
      location: b.location ?? null,
      blockType: b.blockType,
      notes: b.notes ?? null,
      visibleToClient: !!b.visibleToClient,
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load day-of timeline", err);
  }

  // Phase 4.7: pull press-submission rows. Best-effort — Firestore hiccup
  // shouldn't break the entire workspace.
  let pressSubmissions: SerialPressSubmission[] = [];
  try {
    const docs = await listPressSubmissionsForProject(id);
    pressSubmissions = docs.map((p) => ({
      id: p.id,
      publicationName: p.publicationName ?? "",
      publicationUrl: p.publicationUrl ?? null,
      contactName: p.contactName ?? null,
      contactEmail: p.contactEmail ?? null,
      submittedAt: ts(p.submittedAt),
      status: p.status,
      statusChangedAt: ts(p.statusChangedAt),
      publishedUrl: p.publishedUrl ?? null,
      publishedAt: ts(p.publishedAt),
      lastLinkCheckAt: ts(p.lastLinkCheckAt),
      linkAlive:
        typeof p.linkAlive === "boolean" ? p.linkAlive : null,
      linkLastHttpStatus:
        typeof p.linkLastHttpStatus === "number" ? p.linkLastHttpStatus : null,
      consecutiveLinkFailures:
        typeof p.consecutiveLinkFailures === "number"
          ? p.consecutiveLinkFailures
          : 0,
      notes: p.notes ?? null,
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load press submissions", err);
  }

  // Phase 3.9 — pull the admin's insurer-contact defaults so the COI block
  // can pre-fill the additional-insured language. Best-effort.
  let insurerDefaultAdditionalInsuredText: string | null = null;
  let insurerEmailConfigured = false;
  try {
    const adminUserSnap = await adminDb
      .collection("users")
      .doc(session.uid)
      .get();
    const insurer = (adminUserSnap.data()?.insurerContact ?? {}) as {
      email?: string;
      defaultAdditionalInsuredText?: string;
    };
    if (
      typeof insurer.defaultAdditionalInsuredText === "string" &&
      insurer.defaultAdditionalInsuredText.trim()
    ) {
      insurerDefaultAdditionalInsuredText = insurer.defaultAdditionalInsuredText;
    }
    insurerEmailConfigured = !!(insurer.email && insurer.email.trim());
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load admin insurer contact", err);
  }

  // Phase 13.11 — pull every vendor that's already linked to this project so
  // the Day-of room admin block can present a check-list. We probe the
  // (currently un-typed) `linkedProjectIds` field and union with whatever is
  // already in `dayOfRoomVendorIds`. NEVER ships notes / rating / etc.
  let dayOfRoomVendorOptions: SerialDayOfRoomVendorOption[] = [];
  try {
    const allVendorsSnap = await adminDb.collection("vendors").get();
    const allowSet = new Set(project.dayOfRoomVendorIds);
    dayOfRoomVendorOptions = allVendorsSnap.docs
      .map((d) => {
        const v = d.data() ?? {};
        const linkedProjectIds = Array.isArray(v.linkedProjectIds)
          ? (v.linkedProjectIds as unknown[]).filter(
              (x): x is string => typeof x === "string"
            )
          : [];
        return {
          id: d.id,
          name: typeof v.name === "string" ? v.name : "(unnamed)",
          category: typeof v.category === "string" ? v.category : "OTHER",
          linkedToProject: linkedProjectIds.includes(id),
          inAllowList: allowSet.has(d.id),
        };
      })
      .filter((v) => v.linkedToProject || v.inAllowList)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load day-of room vendors", err);
  }

  // Phase 2.2 — pull the style-quiz profile for this client's email (if any).
  // Surfaces above the workspace so Korrin sees the chosen aesthetic
  // alongside the questionnaire. Defensive: any failure (missing email,
  // permissions, etc.) renders nothing.
  let styleProfile: Awaited<ReturnType<typeof getStyleProfile>> = null;
  if (client.email) {
    try {
      styleProfile = await getStyleProfile(client.email);
    } catch (err) {
      console.error("[ProjectDetailPage] Failed to load style profile", err);
    }
  }

  // Wave 12 — saved reply templates owned by the current admin. Surfaced in
  // the MessagesTab as a "Templates ▾" quick-insert popover. Best-effort:
  // any failure leaves the dropdown empty without breaking the workspace.
  let replyTemplates: { id: string; label: string; body: string }[] = [];
  try {
    const rows = await getReplyTemplates(session.uid);
    replyTemplates = rows.map((t) => ({
      id: t.id,
      label: t.label,
      body: t.body,
    }));
  } catch (err) {
    console.error("[ProjectDetailPage] Failed to load reply templates", err);
  }

  return (
    <>
      {styleProfile && (
        <StyleProfileCard
          firstName={styleProfile.firstName}
          submittedAt={styleProfile.submittedAt}
          tagSummary={styleProfile.tagSummary}
          answers={styleProfile.answers}
        />
      )}
      <ProjectWorkspaceClient
        project={project}
        client={client}
        messages={messages}
        invoices={invoices}
        contract={contract}
        eventId={eventId}
        questionnaires={questionnaires}
        reviewRequests={reviewRequests}
        nextBestAction={getNextBestAction(project.status)}
        gearLog={gearLog}
        gearTemplateOptions={gearTemplateOptions}
        defaultGearTemplateId={defaultGearTemplateId}
        defaultGearTemplateName={defaultGearTemplateName}
        pressSubmissions={pressSubmissions}
        dayOfTimeline={dayOfTimeline}
        dayOfRoomVendorOptions={dayOfRoomVendorOptions}
        insurerDefaultAdditionalInsuredText={insurerDefaultAdditionalInsuredText}
        insurerEmailConfigured={insurerEmailConfigured}
        replyTemplates={replyTemplates}
      />
    </>
  );
}

// ─── Style profile card (server-rendered) ─────────────────────────────────────
//
// Renders above the project workspace when the client has completed the
// /style quiz. Uses a `<details>` element for the per-question disclosure
// so it works without JS — pure server-rendered fragment.

function StyleProfileCard({
  firstName,
  submittedAt,
  tagSummary,
  answers,
}: {
  firstName?: string;
  submittedAt: unknown;
  tagSummary: string[];
  answers: Record<string, string>;
}) {
  const submittedLabel = formatDisplayDate(submittedAt) ?? "—";
  // Build a Q+A list against the catalog so labels are readable.
  const qa = STYLE_QUESTIONS.flatMap((q) => {
    const chosenId = answers[q.id];
    if (!chosenId) return [];
    const option = q.options.find((o) => o.id === chosenId);
    if (!option) return [];
    return [{ prompt: q.prompt, optionLabel: option.label }];
  });

  return (
    <section
      style={{
        background: "var(--white)",
        border: "0.5px solid var(--border-strong)",
        padding: "1.5rem 1.75rem",
        marginBottom: "1.5rem",
        fontFamily: "'Jost', sans-serif",
      }}
    >
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          marginBottom: "0.5rem",
        }}
      >
        Style profile{firstName ? ` · ${firstName}` : ""} · submitted{" "}
        {submittedLabel}
      </p>
      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.5rem",
          fontWeight: 300,
          color: "var(--charcoal)",
          marginBottom: "1rem",
        }}
      >
        Their <em>aesthetic</em>
      </h2>

      {tagSummary.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          {tagSummary.map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--olive)",
                border: "0.5px solid var(--olive)",
                padding: "0.3rem 0.7rem",
                background: "var(--olive-dim)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--charcoal-muted)",
            marginBottom: "1rem",
          }}
        >
          No tags derived yet.
        </p>
      )}

      {qa.length > 0 && (
        <details>
          <summary
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--charcoal-light)",
              cursor: "pointer",
              padding: "0.4rem 0",
            }}
          >
            View answers ({qa.length})
          </summary>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0.75rem 0 0",
              display: "grid",
              gap: "0.6rem",
            }}
          >
            {qa.map((row, i) => (
              <li
                key={i}
                style={{
                  paddingBottom: "0.6rem",
                  borderBottom: "0.5px solid var(--border)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--charcoal-muted)",
                    marginBottom: "0.2rem",
                  }}
                >
                  {row.prompt}
                </p>
                <p
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.1rem",
                    fontWeight: 300,
                    color: "var(--charcoal)",
                  }}
                >
                  {row.optionLabel}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
