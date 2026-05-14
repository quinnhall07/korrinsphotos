"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import {
  updateProjectStatus,
  updateProjectDetails,
  archiveProject,
  regenerateWelcomePacket,
  regenerateShootBrief,
  getShootBriefDownloadUrl,
  setEditingSubStage,
  setRecurringCadenceAction,
  dismissReengagementPrompt,
  enableDayOfRoom,
  disableDayOfRoom,
  mintNewDayOfRoomToken,
  revokeDayOfRoomTokenAction,
  setDayOfRoomVendorIds,
} from "../actions";
import { EDITING_SUB_STAGES, type EditingSubStage } from "@/lib/editing-sla";
import { computeEditingStatus, editingStatusColor } from "@/lib/editing-status";
import { createDraftContract, sendContract } from "../contract-actions";
import {
  setCoiRequiredAction,
  updateCoiVenueAction,
  requestCoiAction,
  presignCoiUploadAction,
  confirmCoiUploadAction,
} from "../coi-actions";
import { sendInvoice, markInvoicePaidManually } from "../invoice-actions";
import { sendProjectMessage } from "../message-actions";
import {
  createPressSubmissionAction,
  updatePressSubmissionAction,
  deletePressSubmissionAction,
  type CreatePressSubmissionInput,
  type UpdatePressSubmissionInput,
} from "../press-actions";
import {
  createTimelineBlockAction,
  updateTimelineBlockAction,
  deleteTimelineBlockAction,
  reorderTimelineBlocksAction,
} from "../timeline-actions";
import { sendQuestionnaireForProjectAction } from "@/app/admin/questionnaires/templates/actions";
// AI components — supplied by Agent 5 (AI features) in the same merge.
// Imported eagerly so the parent's npm build wires the dependency edge.
// TODO(agent-5): confirm export paths once Agent 5 lands.
import { AIDraftReplyButton } from "@/components/admin/AIDraftReplyButton";
import { ThreadSummary } from "@/components/admin/ThreadSummary";
import { WeatherCard } from "./WeatherCard";
import type {
  SerialProject,
  SerialClient,
  SerialMessage,
  SerialInvoice,
  SerialContract,
  SerialQuestionnaire,
  SerialReviewRequest,
  SerialGearLogEntry,
  SerialGearTemplateOption,
  SerialPressSubmission,
  SerialTimelineBlock,
  SerialDayOfRoomVendorOption,
} from "./page";
import {
  initializeGearLog,
  toggleGearItemPacked,
  addAdHocGearItemAction,
  removeGearItemAction,
} from "../actions";
// Local literal copy of GearItemCategory so this client file doesn't import
// from `lib/db/gear-templates` (which is server-only via `adminDb`).
const GEAR_CATEGORIES = [
  "CAMERA",
  "LENS",
  "LIGHTING",
  "AUDIO",
  "STORAGE",
  "ACCESSORY",
  "BACKUP",
  "OTHER",
] as const;
type GearCategoryLiteral = (typeof GEAR_CATEGORIES)[number];

/**
 * Local mirror of `CommunicationChannel` from `lib/db/projects.ts` — that
 * module imports `adminDb` (server-only), so this client file can't import
 * the type directly. Keep this in sync with the canonical union.
 */
type CommunicationChannel = "EMAIL" | "PHONE" | "SMS" | "IN_PERSON";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  "SITE_VISIT",
  "INQUIRY",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "CONTRACT_SENT",
  "DEPOSIT_PENDING",
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
  "LOST",
  "ARCHIVED",
] as const;

type TabId =
  | "overview"
  | "messages"
  | "contract"
  | "invoice"
  | "gallery"
  | "day-of"
  | "timeline"
  | "files"
  | "gear"
  | "press"
  | "notes";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "messages", label: "Messages" },
  { id: "contract", label: "Contract" },
  { id: "invoice", label: "Invoice" },
  { id: "gallery", label: "Gallery" },
  { id: "day-of", label: "Day-of" },
  { id: "timeline", label: "Timeline" },
  { id: "files", label: "Files" },
  { id: "gear", label: "Gear" },
  { id: "press", label: "Press" },
  { id: "notes", label: "Notes" },
];

const TIMELINE_BLOCK_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "PREP", label: "Prep" },
  { value: "TRAVEL", label: "Travel" },
  { value: "SHOOT", label: "Shoot" },
  { value: "BREAK", label: "Break" },
  { value: "DETAIL", label: "Detail" },
  { value: "FAMILY", label: "Family" },
  { value: "CEREMONY", label: "Ceremony" },
  { value: "RECEPTION", label: "Reception" },
  { value: "OTHER", label: "Other" },
];

const TEMPLATES: { id: string; label: string; subject: string; body: string }[] = [
  {
    id: "inquiry-response",
    label: "Inquiry response",
    subject: "Thanks for reaching out",
    body:
      "Hi there,\n\nThank you so much for reaching out about your session. I'd love to learn more about what you're hoping to capture. Could you share a few more details about the date, location, and the vibe you're going for?\n\nLooking forward to it,\nKorrin",
  },
  {
    id: "booking-confirmation",
    label: "Booking confirmation",
    subject: "You're booked",
    body:
      "Hi there,\n\nI'm thrilled to confirm your session. Your deposit has been received and the date is officially on my calendar. I'll be in touch closer to the day with a logistics rundown.\n\nTalk soon,\nKorrin",
  },
  {
    id: "delivery-ready",
    label: "Delivery ready",
    subject: "Your gallery is ready",
    body:
      "Hi there,\n\nYour gallery is live and ready to view. I've poured a lot of care into these — I hope they bring back every feeling from the day.\n\nLet me know what you think,\nKorrin",
  },
];

// ─── Tokens / shared styles ───────────────────────────────────────────────────

const EYEBROW: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  fontWeight: 400,
};

const CARD: React.CSSProperties = {
  background: "var(--white)",
  border: "0.5px solid var(--border)",
  padding: "1.25rem",
};

const SECTION_HEAD: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.6rem",
  margin: "0 0 1.25rem 0",
  letterSpacing: "0.01em",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  border: "0.5px solid var(--olive)",
  background: "var(--olive)",
  color: "var(--white)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

const BTN_GHOST: React.CSSProperties = {
  padding: "0.55rem 1.1rem",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.75rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  cursor: "pointer",
  borderRadius: 0,
};

const PILL: React.CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.7rem",
  fontSize: "0.65rem",
  letterSpacing: "0.15em",
  textTransform: "uppercase",
  background: "var(--olive-dim)",
  color: "var(--olive)",
  border: "0.5px solid var(--olive)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtUSDCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  project: SerialProject;
  client: SerialClient;
  messages: SerialMessage[];
  invoices: SerialInvoice[];
  contract: SerialContract | null;
  eventId: string | null;
  questionnaires: SerialQuestionnaire[];
  reviewRequests: SerialReviewRequest[];
  nextBestAction: string;
  gearLog: SerialGearLogEntry[];
  gearTemplateOptions: SerialGearTemplateOption[];
  defaultGearTemplateId: string | null;
  defaultGearTemplateName: string | null;
  pressSubmissions: SerialPressSubmission[];
  dayOfTimeline: SerialTimelineBlock[];
  /**
   * Phase 13.11 — vendors that are either already linked to this project
   * (via `vendors.linkedProjectIds`) or already in the project's day-of room
   * allow-list. Drives the multi-select check-list inside the Day-of tab.
   */
  dayOfRoomVendorOptions: SerialDayOfRoomVendorOption[];
  /** Phase 3.9 — pre-filled from `users/{uid}.insurerContact`. */
  insurerDefaultAdditionalInsuredText: string | null;
  insurerEmailConfigured: boolean;
  /** Wave 12 — admin's saved reply templates. */
  replyTemplates: ReplyTemplateSnippet[];
}

/**
 * Wave 12 — saved reply template snippet threaded from the server page.
 * Body insertions go straight into the MessagesTab textarea via the
 * "Templates ▾" popover.
 */
export interface ReplyTemplateSnippet {
  id: string;
  label: string;
  body: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectWorkspaceClient({
  project,
  client,
  messages,
  invoices,
  contract,
  eventId,
  questionnaires,
  reviewRequests,
  nextBestAction,
  gearLog,
  gearTemplateOptions,
  defaultGearTemplateId,
  defaultGearTemplateName,
  pressSubmissions,
  dayOfTimeline,
  dayOfRoomVendorOptions,
  insurerDefaultAdditionalInsuredText,
  insurerEmailConfigured,
  replyTemplates,
}: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const initials = `${client.firstName?.[0] ?? ""}${client.lastName?.[0] ?? ""}`.toUpperCase();

  const handleAdvance = (newStatus: string) => {
    setStatusModalOpen(false);
    startTransition(async () => {
      const res = await updateProjectStatus(project.id, newStatus as any);
      if (res.success) {
        toast(`Status → ${statusLabel(newStatus)}`);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update status");
      }
    });
  };

  const handleArchive = () => {
    if (!confirm("Archive this project? It will move to the ARCHIVED off-ramp.")) return;
    startTransition(async () => {
      const res = await archiveProject(project.id);
      if (res.success) {
        toast("Project archived");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to archive");
      }
    });
  };

  return (
    <div className="page-fade-in" style={{ padding: "2rem 2.5rem", maxWidth: "1400px", margin: "0 auto" }}>
      {/* ─── Header ───────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.5rem",
          paddingBottom: "1.5rem",
          marginBottom: "2rem",
          borderBottom: "0.5px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
          {client.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={client.avatarUrl}
              alt={`${client.firstName} ${client.lastName}`}
              style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "var(--olive-dim)",
                color: "var(--olive)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.5rem",
                letterSpacing: "0.05em",
              }}
            >
              {initials || "?"}
            </div>
          )}
          <div>
            <p style={{ ...EYEBROW, margin: "0 0 0.35rem 0" }}>{client.firstTouchSource}</p>
            <h1
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontWeight: 300,
                fontSize: "2.1rem",
                margin: "0 0 0.4rem 0",
                letterSpacing: "0.01em",
              }}
            >
              {client.firstName} {client.lastName} <em style={{ color: "var(--charcoal-muted)" }}>·</em>{" "}
              <span style={{ color: "var(--charcoal-light)" }}>{project.title}</span>
            </h1>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
              <span style={PILL}>{statusLabel(project.status)}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>
                Lead Score: <strong style={{ color: "var(--charcoal)" }}>{project.leadScore}</strong>
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>
                Next: <strong style={{ color: "var(--olive)" }}>{nextBestAction}</strong>
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          <button style={BTN_GHOST} onClick={() => setStatusModalOpen(true)} disabled={isPending}>
            Advance Status
          </button>
          <button style={BTN_PRIMARY} onClick={() => setTab("messages")}>
            Send Email
          </button>
          <button style={BTN_GHOST} onClick={handleArchive} disabled={isPending}>
            Archive
          </button>
        </div>
      </header>

      {/* ─── Body grid ────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "2rem", alignItems: "start" }}>
        {/* Left rail */}
        <aside style={{ position: "sticky", top: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <ClientMiniCard client={client} />
          <ProjectMiniCard project={project} />
          <TabNav active={tab} onChange={setTab} />
        </aside>

        {/* Main */}
        <main style={{ ...CARD, minHeight: "600px" }}>
          {tab === "overview" && (
            <OverviewTab
              project={project}
              client={client}
              nextBestAction={nextBestAction}
              questionnaires={questionnaires}
              reviewRequests={reviewRequests}
            />
          )}
          {tab === "messages" && (
            <MessagesTab
              projectId={project.id}
              messages={messages}
              replyTemplates={replyTemplates}
            />
          )}
          {tab === "contract" && (
            <ContractTab
              projectId={project.id}
              contract={contract}
              project={project}
              insurerDefaultAdditionalInsuredText={insurerDefaultAdditionalInsuredText}
              insurerEmailConfigured={insurerEmailConfigured}
            />
          )}
          {tab === "invoice" && <InvoiceTab invoices={invoices} />}
          {tab === "gallery" && <GalleryTab eventId={eventId} />}
          {tab === "day-of" && (
            <>
              <VendorDayOfRoomCard
                projectId={project.id}
                enabled={project.dayOfRoomEnabled}
                token={project.dayOfRoomToken}
                tokenIssuedAt={project.dayOfRoomTokenIssuedAt}
                allowList={project.dayOfRoomVendorIds}
                vendorOptions={dayOfRoomVendorOptions}
              />
              <DayOfTab projectId={project.id} initialBlocks={dayOfTimeline} />
            </>
          )}
          {tab === "timeline" && (
            <TimelineTab
              project={project}
              messages={messages}
              invoices={invoices}
              contract={contract}
            />
          )}
          {tab === "files" && <FilesTab projectId={project.id} />}
          {tab === "gear" && (
            <GearTab
              projectId={project.id}
              gearLog={gearLog}
              templateOptions={gearTemplateOptions}
              defaultTemplateId={defaultGearTemplateId}
              defaultTemplateName={defaultGearTemplateName}
            />
          )}
          {tab === "press" && (
            <PressTab projectId={project.id} submissions={pressSubmissions} />
          )}
          {tab === "notes" && (
            <NotesTab
              projectId={project.id}
              initialNotes={project.notes}
              initialOffTheRecordNotes={project.offTheRecordNotes}
            />
          )}
        </main>
      </div>

      {/* ─── Status modal ─────────────────────────────────────────────────── */}
      {statusModalOpen && (
        <StatusModal
          currentStatus={project.status}
          onPick={handleAdvance}
          onClose={() => setStatusModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Left rail cards ──────────────────────────────────────────────────────────

function ClientMiniCard({ client }: { client: SerialClient }) {
  return (
    <div style={CARD}>
      <p style={{ ...EYEBROW, margin: "0 0 0.85rem 0" }}>Client</p>
      <Row label="Email" value={client.email || "—"} />
      <Row label="Phone" value={client.phone || "—"} />
      <Row label="Source" value={client.firstTouchSource} />
      <Row label="Sessions" value={String(client.totalSessionsBooked)} />
      <Row label="Credit" value={fmtUSDCents(client.referralCredit ?? 0)} />
    </div>
  );
}

function ProjectMiniCard({ project }: { project: SerialProject }) {
  const notesPreview = (project.notes ?? "").trim().slice(0, 120);
  return (
    <div style={CARD}>
      <p style={{ ...EYEBROW, margin: "0 0 0.85rem 0" }}>Project</p>
      <Row label="Type" value={project.sessionType || "—"} />
      <Row
        label="Package"
        value={
          project.packageName
            ? `${project.packageName}${project.packagePriceUsd != null ? ` · $${project.packagePriceUsd}` : ""}`
            : "—"
        }
      />
      <Row
        label="Value"
        value={project.estimatedValue != null ? `$${project.estimatedValue}` : "—"}
      />
      <Row label="Shoot" value={fmtDate(project.shootDate)} />
      {notesPreview && (
        <div style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "0.5px solid var(--border)" }}>
          <p style={{ ...EYEBROW, margin: "0 0 0.4rem 0", fontSize: "0.55rem" }}>Notes</p>
          <p style={{ fontSize: "0.8rem", color: "var(--charcoal-light)", margin: 0, lineHeight: 1.5 }}>
            {notesPreview}
            {project.notes.length > 120 ? "…" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", padding: "0.3rem 0", fontSize: "0.8rem" }}>
      <span style={{ color: "var(--charcoal-muted)" }}>{label}</span>
      <span style={{ color: "var(--charcoal)", textAlign: "right", maxWidth: "65%", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// ─── Vertical tab navigation ──────────────────────────────────────────────────

function TabNav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <nav style={{ ...CARD, padding: "0.5rem 0" }}>
      <p style={{ ...EYEBROW, margin: "0.75rem 1.25rem" }}>Sections</p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <li key={t.id}>
              <button
                onClick={() => onChange(t.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.65rem 1.25rem",
                  border: "none",
                  borderLeft: isActive ? "2px solid var(--olive)" : "2px solid transparent",
                  background: isActive ? "var(--olive-dim)" : "transparent",
                  color: isActive ? "var(--olive)" : "var(--charcoal)",
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                }}
              >
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  project,
  client,
  nextBestAction,
  questionnaires,
  reviewRequests,
}: {
  project: SerialProject;
  client: SerialClient;
  nextBestAction: string;
  questionnaires: SerialQuestionnaire[];
  reviewRequests: SerialReviewRequest[];
}) {
  // Phase 4.6 surface metrics for the badge row.
  const reviewSentCount = reviewRequests.filter(
    (r) => r.status === "SENT" || r.status === "CLICKED" || r.status === "SUBMITTED"
  ).length;
  const reviewTotal = reviewRequests.length;
  const latestReview = reviewRequests
    .slice()
    .sort((a, b) => {
      const ka =
        a.sentAt ?? a.scheduledFor ?? "";
      const kb =
        b.sentAt ?? b.scheduledFor ?? "";
      return kb.localeCompare(ka);
    })[0];

  return (
    <div>
      <h2 style={SECTION_HEAD}>Overview</h2>

      {/* NBA chip + Phase 4.6 NPS / review-request badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.55rem 0.9rem",
            background: "var(--olive-dim)",
            border: "0.5px solid var(--olive)",
          }}
        >
          <span style={{ ...EYEBROW, fontSize: "0.55rem" }}>Next Best Action</span>
          <strong style={{ color: "var(--olive)", fontSize: "0.85rem", fontWeight: 500 }}>{nextBestAction}</strong>
        </div>

        {project.clientNps !== null && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.9rem",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
            }}
            title={project.clientNpsAt ? `Rated ${fmtDate(project.clientNpsAt)}` : undefined}
          >
            <span style={{ ...EYEBROW, fontSize: "0.55rem" }}>NPS</span>
            <strong style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              {project.clientNps}★
            </strong>
          </div>
        )}

        {reviewTotal > 0 && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.55rem 0.9rem",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
            }}
            title={
              latestReview
                ? `Latest: ${latestReview.platform} · ${latestReview.status}`
                : undefined
            }
          >
            <span style={{ ...EYEBROW, fontSize: "0.55rem" }}>Reviews</span>
            <strong style={{ fontSize: "0.85rem", fontWeight: 500 }}>
              {reviewSentCount} of {reviewTotal} sent
            </strong>
            {latestReview && (
              <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                · {latestReview.platform} {latestReview.status.toLowerCase()}
              </span>
            )}
          </div>
        )}
      </div>

      <FollowUpDateBlock
        projectId={project.id}
        followUpDate={project.followUpDate}
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Package</p>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            {project.packageName ?? "—"}
            {project.packagePriceUsd != null && (
              <span style={{ color: "var(--charcoal-muted)" }}> · ${project.packagePriceUsd}</span>
            )}
          </p>
        </div>
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Estimated Value</p>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            {project.estimatedValue != null ? `$${project.estimatedValue}` : "—"}
          </p>
        </div>
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Shoot Date</p>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>
            {fmtDate(project.shootDate)}
            {project.shootEndDate ? ` → ${fmtDate(project.shootEndDate)}` : ""}
          </p>
        </div>
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Location</p>
          <p style={{ margin: 0, fontSize: "0.95rem" }}>{project.shootLocation?.label ?? "—"}</p>
        </div>
      </div>

      {/* Phase 3.6 — weather + golden-hour snapshot. Renders when the
          project has a shoot date (so admins can pre-flag indoor), when a
          forecast has been persisted, or when the project is flagged indoor. */}
      {(project.shootDate || project.weatherSnapshot || project.weatherSnapshotIndoor) && (
        <WeatherCard
          projectId={project.id}
          snapshot={project.weatherSnapshot}
          indoor={project.weatherSnapshotIndoor}
        />
      )}

      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Tags</p>
        {project.tags.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--charcoal-muted)" }}>None</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {project.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.7rem",
                  padding: "0.25rem 0.6rem",
                  border: "0.5px solid var(--border-strong)",
                  color: "var(--charcoal-light)",
                  letterSpacing: "0.05em",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Notes Preview</p>
        <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--charcoal-light)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {project.notes?.trim() ? project.notes.slice(0, 400) + (project.notes.length > 400 ? "…" : "") : "No notes yet."}
        </p>
      </div>

      <EditingWorkflowBlock project={project} />

      <QuestionnaireBlock projectId={project.id} questionnaires={questionnaires} />

      <WelcomePacketBlock projectId={project.id} />

      <ShootBriefBlock
        projectId={project.id}
        shootDate={project.shootDate}
        shootBriefGeneratedAt={project.shootBriefGeneratedAt}
      />

      <RecurringRevenueBlock projectId={project.id} client={client} />

      <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.8rem", color: "var(--charcoal-muted)", flexWrap: "wrap" }}>
        <span>Status changes: <strong style={{ color: "var(--charcoal)" }}>{project.statusHistory.length}</strong></span>
        <span>Last contacted: <strong style={{ color: "var(--charcoal)" }}>{fmtDate(project.lastContactedAt)}</strong></span>
        <span>Last responded: <strong style={{ color: "var(--charcoal)" }}>{fmtDate(project.lastRespondedAt)}</strong></span>
        <span>Created: <strong style={{ color: "var(--charcoal)" }}>{fmtDate(project.createdAt)}</strong></span>
      </div>
    </div>
  );
}

// ─── Questionnaire block (rendered inside Overview tab) ──────────────────────

function QuestionnaireBlock({
  projectId,
  questionnaires,
}: {
  projectId: string;
  questionnaires: SerialQuestionnaire[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Show the latest instance — by completedAt if any, else by sentAt.
  const latest = questionnaires.slice().sort((a, b) => {
    const ax = a.completedAt ?? a.sentAt ?? "";
    const bx = b.completedAt ?? b.sentAt ?? "";
    return bx.localeCompare(ax);
  })[0];

  const handleSend = () => {
    startTransition(async () => {
      const res = await sendQuestionnaireForProjectAction(projectId);
      if (res.success) {
        toast("Questionnaire sent");
        router.refresh();
      } else {
        toast(res.error);
      }
    });
  };

  let statusLine: React.ReactNode;
  if (!latest) {
    statusLine = (
      <span style={{ color: "var(--charcoal-muted)" }}>Not sent yet</span>
    );
  } else if (latest.status === "COMPLETED") {
    statusLine = (
      <span style={{ color: "var(--olive)" }}>
        Completed{latest.completedAt ? ` · ${fmtDate(latest.completedAt)}` : ""}
      </span>
    );
  } else {
    statusLine = (
      <span style={{ color: "var(--charcoal-light)" }}>
        Pending{latest.sentAt ? ` · sent ${fmtDate(latest.sentAt)}` : ""}
      </span>
    );
  }

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Questionnaire</p>
          <p style={{ margin: 0, fontSize: "0.88rem" }}>{statusLine}</p>
        </div>
        <button
          type="button"
          style={BTN_GHOST}
          onClick={handleSend}
          disabled={isPending || latest?.status === "COMPLETED"}
        >
          {isPending
            ? "Sending…"
            : latest
            ? latest.status === "COMPLETED"
              ? "Submitted"
              : "Resend"
            : "Send"}
        </button>
      </div>
    </div>
  );
}

// ─── Welcome packet block (rendered inside Overview tab) ─────────────────────

function WelcomePacketBlock({ projectId }: { projectId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleRegenerate = () => {
    startTransition(async () => {
      const res = await regenerateWelcomePacket(projectId);
      if (res.success && res.url) {
        toast("Welcome packet regenerated");
        // Best-effort clipboard copy so the admin can paste the fresh link
        // straight into a manual message if they want.
        try {
          await navigator.clipboard?.writeText(res.url);
        } catch {
          /* no-op */
        }
      } else {
        toast(res.error ?? "Failed to regenerate");
      }
    });
  };

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Welcome packet</p>
          <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
            Mints a fresh read link. Old links stop working.
          </p>
        </div>
        <button
          type="button"
          style={BTN_GHOST}
          onClick={handleRegenerate}
          disabled={isPending}
        >
          {isPending ? "Generating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}

// ─── Shoot brief block (rendered inside Overview tab) ────────────────────────

function ShootBriefBlock({
  projectId,
  shootDate,
  shootBriefGeneratedAt,
}: {
  projectId: string;
  shootDate: string | null;
  shootBriefGeneratedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await regenerateShootBrief(projectId);
      if (res.success) {
        toast("Shoot brief sent to your inbox");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to generate brief");
      }
    });
  };

  const handleView = () => {
    startTransition(async () => {
      const res = await getShootBriefDownloadUrl(projectId);
      if (res.success && res.url) {
        // Open in a new tab — the presigned URL is short-lived.
        if (typeof window !== "undefined") window.open(res.url, "_blank", "noopener");
      } else {
        toast(res.error ?? "No brief on file yet");
      }
    });
  };

  // Time-to-shoot bucket: drives which CTA the block surfaces.
  let hoursUntilShoot: number | null = null;
  if (shootDate) {
    const t = new Date(shootDate).getTime();
    if (Number.isFinite(t)) {
      hoursUntilShoot = (t - Date.now()) / (60 * 60 * 1000);
    }
  }
  const withinSevenDays =
    hoursUntilShoot !== null && hoursUntilShoot >= 0 && hoursUntilShoot <= 7 * 24;

  let bodyLine: React.ReactNode;
  let cta: React.ReactNode = null;

  if (shootBriefGeneratedAt) {
    bodyLine = (
      <span style={{ color: "var(--olive)" }}>
        Generated {fmtDate(shootBriefGeneratedAt)}
      </span>
    );
    cta = (
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" style={BTN_GHOST} onClick={handleView} disabled={isPending}>
          {isPending ? "Loading…" : "View brief"}
        </button>
        <button type="button" style={BTN_GHOST} onClick={handleGenerate} disabled={isPending}>
          {isPending ? "Generating…" : "Regenerate"}
        </button>
      </div>
    );
  } else if (withinSevenDays) {
    bodyLine = (
      <span style={{ color: "var(--charcoal-light)" }}>
        Not generated yet — shoot is within 7 days.
      </span>
    );
    cta = (
      <button type="button" style={BTN_GHOST} onClick={handleGenerate} disabled={isPending}>
        {isPending ? "Generating…" : "Generate now"}
      </button>
    );
  } else if (shootDate) {
    bodyLine = (
      <span style={{ color: "var(--charcoal-muted)" }}>
        Scheduled to auto-generate 24h before shoot.
      </span>
    );
  } else {
    bodyLine = (
      <span style={{ color: "var(--charcoal-muted)" }}>
        No shoot date set — brief will queue once a date is confirmed.
      </span>
    );
  }

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Shoot brief</p>
          <p style={{ margin: 0, fontSize: "0.88rem" }}>{bodyLine}</p>
        </div>
        {cta}
      </div>
    </div>
  );
}

// ─── Recurring revenue block (Phase 13.6 — rendered inside Overview tab) ───

function RecurringRevenueBlock({
  projectId,
  client,
}: {
  projectId: string;
  client: SerialClient;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const cadence = client.recurringCadence;
  const nextPromptLabel = client.recurringNextPromptAt
    ? fmtDate(client.recurringNextPromptAt)
    : "—";
  const cadenceLabel =
    cadence === "ANNUAL"
      ? "Annual"
      : cadence === "SEMI_ANNUAL"
      ? "Every 6 months"
      : "Off";

  const handleCadenceChange = (next: "ANNUAL" | "SEMI_ANNUAL" | "NONE") => {
    startTransition(async () => {
      const res = await setRecurringCadenceAction(projectId, next);
      if (res.success) {
        toast("Cadence updated");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update cadence");
      }
    });
  };

  const handleSnooze = () => {
    startTransition(async () => {
      const res = await dismissReengagementPrompt(client.id);
      if (res.success) {
        toast("Snoozed 30 days");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to snooze");
      }
    });
  };

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "var(--charcoal)",
          fontFamily: "'Jost', sans-serif",
        }}
        aria-expanded={open}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Recurring revenue</p>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--charcoal-light)" }}>
            {cadenceLabel}
            {cadence !== "NONE" && (
              <span style={{ color: "var(--charcoal-muted)" }}>
                {" "}· next prompt {nextPromptLabel}
              </span>
            )}
            {client.recurringPromptsSent > 0 && (
              <span style={{ color: "var(--charcoal-muted)" }}>
                {" "}· {client.recurringPromptsSent} sent
              </span>
            )}
          </p>
        </div>
        <span style={{ fontSize: "0.85rem", color: "var(--charcoal-muted)" }}>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: "0.95rem" }}>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              margin: "0 0 0.65rem 0",
              lineHeight: 1.5,
            }}
          >
            Choose how often Korrin&apos;s inbox should surface a re-engagement
            prompt for this client. Set after gallery delivery for repeat-friendly
            session types (Family, Portrait, Engagement, Wedding).
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              flexWrap: "wrap",
              marginBottom: "0.85rem",
            }}
          >
            {(["ANNUAL", "SEMI_ANNUAL", "NONE"] as const).map((opt) => {
              const isActive = opt === cadence;
              const label =
                opt === "ANNUAL"
                  ? "Annual"
                  : opt === "SEMI_ANNUAL"
                  ? "Every 6 months"
                  : "Off";
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={pending || isActive}
                  onClick={() => handleCadenceChange(opt)}
                  style={{
                    padding: "0.4rem 0.85rem",
                    border: isActive
                      ? "0.5px solid var(--olive)"
                      : "0.5px solid var(--border-strong)",
                    background: isActive ? "var(--olive-dim)" : "var(--white)",
                    color: isActive ? "var(--olive)" : "var(--charcoal)",
                    fontFamily: "'Jost', sans-serif",
                    fontSize: "0.78rem",
                    letterSpacing: "0.06em",
                    cursor: isActive || pending ? "default" : "pointer",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {cadence !== "NONE" && (
            <button
              type="button"
              disabled={pending}
              onClick={handleSnooze}
              style={{
                ...BTN_GHOST,
                opacity: pending ? 0.6 : 1,
              }}
            >
              Snooze 30 days
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Follow-up date block (Wave 12 — rendered inside Overview tab) ──────────
//
// Tiny editor for `ProjectDoc.followUpDate`. Three states:
//   • empty  — single "Set follow-up date" button.
//   • set    — "in N days · Wed Jun 5" + Edit / Clear.
//   • editor — bare `<input type="date">` + Save / Cancel.
//
// Persists via `updateProjectDetails(projectId, { followUpDate })`. The
// allow-list lives in `app/admin/projects/actions.ts`.

function isoToDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Use UTC pieces so a noon-UTC stored timestamp renders the same calendar
  // day in the input regardless of viewer timezone (matches the action's
  // normalisation rule).
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function relativeFollowUpLabel(iso: string | null): string {
  if (!iso) return "—";
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return "—";
  // Day-bucket diff against today, computed at UTC midnight on each side
  // so DST and viewer timezone don't shift the count.
  const tDay = Date.UTC(
    target.getUTCFullYear(),
    target.getUTCMonth(),
    target.getUTCDate()
  );
  const now = new Date();
  const nDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((tDay - nDay) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

function FollowUpDateBlock({
  projectId,
  followUpDate,
}: {
  projectId: string;
  followUpDate: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  // Optimistic local copy so the chip updates immediately on save.
  const [optimistic, setOptimistic] = useState<string | null>(followUpDate);
  const [draft, setDraft] = useState<string>(isoToDateInputValue(followUpDate));

  // Re-sync optimistic + draft whenever the upstream prop changes
  // (router.refresh() after a mutation rehydrates the Server Component).
  useEffect(() => {
    setOptimistic(followUpDate);
    setDraft(isoToDateInputValue(followUpDate));
  }, [followUpDate]);

  const persist = (next: string | null) => {
    startTransition(async () => {
      const res = await updateProjectDetails(projectId, { followUpDate: next });
      if (res.success) {
        setOptimistic(
          next
            ? new Date(`${next}T12:00:00Z`).toISOString()
            : null
        );
        setEditing(false);
        toast(next ? "Follow-up date saved" : "Follow-up date cleared");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update follow-up date");
      }
    });
  };

  const handleSave = () => {
    if (!draft) {
      toast("Pick a date first");
      return;
    }
    persist(draft);
  };

  const handleClear = () => {
    persist(null);
  };

  const handleCancel = () => {
    setDraft(isoToDateInputValue(optimistic));
    setEditing(false);
  };

  const hasDate = !!optimistic;

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Follow-up date</p>
          {editing ? (
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                style={{
                  padding: "0.4rem 0.55rem",
                  border: "0.5px solid var(--border-strong)",
                  background: "var(--white)",
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.85rem",
                  borderRadius: 0,
                  color: "var(--charcoal)",
                }}
                disabled={pending}
              />
            </div>
          ) : hasDate ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.88rem",
                color: "var(--charcoal-light)",
              }}
            >
              <strong style={{ color: "var(--olive)" }}>
                {relativeFollowUpLabel(optimistic)}
              </strong>
              <span style={{ color: "var(--charcoal-muted)" }}>
                {" "}· {fmtDate(optimistic)}
              </span>
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: "0.85rem",
                color: "var(--charcoal-muted)",
              }}
            >
              No follow-up scheduled.
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {editing ? (
            <>
              <button
                type="button"
                style={BTN_PRIMARY}
                onClick={handleSave}
                disabled={pending || !draft}
              >
                {pending ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                style={BTN_GHOST}
                onClick={handleCancel}
                disabled={pending}
              >
                Cancel
              </button>
            </>
          ) : hasDate ? (
            <>
              <button
                type="button"
                style={BTN_GHOST}
                onClick={() => setEditing(true)}
                disabled={pending}
              >
                Edit
              </button>
              <button
                type="button"
                style={BTN_GHOST}
                onClick={handleClear}
                disabled={pending}
              >
                {pending ? "Clearing…" : "Clear"}
              </button>
            </>
          ) : (
            <button
              type="button"
              style={BTN_GHOST}
              onClick={() => setEditing(true)}
              disabled={pending}
            >
              Set follow-up date
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Messages tab ─────────────────────────────────────────────────────────────

/** Channels offered by the MessagesTab composer. EMAIL is the default. */
const MESSAGE_CHANNEL_OPTIONS: { value: CommunicationChannel; label: string }[] = [
  { value: "EMAIL", label: "Email" },
  { value: "PHONE", label: "Phone call" },
  { value: "IN_PERSON", label: "In-person" },
  { value: "SMS", label: "SMS" },
];

function MessagesTab({
  projectId,
  messages,
  replyTemplates,
}: {
  projectId: string;
  messages: SerialMessage[];
  replyTemplates: ReplyTemplateSnippet[];
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pickedTemplate, setPickedTemplate] = useState<string>("");
  const [channel, setChannel] = useState<CommunicationChannel>("EMAIL");
  const [sending, setSending] = useState(false);
  const [savedTemplatesOpen, setSavedTemplatesOpen] = useState(false);
  const router = useRouter();
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const savedTemplatesPopoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  // Close the saved-templates popover on outside click / Escape.
  useEffect(() => {
    if (!savedTemplatesOpen) return;
    const handlePointer = (e: MouseEvent) => {
      const node = savedTemplatesPopoverRef.current;
      if (node && !node.contains(e.target as Node)) {
        setSavedTemplatesOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSavedTemplatesOpen(false);
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [savedTemplatesOpen]);

  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    setPickedTemplate(id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  /**
   * Insert a saved-reply template body into the textarea. Replaces the
   * current selection if any, otherwise appends to existing content with a
   * leading blank line so previously-typed copy is not destroyed.
   */
  const insertSavedTemplate = (snippet: ReplyTemplateSnippet) => {
    const ta = textareaRef.current;
    if (ta) {
      const start = ta.selectionStart ?? body.length;
      const end = ta.selectionEnd ?? body.length;
      if (start !== end) {
        // Replace the selection in-place.
        const next = body.slice(0, start) + snippet.body + body.slice(end);
        setBody(next);
        // Restore caret to the end of the inserted text on next tick.
        setTimeout(() => {
          if (textareaRef.current) {
            const caret = start + snippet.body.length;
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(caret, caret);
          }
        }, 0);
      } else if (body.length === 0) {
        setBody(snippet.body);
      } else {
        setBody(`${body}\n${snippet.body}`);
      }
    } else if (body.length === 0) {
      setBody(snippet.body);
    } else {
      setBody(`${body}\n${snippet.body}`);
    }
    setSavedTemplatesOpen(false);
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast(channel === "EMAIL" ? "Write a message first" : "Add a note first");
      return;
    }
    setSending(true);
    const res = await sendProjectMessage(
      projectId,
      body,
      subject || undefined,
      channel
    );
    setSending(false);
    if (res.success) {
      toast(
        channel === "EMAIL"
          ? "Message sent"
          : `${channel.replace(/_/g, " ").toLowerCase()} logged`
      );
      setBody("");
      setSubject("");
      setPickedTemplate("");
      // Channel intentionally NOT reset — Korrin often logs several touches
      // on the same channel in a row.
      router.refresh();
    } else {
      toast(res.error ?? "Failed to send");
    }
  };

  return (
    <div>
      <h2 style={SECTION_HEAD}>Messages</h2>

      <div style={{ marginBottom: "1rem" }}>
        <ThreadSummary projectId={projectId} messageCount={messages.length} />
      </div>

      <div
        style={{
          border: "0.5px solid var(--border)",
          maxHeight: "420px",
          overflowY: "auto",
          padding: "1rem",
          marginBottom: "1.25rem",
          background: "var(--white)",
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: "var(--charcoal-muted)", fontSize: "0.85rem", margin: 0 }}>
            No messages yet. The first inbound message from the booking form appears here.
          </p>
        ) : (
          messages.map((m) => (
            <article
              key={m.id}
              style={{
                marginBottom: "1rem",
                paddingBottom: "1rem",
                borderBottom: "0.5px solid var(--border)",
              }}
            >
              <header
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: "0.35rem",
                  gap: "0.75rem",
                }}
              >
                <span
                  style={{
                    ...EYEBROW,
                    color: m.direction === "OUTBOUND" ? "var(--olive)" : "var(--charcoal-light)",
                  }}
                >
                  {m.direction === "OUTBOUND" ? "→ Sent" : "← Received"} · {m.channel}
                  {m.isAutomatic ? " · auto" : ""}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                  {fmtDateTime(m.sentAt)}
                </span>
              </header>
              {m.subject && (
                <p style={{ margin: "0 0 0.35rem 0", fontSize: "0.85rem", fontWeight: 500 }}>{m.subject}</p>
              )}
              <p style={{ margin: 0, fontSize: "0.85rem", whiteSpace: "pre-wrap", lineHeight: 1.55, color: "var(--charcoal)" }}>
                {m.body}
              </p>
              {/* Phase 1.6 — engagement chips. Only render on outbound messages
                  that flowed through enqueueTrackedMail (sendId present). */}
              {m.direction === "OUTBOUND" && m.sendId && (m.openCount > 0 || m.clickCount > 0) && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    display: "flex",
                    gap: "0.4rem",
                    flexWrap: "wrap",
                  }}
                >
                  {m.openCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "0.15rem 0.45rem",
                        background: "var(--olive-dim)",
                        color: "var(--olive)",
                        border: "0.5px solid var(--olive)",
                      }}
                    >
                      Opened {m.openCount}×
                    </span>
                  )}
                  {m.clickCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        padding: "0.15rem 0.45rem",
                        background: "var(--olive)",
                        color: "var(--white)",
                      }}
                    >
                      Clicked {m.clickCount}×
                    </span>
                  )}
                </div>
              )}
            </article>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div style={{ border: "0.5px solid var(--border-strong)", padding: "1rem", background: "var(--white)" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.6rem 0" }}>
          {channel === "EMAIL" ? "Reply" : "Log communication"}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" }}>
          <select
            value={pickedTemplate}
            onChange={(e) => applyTemplate(e.target.value)}
            style={{
              padding: "0.4rem 0.6rem",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.8rem",
              background: "var(--white)",
              borderRadius: 0,
            }}
          >
            <option value="">Template…</option>
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={
              channel === "EMAIL" ? "Subject (optional)" : "Topic (optional)"
            }
            style={{
              flex: 1,
              padding: "0.4rem 0.6rem",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.8rem",
              borderRadius: 0,
            }}
          />
        </div>

        {/* Wave 12 — saved-template quick-insert popover. Sits above the
            textarea so a click → insert flow stays one quick path. */}
        <div
          ref={savedTemplatesPopoverRef}
          style={{
            position: "relative",
            marginBottom: "0.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <button
            type="button"
            onClick={() => setSavedTemplatesOpen((v) => !v)}
            style={{
              ...BTN_GHOST,
              padding: "0.35rem 0.7rem",
              fontSize: "0.7rem",
            }}
            aria-haspopup="listbox"
            aria-expanded={savedTemplatesOpen}
          >
            Templates {savedTemplatesOpen ? "▴" : "▾"}
            {replyTemplates.length > 0 && (
              <span
                style={{
                  marginLeft: "0.4rem",
                  color: "var(--charcoal-muted)",
                  fontSize: "0.7rem",
                }}
              >
                · {replyTemplates.length}
              </span>
            )}
          </button>

          {savedTemplatesOpen && (
            <div
              role="listbox"
              style={{
                position: "absolute",
                top: "calc(100% + 0.35rem)",
                left: 0,
                zIndex: 50,
                minWidth: "260px",
                maxWidth: "360px",
                maxHeight: "260px",
                overflowY: "auto",
                background: "var(--white)",
                border: "0.5px solid var(--border-strong)",
                boxShadow: "0 4px 16px rgba(42,42,40,0.08)",
              }}
            >
              {replyTemplates.length === 0 ? (
                <div
                  style={{
                    padding: "0.7rem 0.85rem",
                    fontSize: "0.78rem",
                    color: "var(--charcoal-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  No saved templates yet. Add one in{" "}
                  <Link
                    href="/admin/settings/reply-templates"
                    style={{ color: "var(--olive)" }}
                  >
                    Settings → Reply templates
                  </Link>
                  .
                </div>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {replyTemplates.map((tpl) => (
                    <li key={tpl.id}>
                      <button
                        type="button"
                        onClick={() => insertSavedTemplate(tpl)}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "0.55rem 0.85rem",
                          background: "transparent",
                          border: "none",
                          borderBottom: "0.5px solid var(--border)",
                          cursor: "pointer",
                          fontFamily: "'Jost', sans-serif",
                          color: "var(--charcoal)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.82rem",
                            fontWeight: 500,
                            marginBottom: "0.15rem",
                          }}
                        >
                          {tpl.label}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--charcoal-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {tpl.body.length > 60
                            ? `${tpl.body.slice(0, 60).trimEnd()}…`
                            : tpl.body}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            channel === "EMAIL"
              ? "Write a reply…"
              : "Note what you discussed (e.g. confirmed venue, walked through timeline)"
          }
          rows={6}
          style={{
            width: "100%",
            padding: "0.6rem",
            border: "0.5px solid var(--border-strong)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.85rem",
            resize: "vertical",
            borderRadius: 0,
            background: "var(--white)",
            color: "var(--charcoal)",
            lineHeight: 1.5,
          }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.6rem", gap: "0.5rem", flexWrap: "wrap" }}>
          <AIDraftReplyButton
            projectId={projectId}
            onDraftReady={(draft) => setBody(draft)}
            disabled={sending}
          />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value as CommunicationChannel)
              }
              disabled={sending}
              aria-label="Communication channel"
              style={{
                padding: "0.4rem 0.6rem",
                border: "0.5px solid var(--border-strong)",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.78rem",
                background: "var(--white)",
                borderRadius: 0,
                color: "var(--charcoal)",
              }}
            >
              {MESSAGE_CHANNEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button onClick={handleSend} style={BTN_PRIMARY} disabled={sending || !body.trim()}>
              {sending
                ? channel === "EMAIL"
                  ? "Sending…"
                  : "Logging…"
                : channel === "EMAIL"
                  ? "Send"
                  : "Log"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Contract tab ─────────────────────────────────────────────────────────────

function ContractTab({
  projectId,
  contract,
  project,
  insurerDefaultAdditionalInsuredText,
  insurerEmailConfigured,
}: {
  projectId: string;
  contract: SerialContract | null;
  project: SerialProject;
  insurerDefaultAdditionalInsuredText: string | null;
  insurerEmailConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    const res = await createDraftContract(projectId);
    setBusy(false);
    if ((res as any).success) {
      toast("Draft contract created");
      router.refresh();
    } else {
      toast((res as any).error ?? "Failed to create contract");
    }
  };

  const handleSend = async () => {
    if (!contract) return;
    setBusy(true);
    try {
      await sendContract(contract.id);
      toast("Contract sent");
      router.refresh();
    } catch (e: any) {
      toast(e?.message ?? "Failed to send contract");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 style={SECTION_HEAD}>Contract</h2>

      <CoiBlock
        projectId={projectId}
        project={project}
        insurerDefaultAdditionalInsuredText={insurerDefaultAdditionalInsuredText}
        insurerEmailConfigured={insurerEmailConfigured}
      />

      {!contract ? (
        <div>
          <p style={{ color: "var(--charcoal-muted)", fontSize: "0.9rem" }}>
            No contract yet. Generate a draft to send to the client.
          </p>
          <button style={BTN_PRIMARY} onClick={handleCreate} disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={PILL}>{contract.status}</span>
              <span style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)" }}>Created {fmtDateTime(contract.createdAt)}</span>
            </div>
            {contract.status === "DRAFT" && (
              <button style={BTN_PRIMARY} onClick={handleSend} disabled={busy}>
                {busy ? "Sending…" : "Send to client"}
              </button>
            )}
          </div>

          {contract.status !== "DRAFT" && (
            <div style={{ marginBottom: "1rem", padding: "1rem", background: "var(--olive-dim)", border: "0.5px solid var(--olive)" }}>
              <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Signature Audit</p>
              <Row label="Sent" value={fmtDateTime(contract.sentAt)} />
              <Row label="Signed" value={fmtDateTime(contract.signedAt)} />
              <Row label="Signer IP" value={contract.signerIp || "—"} />
              <Row label="User Agent" value={contract.signerUserAgent || "—"} />
            </div>
          )}

          <iframe
            srcDoc={contract.renderedHtml}
            title="Contract preview"
            style={{
              width: "100%",
              minHeight: "520px",
              border: "0.5px solid var(--border)",
              background: "var(--white)",
            }}
          />
        </div>
      )}
    </div>
  );
}

// ─── COI block (rendered inside the Contract tab) ───────────────────────────
//
// Phase 3.9 — Venue-required shoots need a Certificate of Insurance from the
// photographer's insurer naming the venue as an additional insured. This
// block lets the admin (a) toggle COI required, (b) capture venue + clause,
// (c) email the insurer, and (d) upload the returned PDF.

function coiStatusPill(
  status: "NONE" | "REQUESTED" | "RECEIVED" | "EXPIRED"
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "0.25rem 0.7rem",
    fontSize: "0.65rem",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    border: "0.5px solid",
  };
  if (status === "RECEIVED") {
    return {
      ...base,
      background: "var(--olive)",
      color: "var(--white)",
      borderColor: "var(--olive)",
    };
  }
  if (status === "REQUESTED") {
    return {
      ...base,
      background: "var(--olive-dim)",
      color: "var(--olive)",
      borderColor: "var(--olive)",
    };
  }
  if (status === "EXPIRED") {
    return {
      ...base,
      background: "rgba(176,50,50,0.08)",
      color: "#b03232",
      borderColor: "rgba(176,50,50,0.5)",
    };
  }
  return {
    ...base,
    background: "transparent",
    color: "var(--charcoal-muted)",
    borderColor: "var(--border-strong)",
  };
}

function CoiBlock({
  projectId,
  project,
  insurerDefaultAdditionalInsuredText,
  insurerEmailConfigured,
}: {
  projectId: string;
  project: SerialProject;
  insurerDefaultAdditionalInsuredText: string | null;
  insurerEmailConfigured: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [venueName, setVenueName] = useState(project.coiVenueName ?? "");
  const [venueAddress, setVenueAddress] = useState(project.coiVenueAddress ?? "");
  const [additionalInsuredText, setAdditionalInsuredText] = useState(
    project.coiAdditionalInsuredText ?? insurerDefaultAdditionalInsuredText ?? ""
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const toggleRequired = (next: boolean) => {
    startTransition(async () => {
      const res = await setCoiRequiredAction(projectId, next);
      if (res.success) {
        toast(next ? "COI required" : "COI not required");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update COI flag");
      }
    });
  };

  const saveVenue = async (silent = false) => {
    const res = await updateCoiVenueAction(projectId, {
      coiVenueName: venueName,
      coiVenueAddress: venueAddress,
      coiAdditionalInsuredText: additionalInsuredText,
    });
    if (!res.success) {
      toast(res.error ?? "Failed to save venue");
      return false;
    }
    if (!silent) toast("Venue details saved");
    return true;
  };

  const handleRequest = () => {
    if (!insurerEmailConfigured) {
      toast("Configure insurer email in /admin/settings/insurer first");
      return;
    }
    if (!venueName.trim() || !venueAddress.trim()) {
      toast("Venue name and address are required");
      return;
    }
    startTransition(async () => {
      // Persist edited venue fields first so the request email uses the
      // latest values without a separate save click.
      const saved = await saveVenue(true);
      if (!saved) return;
      const res = await requestCoiAction(projectId);
      if (res.success) {
        toast("COI requested");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to request COI");
      }
    });
  };

  const handlePdfPicked = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast("Only PDF files are allowed");
      return;
    }
    setUploadBusy(true);
    try {
      const presign = await presignCoiUploadAction(
        projectId,
        file.name,
        "application/pdf"
      );
      if (!presign.success) {
        toast(presign.error ?? "Failed to mint upload URL");
        return;
      }
      const putRes = await fetch(presign.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": "application/pdf" },
      });
      if (!putRes.ok) {
        toast(`Upload failed (${putRes.status})`);
        return;
      }
      const confirm = await confirmCoiUploadAction(projectId, presign.key);
      if (!confirm.success) {
        toast(confirm.error ?? "Failed to record upload");
        return;
      }
      toast("COI uploaded");
      router.refresh();
    } catch (err) {
      console.error("[CoiBlock] upload failed", err);
      toast("Upload failed");
    } finally {
      setUploadBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (uploadBusy) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) void handlePdfPicked(file);
  };

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: project.coiRequired ? "1rem" : 0,
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>
            Certificate of Insurance
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              flexWrap: "wrap",
            }}
          >
            <span style={coiStatusPill(project.coiStatus)}>
              {project.coiStatus.toLowerCase()}
            </span>
            {project.coiStatus === "REQUESTED" && project.coiRequestedAt && (
              <span style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
                Requested {fmtDate(project.coiRequestedAt)}
                {project.coiInsurerEmail ? ` · ${project.coiInsurerEmail}` : ""}
              </span>
            )}
            {project.coiStatus === "RECEIVED" && project.coiReceivedAt && (
              <span style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
                Received {fmtDate(project.coiReceivedAt)}
              </span>
            )}
          </div>
        </div>

        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.82rem",
            color: "var(--charcoal)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={project.coiRequired}
            disabled={isPending}
            onChange={(e) => toggleRequired(e.target.checked)}
          />
          COI required
        </label>
      </div>

      {project.coiRequired && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {!insurerEmailConfigured && (
            <p
              style={{
                fontSize: "0.78rem",
                color: "#b03232",
                margin: 0,
                padding: "0.5rem 0.7rem",
                background: "rgba(176,50,50,0.06)",
                border: "0.5px solid rgba(176,50,50,0.4)",
              }}
            >
              No insurer email configured.{" "}
              <Link href="/admin/settings/insurer" style={{ color: "#b03232", textDecoration: "underline" }}>
                Set one in Settings → Insurer
              </Link>{" "}
              before requesting a COI.
            </p>
          )}

          <div>
            <label
              style={{
                ...EYEBROW,
                display: "block",
                marginBottom: "0.3rem",
                fontSize: "0.6rem",
              }}
            >
              Venue name
            </label>
            <input
              type="text"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g. The Olde Mill"
              style={{
                width: "100%",
                padding: "0.55rem 0.65rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
                fontSize: "0.88rem",
                fontFamily: "'Jost', sans-serif",
                borderRadius: 0,
              }}
            />
          </div>

          <div>
            <label
              style={{
                ...EYEBROW,
                display: "block",
                marginBottom: "0.3rem",
                fontSize: "0.6rem",
              }}
            >
              Venue address
            </label>
            <textarea
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Street, City, State ZIP"
              rows={2}
              style={{
                width: "100%",
                padding: "0.55rem 0.65rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
                fontSize: "0.88rem",
                fontFamily: "'Jost', sans-serif",
                borderRadius: 0,
                resize: "vertical",
              }}
            />
          </div>

          <div>
            <label
              style={{
                ...EYEBROW,
                display: "block",
                marginBottom: "0.3rem",
                fontSize: "0.6rem",
              }}
            >
              Additional-insured language
            </label>
            <textarea
              value={additionalInsuredText}
              onChange={(e) => setAdditionalInsuredText(e.target.value)}
              placeholder="Defaults to your Settings → Insurer value."
              rows={3}
              style={{
                width: "100%",
                padding: "0.55rem 0.65rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
                fontSize: "0.85rem",
                fontFamily: "'Jost', sans-serif",
                borderRadius: 0,
                resize: "vertical",
                lineHeight: 1.5,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              style={BTN_GHOST}
              disabled={isPending}
              onClick={() => startTransition(() => void saveVenue())}
            >
              Save venue
            </button>
            <button
              type="button"
              style={BTN_PRIMARY}
              disabled={isPending || !insurerEmailConfigured}
              onClick={handleRequest}
            >
              {isPending
                ? "Working…"
                : project.coiStatus === "REQUESTED"
                ? "Re-request COI"
                : "Request COI"}
            </button>
          </div>

          {/* Upload-cert drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            style={{
              padding: "1rem",
              border: "0.5px dashed var(--border-strong)",
              background: "rgba(42,42,40,0.02)",
              textAlign: "center",
              fontSize: "0.82rem",
              color: "var(--charcoal-light)",
            }}
          >
            <p style={{ margin: "0 0 0.55rem 0" }}>
              {project.coiR2Key
                ? "Replace cert PDF (drop or pick)"
                : "Drop the cert PDF here, or pick a file"}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handlePdfPicked(file);
              }}
              style={{ display: "none" }}
            />
            <button
              type="button"
              style={BTN_GHOST}
              disabled={uploadBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadBusy ? "Uploading…" : "Choose PDF"}
            </button>
            {project.coiR2Key && (
              <p
                style={{
                  margin: "0.6rem 0 0 0",
                  fontSize: "0.72rem",
                  color: "var(--charcoal-muted)",
                  wordBreak: "break-all",
                }}
              >
                Current: {project.coiR2Key}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Invoice tab ──────────────────────────────────────────────────────────────

// Phase 3.12: render refund / dispute state as small badges under the invoice
// amount. Red accent for disputes, gray for refunds. Compact on purpose — the
// finance dashboard (Phase 3.1) will surface the full ledger.
function LedgerBadges({ inv }: { inv: SerialInvoice }) {
  const badges: { label: string; tone: "refund" | "dispute" }[] = [];

  if (inv.disputeStatus && inv.disputeStatus !== "NONE") {
    const closed = !!inv.disputeClosedAt;
    const tone: "refund" | "dispute" = inv.disputeStatus === "WON" ? "refund" : "dispute";
    const prefix = closed ? "Dispute" : "Dispute open";
    const amount =
      typeof inv.disputeAmountCents === "number"
        ? ` ${fmtUSDCents(inv.disputeAmountCents)}`
        : "";
    badges.push({
      label: `${prefix}: ${inv.disputeStatus.replace(/_/g, " ").toLowerCase()}${amount}`,
      tone,
    });
  }

  if (typeof inv.refundCents === "number" && inv.refundCents > 0) {
    const reason = inv.refundReason ? ` (${inv.refundReason})` : "";
    badges.push({
      label: `Refunded ${fmtUSDCents(inv.refundCents)}${reason}`,
      tone: "refund",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.4rem" }}>
      {badges.map((b, idx) => {
        const isDispute = b.tone === "dispute";
        const style: React.CSSProperties = {
          display: "inline-block",
          padding: "0.15rem 0.45rem",
          fontSize: "0.6rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          border: `0.5px solid ${isDispute ? "rgba(176, 50, 50, 0.6)" : "rgba(42,42,40,0.3)"}`,
          color: isDispute ? "#b03232" : "var(--charcoal-light)",
          background: isDispute ? "rgba(176, 50, 50, 0.06)" : "rgba(42,42,40,0.04)",
          fontWeight: 500,
          width: "fit-content",
        };
        return (
          <span key={idx} style={style}>
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

function InvoiceTab({ invoices }: { invoices: SerialInvoice[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleSend = async (id: string) => {
    setBusyId(id);
    try {
      await sendInvoice(id);
      toast("Invoice sent");
      router.refresh();
    } catch (e: any) {
      toast(e?.message ?? "Failed to send invoice");
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (id: string) => {
    if (!confirm("Mark this invoice paid manually? Use this for cash or bank transfer only.")) return;
    setBusyId(id);
    const res = await markInvoicePaidManually(id);
    setBusyId(null);
    if (res.success) {
      toast("Invoice marked paid");
      router.refresh();
    } else {
      toast(res.error ?? "Failed to update invoice");
    }
  };

  return (
    <div>
      <h2 style={SECTION_HEAD}>Invoices</h2>
      {invoices.length === 0 ? (
        <p style={{ color: "var(--charcoal-muted)", fontSize: "0.9rem" }}>
          No invoices yet. They are created automatically when the project advances to PROPOSAL_SENT (deposit) and BOOKED (balance).
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {invoices.map((inv) => (
            <div
              key={inv.id}
              style={{
                padding: "1rem",
                border: "0.5px solid var(--border-strong)",
                background: "var(--white)",
                display: "grid",
                gridTemplateColumns: "100px 1fr auto",
                gap: "1rem",
                alignItems: "center",
              }}
            >
              <div>
                <p style={{ ...EYEBROW, margin: 0, fontSize: "0.6rem" }}>{inv.type}</p>
                <p style={{ margin: "0.2rem 0 0 0", fontFamily: "'Cormorant Garamond', serif", fontSize: "1.4rem", fontWeight: 300 }}>
                  {fmtUSDCents(inv.amountCents)}
                </p>
                <LedgerBadges inv={inv} />
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--charcoal-light)" }}>
                <Row label="Status" value={inv.status} />
                <Row label="Due" value={fmtDate(inv.dueDate)} />
                {inv.sentAt && <Row label="Sent" value={fmtDateTime(inv.sentAt)} />}
                {inv.paidAt && <Row label="Paid" value={fmtDateTime(inv.paidAt)} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "stretch" }}>
                {inv.status === "DRAFT" && (
                  <button style={BTN_PRIMARY} onClick={() => handleSend(inv.id)} disabled={busyId === inv.id}>
                    {busyId === inv.id ? "Sending…" : "Send"}
                  </button>
                )}
                {inv.status === "SENT" && inv.stripePaymentLinkUrl && (
                  <a
                    href={inv.stripePaymentLinkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...BTN_GHOST, textAlign: "center", textDecoration: "none", display: "inline-block" }}
                  >
                    View Stripe link
                  </a>
                )}
                {inv.status !== "PAID" && inv.status !== "VOID" && (
                  <button style={BTN_GHOST} onClick={() => handleMarkPaid(inv.id)} disabled={busyId === inv.id}>
                    {busyId === inv.id ? "…" : "Mark paid"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gallery tab ──────────────────────────────────────────────────────────────

function GalleryTab({ eventId }: { eventId: string | null }) {
  return (
    <div>
      <h2 style={SECTION_HEAD}>Gallery</h2>
      {eventId ? (
        <div>
          <p style={{ color: "var(--charcoal-light)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            An event is linked to this project. Manage uploads and the client-facing gallery in the event workspace.
          </p>
          <Link href={`/admin/events/${eventId}`} style={{ ...BTN_PRIMARY, textDecoration: "none", display: "inline-block" }}>
            Open event workspace →
          </Link>
        </div>
      ) : (
        <p style={{ color: "var(--charcoal-muted)", fontSize: "0.9rem" }}>
          Event auto-creates on BOOKED status. Until then, there is no gallery to manage.
        </p>
      )}
    </div>
  );
}

// ─── Vendor day-of room card (Phase 13.11) ────────────────────────────────────
//
// Sits at the top of the Day-of tab. Master-switch toggle + token / URL
// management + vendor allow-list. Public route lives at
// `app/day-of-room/[projectId]` and is read-only.

function VendorDayOfRoomCard({
  projectId,
  enabled,
  token,
  tokenIssuedAt,
  allowList,
  vendorOptions,
}: {
  projectId: string;
  enabled: boolean;
  token: string | null;
  tokenIssuedAt: string | null;
  allowList: string[];
  vendorOptions: SerialDayOfRoomVendorOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [manualVendorId, setManualVendorId] = useState("");
  const [selected, setSelected] = useState<string[]>(allowList);

  useEffect(() => {
    setSelected(allowList);
  }, [allowList]);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl =
    enabled && token ? `${appUrl}/day-of-room/${projectId}?t=${token}` : null;

  const handleEnable = () => {
    startTransition(async () => {
      const res = await enableDayOfRoom(projectId);
      if (res.success) {
        toast("Day-of room enabled");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to enable");
      }
    });
  };

  const handleDisable = () => {
    startTransition(async () => {
      const res = await disableDayOfRoom(projectId);
      if (res.success) {
        toast("Day-of room paused");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to disable");
      }
    });
  };

  const handleMint = () => {
    if (
      !confirm(
        "Mint a fresh token? Any URL you've already shared will stop working immediately."
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await mintNewDayOfRoomToken(projectId);
      if (res.success) {
        toast("New token minted");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to mint token");
      }
    });
  };

  const handleRevoke = () => {
    if (
      !confirm("Revoke the token and disable the room? This kills the URL.")
    ) {
      return;
    }
    startTransition(async () => {
      const res = await revokeDayOfRoomTokenAction(projectId);
      if (res.success) {
        toast("Token revoked");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to revoke");
      }
    });
  };

  const handleCopy = () => {
    if (!publicUrl) return;
    try {
      navigator.clipboard.writeText(publicUrl);
      toast("URL copied");
    } catch {
      toast("Copy failed");
    }
  };

  const persistAllowList = (next: string[]) => {
    setSelected(next);
    startTransition(async () => {
      const res = await setDayOfRoomVendorIds(projectId, next);
      if (res.success) {
        router.refresh();
      } else {
        toast(res.error ?? "Failed to save vendors");
        setSelected(allowList);
      }
    });
  };

  const toggleVendor = (vendorId: string, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selected, vendorId]))
      : selected.filter((id) => id !== vendorId);
    persistAllowList(next);
  };

  const handleAddById = () => {
    const id = manualVendorId.trim();
    if (!id) return;
    if (selected.includes(id)) {
      toast("Already in the list");
      setManualVendorId("");
      return;
    }
    persistAllowList([...selected, id]);
    setManualVendorId("");
  };

  return (
    <section style={{ ...CARD, marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: "0.85rem",
        }}
      >
        <div>
          <p style={EYEBROW}>Phase 13.11</p>
          <h2 style={{ ...SECTION_HEAD, margin: "0.15rem 0 0", fontSize: "1.45rem" }}>
            Vendor day-of room
          </h2>
        </div>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            cursor: isPending ? "wait" : "pointer",
            fontSize: "0.75rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--charcoal)",
          }}
        >
          <input
            type="checkbox"
            checked={enabled}
            disabled={isPending}
            onChange={(e) => (e.target.checked ? handleEnable() : handleDisable())}
            style={{ accentColor: "var(--olive)" }}
          />
          {enabled ? "Enabled" : "Paused"}
        </label>
      </div>

      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.55,
          margin: "0 0 1rem 0",
        }}
      >
        Public, read-only multi-vendor view of the day. Anyone with the URL can
        open it — no login required. Pause to block access without losing the
        URL; revoke to kill the URL entirely.
      </p>

      {enabled && publicUrl ? (
        <div
          style={{
            background: "var(--olive-dim)",
            border: "0.5px solid var(--olive)",
            padding: "0.85rem 1rem",
            display: "grid",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <p style={{ ...EYEBROW, color: "var(--olive)" }}>Shareable URL</p>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <code
              style={{
                fontSize: "0.78rem",
                fontFamily: "monospace",
                color: "var(--charcoal)",
                background: "var(--white)",
                border: "0.5px solid var(--border)",
                padding: "0.4rem 0.6rem",
                wordBreak: "break-all",
                flex: "1 1 320px",
              }}
            >
              {publicUrl}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              style={{ ...BTN_GHOST, padding: "0.4rem 0.85rem", fontSize: "0.65rem" }}
              disabled={isPending}
            >
              Copy
            </button>
          </div>
          {tokenIssuedAt ? (
            <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", margin: 0 }}>
              Token issued {fmtDateTime(tokenIssuedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <button
          type="button"
          onClick={handleMint}
          style={BTN_GHOST}
          disabled={isPending}
        >
          Mint new token
        </button>
        <button
          type="button"
          onClick={handleRevoke}
          style={{
            ...BTN_GHOST,
            color: "#8B2E2E",
            borderColor: "rgba(139,46,46,0.4)",
          }}
          disabled={isPending || (!token && !enabled)}
        >
          Revoke
        </button>
      </div>

      <div>
        <p
          style={{
            ...EYEBROW,
            color: "var(--charcoal-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Vendors in the room
        </p>
        {vendorOptions.length === 0 && selected.length === 0 ? (
          <p style={{ fontSize: "0.85rem", color: "var(--charcoal-muted)", margin: "0 0 0.75rem" }}>
            No vendors are linked to this project yet. Add one by id below, or
            link vendors from the Vendors page.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 0.75rem 0",
              display: "grid",
              gap: "0.4rem",
            }}
          >
            {vendorOptions.map((v) => {
              const inSelected = selected.includes(v.id);
              return (
                <li
                  key={v.id}
                  style={{
                    display: "flex",
                    gap: "0.7rem",
                    alignItems: "center",
                    border: "0.5px solid var(--border)",
                    background: "var(--white)",
                    padding: "0.55rem 0.75rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={inSelected}
                    disabled={isPending}
                    onChange={(e) => toggleVendor(v.id, e.target.checked)}
                    style={{ accentColor: "var(--olive)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>{v.name}</p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.7rem",
                        color: "var(--charcoal-muted)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}
                    >
                      {v.category.toLowerCase()}
                      {v.linkedToProject ? " · linked" : ""}
                      {!v.linkedToProject && v.inAllowList ? " · added by id" : ""}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.65rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: inSelected ? "var(--olive)" : "var(--charcoal-muted)",
                    }}
                  >
                    {inSelected
                      ? "In room"
                      : v.linkedToProject
                      ? "Linked"
                      : "Hidden"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            placeholder="Vendor id"
            value={manualVendorId}
            onChange={(e) => setManualVendorId(e.target.value)}
            disabled={isPending}
            style={{
              flex: "1 1 200px",
              padding: "0.5rem 0.7rem",
              border: "0.5px solid var(--border-strong)",
              background: "var(--white)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
              borderRadius: 0,
            }}
          />
          <button
            type="button"
            onClick={handleAddById}
            style={BTN_GHOST}
            disabled={isPending || !manualVendorId.trim()}
          >
            + Add by id
          </button>
        </div>
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            margin: "0.5rem 0 0",
          }}
        >
          Adds a vendor to the room without linking them on the Vendors page.
          Useful for one-off referrals.
        </p>
      </div>
    </section>
  );
}

// ─── Day-of tab (Phase 2.8) ───────────────────────────────────────────────────
//
// Drag-orderable list of timeline blocks (e.g. "12:00 — First look @ Garden").
// Reused by the shoot-brief generator and the client portal. Uses native HTML5
// drag-and-drop — no react-dnd dep. Reordering rewrites all `order` values
// transactionally via `reorderTimelineBlocksAction`.

type DayOfBlockDraft = {
  title: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  blockType: string;
  notes: string;
  visibleToClient: boolean;
};

function blockToDraft(b: SerialTimelineBlock): DayOfBlockDraft {
  return {
    title: b.title ?? "",
    startTime: b.startTime ?? "",
    durationMinutes: b.durationMinutes ?? 0,
    location: b.location ?? "",
    blockType: b.blockType,
    notes: b.notes ?? "",
    visibleToClient: !!b.visibleToClient,
  };
}

function formatDurationTotal(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return "0m";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function DayOfTab({
  projectId,
  initialBlocks,
}: {
  projectId: string;
  initialBlocks: SerialTimelineBlock[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Local ordering — mirrors the server state but lets the drag-and-drop UI
  // update optimistically before the round-trip completes.
  const [blocks, setBlocks] = useState<SerialTimelineBlock[]>(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DayOfBlockDraft | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // If the server data updates (e.g. after a `router.refresh()`), re-seed
  // local state. We compare by id-order so we don't clobber an in-flight
  // local reorder.
  useEffect(() => {
    setBlocks(initialBlocks);
  }, [initialBlocks]);

  const totalMinutes = blocks.reduce(
    (acc, b) => acc + (Number.isFinite(b.durationMinutes) ? b.durationMinutes : 0),
    0
  );

  const handleAdd = () => {
    startTransition(async () => {
      const res = await createTimelineBlockAction(projectId, {
        title: "New block",
        startTime: "12:00",
        durationMinutes: 30,
        blockType: "SHOOT",
        visibleToClient: true,
      });
      if (res.success) {
        toast("Block added");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to add block");
      }
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`Delete "${title}" from the timeline?`)) return;
    startTransition(async () => {
      const res = await deleteTimelineBlockAction(projectId, id);
      if (res.success) {
        toast("Block deleted");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to delete block");
      }
    });
  };

  const beginEdit = (b: SerialTimelineBlock) => {
    setEditingId(b.id);
    setDraft(blockToDraft(b));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!editingId || !draft) return;
    const patch = {
      title: draft.title,
      startTime: draft.startTime,
      durationMinutes: draft.durationMinutes,
      location: draft.location,
      blockType: draft.blockType as
        | "PREP"
        | "TRAVEL"
        | "SHOOT"
        | "BREAK"
        | "DETAIL"
        | "FAMILY"
        | "CEREMONY"
        | "RECEPTION"
        | "OTHER",
      notes: draft.notes,
      visibleToClient: draft.visibleToClient,
    };
    const id = editingId;
    startTransition(async () => {
      const res = await updateTimelineBlockAction(projectId, id, patch);
      if (res.success) {
        toast("Block saved");
        setEditingId(null);
        setDraft(null);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to save block");
      }
    });
  };

  // ─── Drag-and-drop ────────────────────────────────────────────────────────
  const handleDragStart = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    dragIdRef.current = id;
    e.dataTransfer.effectAllowed = "move";
    // Firefox requires data to be set for the drag to fire.
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch {
      /* noop */
    }
  };

  const handleDragOver = (id: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (hoverId !== id) setHoverId(id);
  };

  const handleDragLeave = () => {
    setHoverId(null);
  };

  const handleDrop = (targetId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    dragIdRef.current = null;
    setHoverId(null);
    if (!sourceId || sourceId === targetId) return;
    const srcIdx = blocks.findIndex((b) => b.id === sourceId);
    const tgtIdx = blocks.findIndex((b) => b.id === targetId);
    if (srcIdx < 0 || tgtIdx < 0) return;
    const next = blocks.slice();
    const [moved] = next.splice(srcIdx, 1);
    next.splice(tgtIdx, 0, moved);
    setBlocks(next); // optimistic
    const orderedIds = next.map((b) => b.id);
    startTransition(async () => {
      const res = await reorderTimelineBlocksAction(projectId, orderedIds);
      if (res.success) {
        router.refresh();
      } else {
        toast(res.error ?? "Failed to reorder");
        // Revert by re-reading server state.
        router.refresh();
      }
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Day-of schedule</h2>
        <span
          style={{
            ...PILL,
            background: "var(--white)",
            color: "var(--charcoal)",
            borderColor: "var(--border-strong)",
          }}
        >
          Total duration: {formatDurationTotal(totalMinutes)}
        </span>
      </div>

      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.55,
          margin: "0 0 1.25rem 0",
        }}
      >
        Drag rows to reorder. Toggle visibility per block to control what the
        client portal shows. Times are local to the shoot — the shoot date
        itself is set on the project.
      </p>

      {blocks.length === 0 ? (
        <div
          style={{
            padding: "1.5rem",
            border: "0.5px dashed var(--border-strong)",
            background: "var(--white)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--charcoal-light)",
              margin: "0 0 1rem 0",
            }}
          >
            No timeline blocks yet.
          </p>
          <button
            type="button"
            style={BTN_PRIMARY}
            onClick={handleAdd}
            disabled={isPending}
          >
            + Add block
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {blocks.map((b) => {
              const isEditing = editingId === b.id;
              const isHover = hoverId === b.id;
              return (
                <div
                  key={b.id}
                  draggable={!isEditing}
                  onDragStart={handleDragStart(b.id)}
                  onDragOver={handleDragOver(b.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop(b.id)}
                  style={{
                    border: `0.5px solid ${
                      isHover ? "var(--olive)" : "var(--border)"
                    }`,
                    background: "var(--white)",
                    padding: "0.85rem 1rem",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "0.85rem",
                    alignItems: "start",
                    transition: "border-color 120ms ease",
                  }}
                >
                  {/* Drag handle */}
                  <div
                    aria-hidden
                    style={{
                      cursor: isEditing ? "default" : "grab",
                      color: "var(--charcoal-muted)",
                      fontFamily: "monospace",
                      fontSize: "1rem",
                      paddingTop: "0.15rem",
                      userSelect: "none",
                    }}
                    title="Drag to reorder"
                  >
                    ⋮⋮
                  </div>

                  {/* Body */}
                  {isEditing && draft ? (
                    <DayOfBlockEditor
                      draft={draft}
                      onChange={setDraft}
                      onCancel={cancelEdit}
                      onSave={saveEdit}
                      disabled={isPending}
                    />
                  ) : (
                    <DayOfBlockRow block={b} />
                  )}

                  {/* Row actions */}
                  {!isEditing && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.35rem",
                        alignItems: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => beginEdit(b)}
                        style={{
                          ...BTN_GHOST,
                          padding: "0.35rem 0.7rem",
                          fontSize: "0.65rem",
                        }}
                        disabled={isPending}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id, b.title)}
                        style={{
                          ...BTN_GHOST,
                          padding: "0.35rem 0.7rem",
                          fontSize: "0.65rem",
                          color: "var(--charcoal-muted)",
                        }}
                        disabled={isPending}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              type="button"
              style={BTN_PRIMARY}
              onClick={handleAdd}
              disabled={isPending}
            >
              + Add block
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function DayOfBlockRow({ block }: { block: SerialTimelineBlock }) {
  const typeLabel =
    TIMELINE_BLOCK_TYPE_OPTIONS.find((o) => o.value === block.blockType)?.label ??
    block.blockType;
  const durationLabel =
    block.durationMinutes > 0 ? formatDurationTotal(block.durationMinutes) : "instant";
  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "0.6rem",
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.15rem",
            color: "var(--charcoal)",
            fontWeight: 400,
            letterSpacing: "0.02em",
          }}
        >
          {block.startTime || "—"}
        </span>
        <span
          style={{
            fontSize: "0.95rem",
            color: "var(--charcoal)",
            fontWeight: 400,
          }}
        >
          {block.title || "Untitled block"}
        </span>
        <span
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "var(--olive)",
            border: "0.5px solid var(--olive)",
            padding: "0.1rem 0.5rem",
          }}
        >
          {typeLabel}
        </span>
        {!block.visibleToClient && (
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              border: "0.5px solid var(--border-strong)",
              padding: "0.1rem 0.5rem",
            }}
          >
            Internal
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: "0.3rem",
          fontSize: "0.78rem",
          color: "var(--charcoal-muted)",
          display: "flex",
          gap: "0.6rem",
          flexWrap: "wrap",
        }}
      >
        <span>{durationLabel}</span>
        {block.location && <span>· {block.location}</span>}
      </div>
      {block.notes && (
        <p
          style={{
            margin: "0.45rem 0 0 0",
            fontSize: "0.8rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.5,
          }}
        >
          {block.notes}
        </p>
      )}
    </div>
  );
}

function DayOfBlockEditor({
  draft,
  onChange,
  onCancel,
  onSave,
  disabled,
}: {
  draft: DayOfBlockDraft;
  onChange: (next: DayOfBlockDraft) => void;
  onCancel: () => void;
  onSave: () => void;
  disabled: boolean;
}) {
  const fieldStyle: React.CSSProperties = {
    padding: "0.5rem 0.65rem",
    border: "0.5px solid var(--border-strong)",
    fontFamily: "'Jost', sans-serif",
    fontSize: "0.85rem",
    background: "var(--white)",
    borderRadius: 0,
    width: "100%",
  };
  const labelStyle: React.CSSProperties = {
    ...EYEBROW,
    fontSize: "0.55rem",
    margin: "0 0 0.25rem 0",
  };
  return (
    <div style={{ display: "grid", gap: "0.6rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 110px", gap: "0.6rem" }}>
        <div>
          <p style={labelStyle}>Title</p>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => onChange({ ...draft, title: e.target.value })}
            placeholder="First look"
            style={fieldStyle}
          />
        </div>
        <div>
          <p style={labelStyle}>Start time</p>
          <input
            type="time"
            value={draft.startTime}
            onChange={(e) => onChange({ ...draft, startTime: e.target.value })}
            style={fieldStyle}
          />
        </div>
        <div>
          <p style={labelStyle}>Duration (min)</p>
          <input
            type="number"
            min={0}
            value={draft.durationMinutes}
            onChange={(e) =>
              onChange({
                ...draft,
                durationMinutes: Math.max(0, Math.floor(Number(e.target.value) || 0)),
              })
            }
            style={fieldStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "0.6rem" }}>
        <div>
          <p style={labelStyle}>Location</p>
          <input
            type="text"
            value={draft.location}
            onChange={(e) => onChange({ ...draft, location: e.target.value })}
            placeholder="Garden / Patio / Hotel suite"
            style={fieldStyle}
          />
        </div>
        <div>
          <p style={labelStyle}>Type</p>
          <select
            value={draft.blockType}
            onChange={(e) => onChange({ ...draft, blockType: e.target.value })}
            style={fieldStyle}
          >
            {TIMELINE_BLOCK_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <p style={labelStyle}>Notes</p>
        <textarea
          value={draft.notes}
          onChange={(e) => onChange({ ...draft, notes: e.target.value })}
          rows={2}
          style={{ ...fieldStyle, resize: "vertical" }}
        />
      </div>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.8rem",
          color: "var(--charcoal-light)",
        }}
      >
        <input
          type="checkbox"
          checked={draft.visibleToClient}
          onChange={(e) => onChange({ ...draft, visibleToClient: e.target.checked })}
        />
        Visible on client portal
      </label>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={onCancel} style={BTN_GHOST} disabled={disabled}>
          Cancel
        </button>
        <button type="button" onClick={onSave} style={BTN_PRIMARY} disabled={disabled}>
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

type TimelineRow = {
  at: string; // ISO
  kind: "status" | "message" | "invoice-sent" | "invoice-paid" | "contract-sent" | "contract-signed";
  label: string;
  detail?: string;
};

function TimelineTab({
  project,
  messages,
  invoices,
  contract,
}: {
  project: SerialProject;
  messages: SerialMessage[];
  invoices: SerialInvoice[];
  contract: SerialContract | null;
}) {
  const rows: TimelineRow[] = useMemo(() => {
    const out: TimelineRow[] = [];

    for (const h of project.statusHistory) {
      if (h.at) out.push({ at: h.at, kind: "status", label: `Moved to ${statusLabel(h.status)}` });
    }

    for (const m of messages) {
      if (m.sentAt)
        out.push({
          at: m.sentAt,
          kind: "message",
          label: m.direction === "OUTBOUND" ? "Outbound message" : "Inbound message",
          detail: m.subject ?? m.body.slice(0, 80),
        });
    }

    for (const inv of invoices) {
      if (inv.sentAt)
        out.push({
          at: inv.sentAt,
          kind: "invoice-sent",
          label: `${inv.type} invoice sent`,
          detail: fmtUSDCents(inv.amountCents),
        });
      if (inv.paidAt)
        out.push({
          at: inv.paidAt,
          kind: "invoice-paid",
          label: `${inv.type} invoice paid`,
          detail: fmtUSDCents(inv.amountCents),
        });
    }

    if (contract) {
      if (contract.sentAt) out.push({ at: contract.sentAt, kind: "contract-sent", label: "Contract sent" });
      if (contract.signedAt) out.push({ at: contract.signedAt, kind: "contract-signed", label: "Contract signed" });
    }

    return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [project.statusHistory, messages, invoices, contract]);

  return (
    <div>
      <h2 style={SECTION_HEAD}>Timeline</h2>
      {rows.length === 0 ? (
        <p style={{ color: "var(--charcoal-muted)", fontSize: "0.9rem" }}>No events recorded yet.</p>
      ) : (
        <ol style={{ listStyle: "none", padding: 0, margin: 0, borderLeft: "0.5px solid var(--border-strong)" }}>
          {rows.map((r, i) => (
            <li key={i} style={{ position: "relative", padding: "0 0 1.25rem 1.5rem" }}>
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  left: "-9px",
                  top: "0.25rem",
                  width: "16px",
                  height: "16px",
                  background: "var(--white)",
                  border: "0.5px solid var(--olive)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <TimelineIcon kind={r.kind} />
              </span>
              <p style={{ ...EYEBROW, margin: "0 0 0.25rem 0", fontSize: "0.55rem" }}>{fmtDateTime(r.at)}</p>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--charcoal)" }}>
                <strong style={{ fontWeight: 500 }}>{r.label}</strong>
                {r.detail && <span style={{ color: "var(--charcoal-muted)" }}> · {r.detail}</span>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function TimelineIcon({ kind }: { kind: TimelineRow["kind"] }) {
  // Tiny inline SVGs, no external lib.
  const stroke = "var(--olive)";
  switch (kind) {
    case "status":
      return (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <circle cx="4" cy="4" r="2.5" fill={stroke} />
        </svg>
      );
    case "message":
      return (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <rect x="1" y="2" width="6" height="4" fill="none" stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "invoice-sent":
    case "invoice-paid":
      return (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M4 1 L7 7 L1 7 Z" fill={kind === "invoice-paid" ? stroke : "none"} stroke={stroke} strokeWidth="1" />
        </svg>
      );
    case "contract-sent":
    case "contract-signed":
      return (
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
          <path d="M1 6 L4 1 L7 6" fill={kind === "contract-signed" ? stroke : "none"} stroke={stroke} strokeWidth="1" />
        </svg>
      );
  }
}

// ─── Files tab ────────────────────────────────────────────────────────────────

type ProjectFile = {
  key: string;
  name: string;
  size: number;
  lastModified: string | null;
  downloadUrl: string;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatUploadedAt(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function FilesTab({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = async () => {
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/list`, {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`List failed (${res.status})`);
      const data = (await res.json()) as { objects?: ProjectFile[] };
      setFiles(Array.isArray(data.objects) ? data.objects : []);
    } catch (err) {
      console.error(err);
      setError("Could not load files. Please try again.");
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input so picking the same file twice re-fires `change`.
    if (e.target) e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const presignRes = await fetch(`/api/projects/${projectId}/files/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!presignRes.ok) throw new Error(`Presign failed (${presignRes.status})`);
      const { presignedUrl } = (await presignRes.json()) as {
        presignedUrl: string;
        key: string;
      };

      const putRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

      toast(`Uploaded ${file.name}`);
      await loadFiles();
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (key: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    setDeletingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/files/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      toast(`Deleted ${name}`);
      setFiles((prev) => prev.filter((f) => f.key !== key));
    } catch (err) {
      console.error(err);
      setError("Delete failed. Please try again.");
    } finally {
      setDeletingKey(null);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Files</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--charcoal-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {uploading ? "Uploading…" : `${files.length} file${files.length === 1 ? "" : "s"}`}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            style={BTN_PRIMARY}
            onClick={handlePickFile}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </div>

      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--charcoal-muted)",
          marginBottom: "1.25rem",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        Stored under{" "}
        <code style={{ fontSize: "0.75rem" }}>projects/{projectId}/files/</code> in R2.
      </p>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            border: "0.5px solid var(--border-strong)",
            background: "var(--white)",
            color: "var(--charcoal)",
            fontSize: "0.85rem",
            marginBottom: "1rem",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: "2rem",
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            color: "var(--charcoal-muted)",
            fontSize: "0.85rem",
            fontFamily: "'Jost', sans-serif",
            textAlign: "center",
          }}
        >
          Loading files…
        </div>
      ) : files.length === 0 ? (
        <div
          style={{
            padding: "2.5rem 1.5rem",
            border: "0.5px solid var(--border)",
            background: "var(--white)",
            color: "var(--charcoal-muted)",
            fontSize: "0.9rem",
            fontFamily: "'Jost', sans-serif",
            textAlign: "center",
          }}
        >
          No files yet. Upload contracts, questionnaires, or deliverables here.
        </div>
      ) : (
        <div style={{ border: "0.5px solid var(--border)", background: "var(--white)" }}>
          {files.map((f, idx) => (
            <div
              key={f.key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto auto",
                alignItems: "center",
                gap: "1rem",
                padding: "0.9rem 1.1rem",
                borderTop: idx === 0 ? "none" : "0.5px solid var(--border)",
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.85rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    color: "var(--charcoal)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={f.name}
                >
                  {f.name}
                </div>
                <div
                  style={{
                    color: "var(--charcoal-muted)",
                    fontSize: "0.7rem",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginTop: "0.2rem",
                  }}
                >
                  {formatUploadedAt(f.lastModified)}
                </div>
              </div>
              <div
                style={{
                  color: "var(--charcoal-muted)",
                  fontSize: "0.75rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                {formatBytes(f.size)}
              </div>
              <a
                href={f.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...BTN_GHOST,
                  textDecoration: "none",
                  display: "inline-block",
                  textAlign: "center",
                }}
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => handleDelete(f.key, f.name)}
                disabled={deletingKey === f.key}
                style={{
                  ...BTN_GHOST,
                  color: "var(--charcoal)",
                  opacity: deletingKey === f.key ? 0.5 : 1,
                }}
              >
                {deletingKey === f.key ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Editing workflow block (Phase 3.13) ─────────────────────────────────────

/**
 * 5-step stepper for the in-editing sub-stage.
 *
 * Visible only while `project.status === "IN_EDITING"`. Each step is clickable;
 * clicking advances (or sets) the sub-stage via `setEditingSubStage`. The
 * DELIVERED step also transitions the project status to GALLERY_DELIVERED via
 * the server action, so we route through `router.refresh()` afterwards to pick
 * up the fresh state.
 */
function EditingWorkflowBlock({ project }: { project: SerialProject }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (project.status !== "IN_EDITING") return null;

  const currentStage =
    (project.editingSubStage as EditingSubStage | null) ?? null;
  const currentIndex = currentStage
    ? EDITING_SUB_STAGES.indexOf(currentStage)
    : -1;

  const info = computeEditingStatus({
    shootDate: project.shootDate ? new Date(project.shootDate) : null,
    deliveredAt: project.deliveredAt ? new Date(project.deliveredAt) : null,
    sessionType: project.sessionType,
    editingSubStage: currentStage,
  });

  const handleAdvance = (stage: EditingSubStage) => {
    if (isPending) return;
    startTransition(async () => {
      const res = await setEditingSubStage(project.id, stage);
      if (res.success) {
        toast(`Editing → ${stage.toLowerCase()}`);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update editing stage");
      }
    });
  };

  const dotColor = info ? editingStatusColor(info.status) : "var(--olive)";

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: "0.5px solid var(--border)",
        padding: "1rem 1.1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginBottom: "0.85rem",
        }}
      >
        <div>
          <p style={{ ...EYEBROW, margin: "0 0 0.3rem 0" }}>Editing workflow</p>
          <p
            style={{
              margin: 0,
              fontSize: "0.82rem",
              color: "var(--charcoal-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: dotColor,
              }}
            />
            {info ? info.pillLabel : "No shoot date set"}
          </p>
        </div>
      </div>

      {/* 5-step horizontal stepper */}
      <ol
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${EDITING_SUB_STAGES.length}, 1fr)`,
          gap: "0.5rem",
        }}
      >
        {EDITING_SUB_STAGES.map((stage, i) => {
          const isComplete = currentIndex > -1 && i <= currentIndex;
          const isCurrent = i === currentIndex;
          return (
            <li key={stage} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => handleAdvance(stage)}
                disabled={isPending}
                title={
                  isCurrent
                    ? `Current — ${stage.toLowerCase()}`
                    : `Set to ${stage.toLowerCase()}`
                }
                style={{
                  width: "100%",
                  padding: "0.55rem 0.4rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: isComplete ? "var(--olive)" : "var(--charcoal-muted)",
                  background: isCurrent ? "var(--olive-dim)" : "transparent",
                  border: "0.5px solid",
                  borderColor: isComplete
                    ? "var(--olive)"
                    : "var(--border-strong)",
                  cursor: isPending ? "wait" : "pointer",
                  opacity: isPending ? 0.6 : 1,
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "0.5px solid",
                    borderColor: isComplete
                      ? "var(--olive)"
                      : "var(--border-strong)",
                    background: isComplete ? "var(--olive)" : "transparent",
                    color: isComplete ? "var(--white)" : "var(--charcoal-muted)",
                    fontSize: "0.7rem",
                  }}
                >
                  {i + 1}
                </span>
                <span>{stage}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Gear tab (Phase 3.7) ────────────────────────────────────────────────────

function GearTab({
  projectId,
  gearLog,
  templateOptions,
  defaultTemplateId,
  defaultTemplateName,
}: {
  projectId: string;
  gearLog: SerialGearLogEntry[];
  templateOptions: SerialGearTemplateOption[];
  defaultTemplateId: string | null;
  defaultTemplateName: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [pickedTemplateId, setPickedTemplateId] = useState<string>(
    defaultTemplateId ?? templateOptions[0]?.id ?? ""
  );

  // Ad-hoc form state
  const [adHocName, setAdHocName] = useState("");
  const [adHocCategory, setAdHocCategory] =
    useState<GearCategoryLiteral>("ACCESSORY");
  const [adHocRequired, setAdHocRequired] = useState(false);

  const packedCount = gearLog.filter((e) => e.packed).length;
  const total = gearLog.length;
  const requiredOutstanding = gearLog.filter(
    (e) => e.required && !e.packed
  ).length;

  // Group by category for display.
  const grouped = gearLog.reduce<Record<GearCategoryLiteral, SerialGearLogEntry[]>>(
    (acc, e) => {
      const key = (GEAR_CATEGORIES as readonly string[]).includes(e.category)
        ? (e.category as GearCategoryLiteral)
        : "OTHER";
      if (!acc[key]) acc[key] = [];
      acc[key].push(e);
      return acc;
    },
    {} as Record<GearCategoryLiteral, SerialGearLogEntry[]>
  );

  const handleInit = (templateId: string) => {
    if (!templateId) {
      toast("Pick a template first");
      return;
    }
    startTransition(async () => {
      const res = await initializeGearLog(projectId, templateId);
      if (res.success) {
        toast(`Loaded ${res.created ?? 0} items`);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to initialise gear log");
      }
    });
  };

  const handleToggle = (entryId: string, next: boolean) => {
    setBusyEntryId(entryId);
    startTransition(async () => {
      const res = await toggleGearItemPacked(projectId, entryId, next);
      setBusyEntryId(null);
      if (res.success) {
        router.refresh();
      } else {
        toast(res.error ?? "Failed to update item");
      }
    });
  };

  const handleAdHoc = () => {
    if (!adHocName.trim()) {
      toast("Name is required");
      return;
    }
    startTransition(async () => {
      const res = await addAdHocGearItemAction(projectId, {
        name: adHocName,
        category: adHocCategory,
        required: adHocRequired,
      });
      if (res.success) {
        toast("Item added");
        setAdHocName("");
        setAdHocRequired(false);
        router.refresh();
      } else {
        toast(res.error ?? "Failed to add item");
      }
    });
  };

  const handleRemove = (entryId: string, name: string) => {
    if (!confirm(`Remove "${name}" from the gear list?`)) return;
    setBusyEntryId(entryId);
    startTransition(async () => {
      const res = await removeGearItemAction(projectId, entryId);
      setBusyEntryId(null);
      if (res.success) {
        toast("Item removed");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to remove item");
      }
    });
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (gearLog.length === 0) {
    return (
      <div>
        <h2 style={SECTION_HEAD}>Gear</h2>

        {templateOptions.length === 0 ? (
          <div
            style={{
              padding: "2rem 1.5rem",
              border: "0.5px dashed var(--border-strong)",
              background: "var(--white)",
            }}
          >
            <p style={{ ...EYEBROW, marginBottom: "0.5rem" }}>No kits yet</p>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--charcoal-light)",
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              No gear templates exist for this session type yet. Build one in{" "}
              <Link
                href="/admin/settings/gear-templates"
                style={{ color: "var(--olive)", textDecoration: "underline" }}
              >
                Settings → Gear Templates
              </Link>
              .
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: "1.5rem",
              border: "0.5px solid var(--border)",
              background: "var(--white)",
            }}
          >
            <p style={{ ...EYEBROW, marginBottom: "0.5rem" }}>
              No gear log yet
            </p>
            <p
              style={{
                fontSize: "0.9rem",
                color: "var(--charcoal-light)",
                lineHeight: 1.55,
                margin: "0 0 1rem 0",
              }}
            >
              Pick a kit to copy into this project&apos;s day-of pack-check list.
            </p>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <select
                value={pickedTemplateId}
                onChange={(e) => setPickedTemplateId(e.target.value)}
                style={{
                  padding: "0.5rem 0.7rem",
                  border: "0.5px solid var(--border-strong)",
                  fontFamily: "'Jost', sans-serif",
                  fontSize: "0.85rem",
                  background: "var(--white)",
                  borderRadius: 0,
                  minWidth: "220px",
                }}
              >
                {templateOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                    {opt.isDefault ? " (default)" : ""} · {opt.itemCount} items
                  </option>
                ))}
              </select>
              <button
                type="button"
                style={BTN_PRIMARY}
                onClick={() => handleInit(pickedTemplateId)}
                disabled={isPending || !pickedTemplateId}
              >
                {isPending
                  ? "Loading…"
                  : `Initialize from ${
                      templateOptions.find((t) => t.id === pickedTemplateId)
                        ?.name ?? defaultTemplateName ?? "template"
                    }`}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Active log ────────────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Gear</h2>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span
            style={{
              ...PILL,
              background:
                packedCount === total ? "var(--olive)" : "var(--olive-dim)",
              color: packedCount === total ? "var(--white)" : "var(--olive)",
            }}
          >
            {packedCount} / {total} packed
          </span>
          {requiredOutstanding > 0 && (
            <span
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                padding: "0.25rem 0.7rem",
                border: "0.5px solid rgba(176, 50, 50, 0.6)",
                color: "#b03232",
                background: "rgba(176, 50, 50, 0.06)",
              }}
            >
              {requiredOutstanding} required outstanding
            </span>
          )}
        </div>
      </div>

      {/* Grouped check-off list */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          marginBottom: "1.5rem",
        }}
      >
        {GEAR_CATEGORIES.filter((c) => (grouped[c]?.length ?? 0) > 0).map(
          (cat, ci) => (
            <div
              key={cat}
              style={{
                borderTop: ci === 0 ? "none" : "0.5px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "0.7rem 1.1rem",
                  background: "rgba(42,42,40,0.03)",
                  ...EYEBROW,
                  fontSize: "0.6rem",
                }}
              >
                {cat}
              </div>
              {grouped[cat].map((entry) => (
                <GearRow
                  key={entry.id}
                  entry={entry}
                  busy={busyEntryId === entry.id}
                  onToggle={(next) => handleToggle(entry.id, next)}
                  onRemove={() => handleRemove(entry.id, entry.name)}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Ad-hoc add */}
      <div
        style={{
          border: "0.5px solid var(--border-strong)",
          padding: "1rem",
          background: "var(--white)",
        }}
      >
        <p style={{ ...EYEBROW, margin: "0 0 0.6rem 0" }}>Add ad-hoc item</p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.5fr 1fr auto auto",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <input
            value={adHocName}
            onChange={(e) => setAdHocName(e.target.value)}
            placeholder="e.g. Backup tripod"
            style={{
              padding: "0.5rem 0.7rem",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
              borderRadius: 0,
              background: "var(--white)",
              color: "var(--charcoal)",
            }}
          />
          <select
            value={adHocCategory}
            onChange={(e) =>
              setAdHocCategory(e.target.value as GearCategoryLiteral)
            }
            style={{
              padding: "0.5rem 0.7rem",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.85rem",
              background: "var(--white)",
              borderRadius: 0,
            }}
          >
            {GEAR_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
            }}
          >
            <input
              type="checkbox"
              checked={adHocRequired}
              onChange={(e) => setAdHocRequired(e.target.checked)}
            />
            Required
          </label>
          <button
            type="button"
            style={BTN_PRIMARY}
            onClick={handleAdHoc}
            disabled={isPending || !adHocName.trim()}
          >
            {isPending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GearRow({
  entry,
  busy,
  onToggle,
  onRemove,
}: {
  entry: SerialGearLogEntry;
  busy: boolean;
  onToggle: (next: boolean) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto auto",
        gap: "0.85rem",
        alignItems: "center",
        padding: "0.75rem 1.1rem",
        borderTop: "0.5px solid var(--border)",
        opacity: busy ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={entry.packed}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={busy}
        aria-label={`Mark ${entry.name} packed`}
        style={{ width: "1rem", height: "1rem", cursor: "pointer" }}
      />
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: "var(--charcoal)",
            textDecoration: entry.packed ? "line-through" : "none",
            textDecorationColor: "var(--charcoal-muted)",
          }}
        >
          {entry.name}
          {entry.required && (
            <span
              style={{
                marginLeft: "0.5rem",
                fontSize: "0.6rem",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--olive)",
                fontWeight: 500,
              }}
            >
              Required
            </span>
          )}
        </p>
        {entry.notes && (
          <p
            style={{
              margin: "0.2rem 0 0 0",
              fontSize: "0.75rem",
              color: "var(--charcoal-muted)",
              lineHeight: 1.4,
            }}
          >
            {entry.notes}
          </p>
        )}
      </div>
      <span
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {entry.packedAt
          ? new Date(entry.packedAt).toLocaleTimeString([], {
              hour: "numeric",
              minute: "2-digit",
            })
          : "—"}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        title="Remove from list"
        style={{
          background: "transparent",
          border: "0.5px solid var(--border-strong)",
          color: "var(--charcoal-light)",
          padding: "0.3rem 0.55rem",
          fontSize: "0.7rem",
          fontFamily: "'Jost', sans-serif",
          cursor: "pointer",
          borderRadius: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

// ─── Press tab ────────────────────────────────────────────────────────────────

const PRESS_STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "PUBLISHED",
  "REJECTED",
  "WITHDRAWN",
] as const;
type PressStatusLiteral = (typeof PRESS_STATUSES)[number];

function pressStatusPillStyle(status: string): React.CSSProperties {
  // SUBMITTED + ACKNOWLEDGED: olive. PUBLISHED: olive solid. REJECTED + WITHDRAWN: muted.
  if (status === "PUBLISHED") {
    return {
      ...PILL,
      background: "var(--olive)",
      color: "var(--white)",
    };
  }
  if (status === "REJECTED" || status === "WITHDRAWN") {
    return {
      ...PILL,
      background: "transparent",
      color: "var(--charcoal-muted)",
      border: "0.5px solid var(--border-strong)",
    };
  }
  return PILL;
}

function timeAgoFromIso(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.round(mo / 12);
  return `${yr}y ago`;
}

function PressTab({
  projectId,
  submissions,
}: {
  projectId: string;
  submissions: SerialPressSubmission[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SerialPressSubmission | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (row: SerialPressSubmission) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleDelete = (row: SerialPressSubmission) => {
    if (!confirm(`Delete the ${row.publicationName} submission? This cannot be undone.`)) {
      return;
    }
    setBusyId(row.id);
    startTransition(async () => {
      const res = await deletePressSubmissionAction(projectId, row.id);
      setBusyId(null);
      if (res.success) {
        toast("Submission deleted");
        router.refresh();
      } else {
        toast(res.error ?? "Failed to delete submission");
      }
    });
  };

  const handleSubmit = (
    values: PressFormValues,
    onClose: () => void
  ) => {
    startTransition(async () => {
      if (editing) {
        const patch: UpdatePressSubmissionInput = {
          publicationName: values.publicationName,
          publicationUrl: values.publicationUrl || null,
          contactName: values.contactName || null,
          contactEmail: values.contactEmail || null,
          submittedAt: values.submittedAt || undefined,
          status: values.status,
          publishedUrl:
            values.status === "PUBLISHED" ? values.publishedUrl || null : null,
          publishedAt:
            values.status === "PUBLISHED"
              ? values.publishedAt || null
              : null,
          notes: values.notes || null,
        };
        const res = await updatePressSubmissionAction(projectId, editing.id, patch);
        if (res.success) {
          toast("Submission updated");
          onClose();
          router.refresh();
        } else {
          toast(res.error ?? "Failed to update submission");
        }
        return;
      }

      const input: CreatePressSubmissionInput = {
        publicationName: values.publicationName,
        publicationUrl: values.publicationUrl || undefined,
        contactName: values.contactName || undefined,
        contactEmail: values.contactEmail || undefined,
        submittedAt: values.submittedAt || undefined,
        status: values.status,
        publishedUrl:
          values.status === "PUBLISHED" ? values.publishedUrl || undefined : undefined,
        publishedAt:
          values.status === "PUBLISHED" ? values.publishedAt || undefined : undefined,
        notes: values.notes || undefined,
      };
      const res = await createPressSubmissionAction(projectId, input);
      if (res.success) {
        toast("Submission logged");
        onClose();
        router.refresh();
      } else {
        toast(res.error ?? "Failed to create submission");
      }
    });
  };

  // ─── Empty state ───────────────────────────────────────────────────────────
  if (submissions.length === 0) {
    return (
      <div>
        <h2 style={SECTION_HEAD}>Press</h2>
        <div
          style={{
            padding: "2rem 1.5rem",
            border: "0.5px dashed var(--border-strong)",
            background: "var(--white)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: "0.95rem",
              color: "var(--charcoal-light)",
              margin: "0 0 1rem 0",
              lineHeight: 1.55,
            }}
          >
            No press submissions yet.
          </p>
          <button type="button" style={BTN_PRIMARY} onClick={openCreate}>
            + Log submission
          </button>
        </div>

        {modalOpen && (
          <PressModal
            initial={null}
            disabled={isPending}
            onClose={() => setModalOpen(false)}
            onSubmit={(values) => handleSubmit(values, () => setModalOpen(false))}
          />
        )}
      </div>
    );
  }

  // ─── Populated state ───────────────────────────────────────────────────────
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Press</h2>
        <button type="button" style={BTN_PRIMARY} onClick={openCreate}>
          + Log submission
        </button>
      </div>

      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.9fr 0.9fr 1.3fr 0.9fr auto",
            gap: "0.75rem",
            padding: "0.7rem 1rem",
            background: "rgba(42,42,40,0.03)",
            ...EYEBROW,
            fontSize: "0.6rem",
          }}
        >
          <span>Publication</span>
          <span>Status</span>
          <span>Submitted</span>
          <span>Article</span>
          <span>Backlink</span>
          <span />
        </div>
        {submissions.map((row) => (
          <PressRow
            key={row.id}
            row={row}
            busy={busyId === row.id}
            onEdit={() => openEdit(row)}
            onDelete={() => handleDelete(row)}
          />
        ))}
      </div>

      {modalOpen && (
        <PressModal
          initial={editing}
          disabled={isPending}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSubmit={(values) =>
            handleSubmit(values, () => {
              setModalOpen(false);
              setEditing(null);
            })
          }
        />
      )}
    </div>
  );
}

function PressRow({
  row,
  busy,
  onEdit,
  onDelete,
}: {
  row: SerialPressSubmission;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 0.9fr 0.9fr 1.3fr 0.9fr auto",
        gap: "0.75rem",
        alignItems: "center",
        padding: "0.85rem 1rem",
        borderTop: "0.5px solid var(--border)",
        opacity: busy ? 0.5 : 1,
        fontSize: "0.85rem",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, color: "var(--charcoal)" }}>
          {row.publicationUrl ? (
            <a
              href={row.publicationUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--charcoal)", textDecoration: "none" }}
            >
              {row.publicationName}
            </a>
          ) : (
            row.publicationName
          )}
        </p>
        {row.contactName && (
          <p
            style={{
              margin: "0.2rem 0 0 0",
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
            }}
          >
            {row.contactName}
          </p>
        )}
      </div>
      <div>
        <span style={pressStatusPillStyle(row.status)}>
          {String(row.status).toLowerCase()}
        </span>
      </div>
      <div style={{ color: "var(--charcoal-light)", fontSize: "0.8rem" }}>
        {fmtDate(row.submittedAt)}
      </div>
      <div style={{ minWidth: 0, overflow: "hidden" }}>
        {row.publishedUrl ? (
          <a
            href={row.publishedUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--olive)",
              textDecoration: "underline",
              fontSize: "0.8rem",
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={row.publishedUrl}
          >
            {row.publishedUrl}
          </a>
        ) : (
          <span style={{ color: "var(--charcoal-muted)", fontSize: "0.8rem" }}>
            —
          </span>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
        <BacklinkChip row={row} />
        {row.lastLinkCheckAt && (
          <span style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)" }}>
            {timeAgoFromIso(row.lastLinkCheckAt)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: "0.35rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          style={{
            background: "transparent",
            border: "0.5px solid var(--border-strong)",
            color: "var(--charcoal-light)",
            padding: "0.3rem 0.6rem",
            fontSize: "0.7rem",
            fontFamily: "'Jost', sans-serif",
            cursor: "pointer",
            borderRadius: 0,
            letterSpacing: "0.05em",
          }}
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          title="Delete submission"
          style={{
            background: "transparent",
            border: "0.5px solid var(--border-strong)",
            color: "var(--charcoal-light)",
            padding: "0.3rem 0.55rem",
            fontSize: "0.7rem",
            fontFamily: "'Jost', sans-serif",
            cursor: "pointer",
            borderRadius: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function BacklinkChip({ row }: { row: SerialPressSubmission }) {
  if (row.status !== "PUBLISHED" || !row.publishedUrl) {
    return (
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
        —
      </span>
    );
  }
  if (row.linkAlive === null) {
    return (
      <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
        not checked
      </span>
    );
  }
  if (row.linkAlive) {
    return (
      <span
        style={{
          fontSize: "0.7rem",
          color: "var(--olive)",
          letterSpacing: "0.05em",
          fontWeight: 500,
        }}
        title={
          row.linkLastHttpStatus
            ? `HTTP ${row.linkLastHttpStatus}`
            : "Alive"
        }
      >
        ✓ alive
      </span>
    );
  }
  const failures = row.consecutiveLinkFailures ?? 0;
  return (
    <span
      style={{
        fontSize: "0.7rem",
        color: "#b03232",
        letterSpacing: "0.05em",
        fontWeight: 500,
      }}
      title={
        row.linkLastHttpStatus
          ? `HTTP ${row.linkLastHttpStatus} (${failures}× consecutive)`
          : `${failures}× consecutive failures`
      }
    >
      ✗ dead{failures > 1 ? ` (${failures}×)` : ""}
    </span>
  );
}

// ─── Press modal + form ──────────────────────────────────────────────────────

interface PressFormValues {
  publicationName: string;
  publicationUrl: string;
  contactName: string;
  contactEmail: string;
  /** ISO yyyy-mm-dd. */
  submittedAt: string;
  status: PressStatusLiteral;
  publishedUrl: string;
  /** ISO yyyy-mm-dd. */
  publishedAt: string;
  notes: string;
}

function isoToDateInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // YYYY-MM-DD in local time.
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function PressModal({
  initial,
  disabled,
  onClose,
  onSubmit,
}: {
  initial: SerialPressSubmission | null;
  disabled: boolean;
  onClose: () => void;
  onSubmit: (values: PressFormValues) => void;
}) {
  const [values, setValues] = useState<PressFormValues>({
    publicationName: initial?.publicationName ?? "",
    publicationUrl: initial?.publicationUrl ?? "",
    contactName: initial?.contactName ?? "",
    contactEmail: initial?.contactEmail ?? "",
    submittedAt: isoToDateInput(initial?.submittedAt ?? null),
    status:
      (PRESS_STATUSES as readonly string[]).includes(initial?.status ?? "")
        ? (initial!.status as PressStatusLiteral)
        : "SUBMITTED",
    publishedUrl: initial?.publishedUrl ?? "",
    publishedAt: isoToDateInput(initial?.publishedAt ?? null),
    notes: initial?.notes ?? "",
  });

  const update = <K extends keyof PressFormValues>(
    key: K,
    value: PressFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.publicationName.trim()) {
      toast("Publication name is required");
      return;
    }
    onSubmit(values);
  };

  const inputStyle: React.CSSProperties = {
    padding: "0.5rem 0.7rem",
    border: "0.5px solid var(--border-strong)",
    fontFamily: "'Jost', sans-serif",
    fontSize: "0.85rem",
    background: "var(--white)",
    color: "var(--charcoal)",
    borderRadius: 0,
    width: "100%",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    ...EYEBROW,
    fontSize: "0.6rem",
    marginBottom: "0.35rem",
    display: "block",
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit press submission" : "Log press submission"}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          padding: "1.75rem",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>
          {initial ? "Edit submission" : "Log submission"}
        </p>
        <h3 style={{ ...SECTION_HEAD, fontSize: "1.4rem", margin: "0 0 1.25rem 0" }}>
          {initial ? initial.publicationName : "New press submission"}
        </h3>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <div>
            <label style={labelStyle}>Publication name *</label>
            <input
              type="text"
              required
              value={values.publicationName}
              onChange={(e) => update("publicationName", e.target.value)}
              placeholder="e.g. Carolina Bride"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Publication homepage</label>
            <input
              type="url"
              value={values.publicationUrl}
              onChange={(e) => update("publicationUrl", e.target.value)}
              placeholder="https://carolinabride.com"
              style={inputStyle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={labelStyle}>Contact name</label>
              <input
                type="text"
                value={values.contactName}
                onChange={(e) => update("contactName", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Contact email</label>
              <input
                type="email"
                value={values.contactEmail}
                onChange={(e) => update("contactEmail", e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <div>
              <label style={labelStyle}>Submitted on</label>
              <input
                type="date"
                value={values.submittedAt}
                onChange={(e) => update("submittedAt", e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={values.status}
                onChange={(e) =>
                  update("status", e.target.value as PressStatusLiteral)
                }
                style={inputStyle}
              >
                {PRESS_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {values.status === "PUBLISHED" && (
            <>
              <div>
                <label style={labelStyle}>Article URL *</label>
                <input
                  type="url"
                  value={values.publishedUrl}
                  onChange={(e) => update("publishedUrl", e.target.value)}
                  placeholder="https://carolinabride.com/real-weddings/…"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Published on</label>
                <input
                  type="date"
                  value={values.publishedAt}
                  onChange={(e) => update("publishedAt", e.target.value)}
                  style={inputStyle}
                />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={values.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "'Jost', sans-serif" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.5rem",
            marginTop: "1.25rem",
          }}
        >
          <button type="button" style={BTN_GHOST} onClick={onClose} disabled={disabled}>
            Cancel
          </button>
          <button type="submit" style={BTN_PRIMARY} disabled={disabled}>
            {disabled ? "Saving…" : initial ? "Save changes" : "Log submission"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Notes tab ────────────────────────────────────────────────────────────────

type NotesMode = "visible" | "off";

function NotesTab({
  projectId,
  initialNotes,
  initialOffTheRecordNotes,
}: {
  projectId: string;
  initialNotes: string;
  initialOffTheRecordNotes: string;
}) {
  const [mode, setMode] = useState<NotesMode>("visible");

  const [notes, setNotes] = useState(initialNotes ?? "");
  const [offNotes, setOffNotes] = useState(initialOffTheRecordNotes ?? "");

  // Per-mode save status so flipping the toggle while one is saving doesn't
  // smear the indicator across both panes.
  const [visibleStatus, setVisibleStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [offStatus, setOffStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedVisibleRef = useRef<string>(initialNotes ?? "");
  const lastSavedOffRef = useRef<string>(initialOffTheRecordNotes ?? "");

  // Autosave for the public "Visible" notes (writes `notes`).
  useEffect(() => {
    if (notes === lastSavedVisibleRef.current) return;
    if (visibleTimerRef.current) clearTimeout(visibleTimerRef.current);
    setVisibleStatus("saving");
    visibleTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateProjectDetails(projectId, { notes });
        if (res.success) {
          lastSavedVisibleRef.current = notes;
          setVisibleStatus("saved");
        } else {
          setVisibleStatus("error");
        }
      } catch {
        setVisibleStatus("error");
      }
    }, 800);
    return () => {
      if (visibleTimerRef.current) clearTimeout(visibleTimerRef.current);
    };
  }, [notes, projectId]);

  // Autosave for the admin-only "Off the record" notes
  // (writes `offTheRecordNotes`). Empty string clears the field.
  useEffect(() => {
    if (offNotes === lastSavedOffRef.current) return;
    if (offTimerRef.current) clearTimeout(offTimerRef.current);
    setOffStatus("saving");
    offTimerRef.current = setTimeout(async () => {
      try {
        const res = await updateProjectDetails(projectId, {
          offTheRecordNotes: offNotes,
        });
        if (res.success) {
          lastSavedOffRef.current = offNotes;
          setOffStatus("saved");
        } else {
          setOffStatus("error");
        }
      } catch {
        setOffStatus("error");
      }
    }, 800);
    return () => {
      if (offTimerRef.current) clearTimeout(offTimerRef.current);
    };
  }, [offNotes, projectId]);

  const currentStatus = mode === "visible" ? visibleStatus : offStatus;

  const segBase: React.CSSProperties = {
    padding: "0.35rem 0.85rem",
    fontSize: "0.7rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    fontFamily: "'Jost', sans-serif",
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: "var(--charcoal-muted)",
    transition: "var(--transition)",
  };
  const segActive: React.CSSProperties = {
    ...segBase,
    background: "var(--olive)",
    color: "var(--white)",
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Notes</h2>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--charcoal-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {currentStatus === "saving" && "Saving…"}
            {currentStatus === "saved" && "Saved"}
            {currentStatus === "error" && "Save failed"}
          </span>

          {/* 2-segment pill toggle */}
          <div
            role="tablist"
            aria-label="Notes visibility mode"
            style={{
              display: "inline-flex",
              border: "0.5px solid var(--border-strong)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "visible"}
              onClick={() => setMode("visible")}
              style={mode === "visible" ? segActive : segBase}
            >
              Visible
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "off"}
              onClick={() => setMode("off")}
              style={mode === "off" ? segActive : segBase}
            >
              Off the record
            </button>
          </div>
        </div>
      </div>

      {mode === "visible" ? (
        <>
          <p
            style={{
              ...EYEBROW,
              margin: "0 0 0.65rem 0",
              color: "var(--charcoal-muted)",
            }}
          >
            Visible · Used in exports & AI context
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Internal notes (markdown supported). Autosaves after 800ms of inactivity."
            rows={18}
            style={{
              width: "100%",
              padding: "1rem",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              resize: "vertical",
              borderRadius: 0,
              background: "var(--white)",
              color: "var(--charcoal)",
            }}
          />
        </>
      ) : (
        <>
          <p
            style={{
              ...EYEBROW,
              margin: "0 0 0.65rem 0",
              color: "#8B2E2E",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {/* Lock-icon glyph */}
            <span aria-hidden style={{ fontSize: "0.85rem", lineHeight: 1 }}>
              {"\u{1F512}"}
            </span>
            <span>Off the record · Never shared · Never exported</span>
          </p>
          <textarea
            value={offNotes}
            onChange={(e) => setOffNotes(e.target.value)}
            placeholder="Private notes only you can see. Not sent to the client, the portal, the welcome packet, the shoot brief, the journal, or any AI prompt."
            rows={18}
            aria-label="Off the record notes"
            style={{
              width: "100%",
              padding: "1rem",
              border: "0.5px solid var(--border-strong)",
              borderLeft: "4px solid #8B2E2E",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.9rem",
              lineHeight: 1.6,
              resize: "vertical",
              borderRadius: 0,
              background: "#FAF6F3",
              color: "var(--charcoal)",
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Status modal ─────────────────────────────────────────────────────────────

function StatusModal({
  currentStatus,
  onPick,
  onClose,
}: {
  currentStatus: string;
  onPick: (s: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Advance project status"
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          padding: "1.75rem",
          maxWidth: "480px",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Advance Status</p>
        <h3 style={{ ...SECTION_HEAD, fontSize: "1.4rem", margin: "0 0 1rem 0" }}>
          Move project to…
        </h3>
        <p style={{ fontSize: "0.8rem", color: "var(--charcoal-muted)", marginBottom: "1.25rem" }}>
          Current: <strong style={{ color: "var(--charcoal)" }}>{statusLabel(currentStatus)}</strong>. Pick a new status.
          Side effects (auto-invoices, event creation, referral tasks) run via the lifecycle hook.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "1.25rem" }}>
          {ALL_STATUSES.filter((s) => s !== currentStatus).map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              style={{
                ...BTN_GHOST,
                textAlign: "left",
                padding: "0.7rem 0.85rem",
              }}
            >
              {statusLabel(s)}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={BTN_GHOST}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
