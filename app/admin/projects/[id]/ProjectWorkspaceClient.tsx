"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "@/components/ui/Toaster";
import { updateProjectStatus, updateProjectDetails, archiveProject } from "../actions";
import { createDraftContract, sendContract } from "../contract-actions";
import { sendInvoice, markInvoicePaidManually } from "../invoice-actions";
import { sendProjectMessage } from "../message-actions";
import { sendQuestionnaireForProjectAction } from "@/app/admin/questionnaires/templates/actions";
// AI components — supplied by Agent 5 (AI features) in the same merge.
// Imported eagerly so the parent's npm build wires the dependency edge.
// TODO(agent-5): confirm export paths once Agent 5 lands.
import { AIDraftReplyButton } from "@/components/admin/AIDraftReplyButton";
import { ThreadSummary } from "@/components/admin/ThreadSummary";
import type {
  SerialProject,
  SerialClient,
  SerialMessage,
  SerialInvoice,
  SerialContract,
  SerialQuestionnaire,
  SerialReviewRequest,
} from "./page";

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
  | "timeline"
  | "files"
  | "notes";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "messages", label: "Messages" },
  { id: "contract", label: "Contract" },
  { id: "invoice", label: "Invoice" },
  { id: "gallery", label: "Gallery" },
  { id: "timeline", label: "Timeline" },
  { id: "files", label: "Files" },
  { id: "notes", label: "Notes" },
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
              nextBestAction={nextBestAction}
              questionnaires={questionnaires}
              reviewRequests={reviewRequests}
            />
          )}
          {tab === "messages" && (
            <MessagesTab projectId={project.id} messages={messages} />
          )}
          {tab === "contract" && (
            <ContractTab projectId={project.id} contract={contract} />
          )}
          {tab === "invoice" && <InvoiceTab invoices={invoices} />}
          {tab === "gallery" && <GalleryTab eventId={eventId} />}
          {tab === "timeline" && (
            <TimelineTab
              project={project}
              messages={messages}
              invoices={invoices}
              contract={contract}
            />
          )}
          {tab === "files" && <FilesTab projectId={project.id} />}
          {tab === "notes" && <NotesTab projectId={project.id} initialNotes={project.notes} />}
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
  nextBestAction,
  questionnaires,
  reviewRequests,
}: {
  project: SerialProject;
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

      <QuestionnaireBlock projectId={project.id} questionnaires={questionnaires} />

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

// ─── Messages tab ─────────────────────────────────────────────────────────────

function MessagesTab({ projectId, messages }: { projectId: string; messages: SerialMessage[] }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pickedTemplate, setPickedTemplate] = useState<string>("");
  const [sending, setSending] = useState(false);
  const router = useRouter();
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages.length]);

  const applyTemplate = (id: string) => {
    const tpl = TEMPLATES.find((t) => t.id === id);
    setPickedTemplate(id);
    if (tpl) {
      setSubject(tpl.subject);
      setBody(tpl.body);
    }
  };

  const handleSend = async () => {
    if (!body.trim()) {
      toast("Write a message first");
      return;
    }
    setSending(true);
    const res = await sendProjectMessage(projectId, body, subject || undefined);
    setSending(false);
    if (res.success) {
      toast("Message sent");
      setBody("");
      setSubject("");
      setPickedTemplate("");
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
            </article>
          ))
        )}
        <div ref={listEndRef} />
      </div>

      {/* Composer */}
      <div style={{ border: "0.5px solid var(--border-strong)", padding: "1rem", background: "var(--white)" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.6rem 0" }}>Reply</p>
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
            placeholder="Subject (optional)"
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
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a reply…"
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.6rem", gap: "0.5rem" }}>
          <AIDraftReplyButton
            projectId={projectId}
            onDraftReady={(draft) => setBody(draft)}
            disabled={sending}
          />
          <button onClick={handleSend} style={BTN_PRIMARY} disabled={sending || !body.trim()}>
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contract tab ─────────────────────────────────────────────────────────────

function ContractTab({ projectId, contract }: { projectId: string; contract: SerialContract | null }) {
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

// ─── Invoice tab ──────────────────────────────────────────────────────────────

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

// ─── Notes tab ────────────────────────────────────────────────────────────────

function NotesTab({ projectId, initialNotes }: { projectId: string; initialNotes: string }) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(initialNotes ?? "");

  useEffect(() => {
    if (notes === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    timerRef.current = setTimeout(async () => {
      try {
        const res = await updateProjectDetails(projectId, { notes });
        if (res.success) {
          lastSavedRef.current = notes;
          setStatus("saved");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }, 800);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notes, projectId]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "1.25rem" }}>
        <h2 style={{ ...SECTION_HEAD, margin: 0 }}>Notes</h2>
        <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && "Save failed"}
        </span>
      </div>
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
