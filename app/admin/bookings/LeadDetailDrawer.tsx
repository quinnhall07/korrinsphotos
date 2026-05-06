"use client";

// app/admin/bookings/LeadDetailDrawer.tsx
// Slide-over panel that opens when a Kanban card (or table row) is clicked.
//
// KEY FIX: The entire backdrop + drawer is rendered via ReactDOM.createPortal
// into document.body. This is required because the admin layout's content div
// has `overflowX: "auto"`, which creates a new containing block and breaks
// `position: fixed` — making it behave like `position: absolute` relative to
// that scrolling container instead of the viewport. Portalling to body escapes
// all ancestor overflow/transform/will-change stacking contexts entirely.

import { useState, useTransition, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  updateBookingStatus,
  updateBookingDetails,
  sendBookingResponse,
  updateLeadSource,
  setFollowUpDate,
  deleteBookingInquiry,
  linkEventToInquiry,
} from "./actions";
import { TagManager } from "./TagManager";
import { CommunicationLogger } from "./CommunicationLogger";
import { EmailTemplateSelector } from "./EmailTemplateSelector";
import { LeadScoreBadge } from "./LeadScoreBadge";
import { toast } from "@/components/ui/Toaster";
import {
  KANBAN_STATUSES,
  ALL_STATUSES,
  type LeadStatus,
  type LeadSource,
} from "@/lib/booking-kanban";
import type { KanbanInquiry } from "./KanbanCard";

interface LeadDetailDrawerProps {
  inquiry: KanbanInquiry | null;
  onClose: () => void;
}

type Tab = "overview" | "notes" | "comms" | "email";

const CHANNEL_ICONS: Record<string, string> = {
  EMAIL: "✉️",
  PHONE: "📞",
  SMS: "💬",
  IN_PERSON: "🤝",
};

const LEAD_SOURCES: LeadSource[] = [
  "WEBSITE",
  "INSTAGRAM",
  "REFERRAL",
  "GOOGLE",
  "OTHER",
];

const SESSION_NEXT: Record<string, LeadStatus> = {
  PENDING: "QUALIFIED",
  QUALIFIED: "SENT_PROPOSAL",
  SENT_PROPOSAL: "CONTRACT_SENT",
  CONTRACT_SENT: "BOOKED",
  BOOKED: "BOOKED",
  ARCHIVED: "PENDING",
};

// Navbar height and sidebar width — must match app/admin/layout.tsx
const NAVBAR_H = 72;
const SIDEBAR_W = 260;

export function LeadDetailDrawer({ inquiry, onClose }: LeadDetailDrawerProps) {
  const router = useRouter();
  const needsRefresh = { current: false };

  // SSR guard: createPortal requires document to exist
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const handleClose = useCallback(() => {
    if (needsRefresh.current) router.refresh();
    onClose();
  }, [onClose, router]);

  const [tab, setTab] = useState<Tab>("overview");
  const [isPending, startTransition] = useTransition();

  const [liveStatus, setLiveStatus] = useState<LeadStatus>(
    (inquiry?.status as LeadStatus) ?? "PENDING"
  );
  const [liveEventId, setLiveEventId] = useState<string | null>(
    inquiry?.eventId ?? null
  );
  const [liveEventName, setLiveEventName] = useState<string | null>(
    inquiry?.eventName ?? null
  );

  const [notes, setNotes] = useState(inquiry?.notes ?? "");
  const [pricing, setPricing] = useState(inquiry?.pricing ?? "");
  const [estimatedValue, setEstimated] = useState<string>(
    inquiry?.estimatedValue ? String(inquiry.estimatedValue) : ""
  );
  const [followUp, setFollowUp] = useState(inquiry?.followUpDate ?? "");

  const [emailSubject, setEmailSubject] = useState(
    `Re: Your ${inquiry?.sessionType ?? ""} Inquiry`
  );
  const [emailBody, setEmailBody] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  useEffect(() => {
    if (!inquiry) return;
    setLiveStatus(inquiry.status as LeadStatus);
    setLiveEventId(inquiry.eventId ?? null);
    setLiveEventName(inquiry.eventName ?? null);
    setNotes(inquiry.notes ?? "");
    setPricing(inquiry.pricing ?? "");
    setEstimated(inquiry.estimatedValue ? String(inquiry.estimatedValue) : "");
    setFollowUp(inquiry.followUpDate ?? "");
    setEmailSubject(`Re: Your ${inquiry.sessionType} Inquiry`);
    setEmailBody("");
    setTab("overview");
  }, [inquiry?.id]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleClose]);

  if (!inquiry || !mounted) return null;

  const nextStatus = SESSION_NEXT[liveStatus];
  const nextLabel = KANBAN_STATUSES.find((s) => s.id === nextStatus)?.label;
  const statusStyle =
    KANBAN_STATUSES.find((s) => s.id === liveStatus)?.badgeStyle ?? {};

  function handleStatusChange(status: LeadStatus) {
    startTransition(async () => {
      await updateBookingStatus(inquiry!.id, status);
      setLiveStatus(status);
      toast(
        `Moved to ${KANBAN_STATUSES.find((s) => s.id === status)?.label ?? status}`
      );
      needsRefresh.current = true;
    });
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updateBookingDetails(inquiry!.id, {
        notes,
        pricing,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      });
      if (result.success) {
        toast("Notes saved ✓");
        needsRefresh.current = true;
      } else {
        toast(result.error ?? "Save failed.");
      }
    });
  }

  function handleSaveFollowUp() {
    startTransition(async () => {
      const result = await setFollowUpDate(inquiry!.id, followUp || null);
      if (result.success) {
        toast("Follow-up date set ✓");
        needsRefresh.current = true;
      } else {
        toast(result.error ?? "Failed.");
      }
    });
  }

  function handleSourceChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const source = e.target.value as LeadSource;
    startTransition(async () => {
      await updateLeadSource(inquiry!.id, source);
      needsRefresh.current = true;
    });
  }

  function handleDelete() {
    if (!confirm("Permanently delete this inquiry? This cannot be undone."))
      return;
    startTransition(async () => {
      const result = await deleteBookingInquiry(inquiry!.id);
      if (result.success) {
        toast("Inquiry deleted");
        router.refresh();
        onClose();
      } else {
        toast(result.error ?? "Delete failed.");
      }
    });
  }

  function handleLinkEvent(e: React.ChangeEvent<HTMLSelectElement>) {
    const selectedEventId = e.target.value || null;
    const selectedOption = e.target.selectedOptions[0]?.text ?? null;
    const selectedEventName =
      selectedEventId && selectedOption !== "— No event —"
        ? selectedOption
        : null;

    setLiveEventId(selectedEventId);
    setLiveEventName(selectedEventName);

    startTransition(async () => {
      const result = await linkEventToInquiry(inquiry!.id, selectedEventId);
      if (result.success) {
        toast(selectedEventId ? "Event linked ✓" : "Event unlinked");
        needsRefresh.current = true;
      } else {
        setLiveEventId(inquiry!.eventId ?? null);
        setLiveEventName(inquiry!.eventName ?? null);
        toast(result.error ?? "Failed.");
      }
    });
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setIsSendingEmail(true);
    try {
      const result = await sendBookingResponse(inquiry!.id, {
        to: inquiry!.email,
        name: inquiry!.firstName,
        subject: emailSubject,
        message: emailBody,
      });
      if (result.success) {
        toast(`Email sent to ${inquiry!.email} ✓`);
        setEmailBody("");
        needsRefresh.current = true;
      } else {
        toast(result.error ?? "Send failed.");
      }
    } finally {
      setIsSendingEmail(false);
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "notes", label: "Notes & CRM" },
    {
      id: "comms",
      label: `Comms${inquiry.communicationLog.length > 0
          ? ` (${inquiry.communicationLog.length})`
          : ""
        }`,
    },
    { id: "email", label: "Send Email" },
  ];

  // ─── The actual drawer JSX ─────────────────────────────────────────────────
  // Portalled to document.body so position:fixed uses the true viewport,
  // unaffected by any ancestor overflow, transform, or will-change property.

  const drawerContent = (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @keyframes drawerFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      {/* Backdrop — covers only the content area: right of sidebar, below navbar */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed",
          top: NAVBAR_H,
          left: SIDEBAR_W,
          right: 0,
          bottom: 0,
          background: "rgba(42,42,40,0.35)",
          zIndex: 400,
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          animation: "drawerFadeIn 0.2s ease",
        }}
      />

      {/* Drawer panel — hugs right edge, starts below navbar, fills to bottom */}
      <div
        style={{
          position: "fixed",
          top: NAVBAR_H,
          right: 0,
          bottom: 0,
          width: "min(560px, calc(100vw - 260px))",
          zIndex: 401,
          background: "var(--white)",
          boxShadow: "-16px 0 48px rgba(42,42,40,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "slideInRight 0.28s cubic-bezier(0.25,0.46,0.45,0.94)",
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "1.5rem 1.5rem 1rem",
            borderBottom: "0.5px solid var(--border)",
            background: "rgba(250,249,246,0.96)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  padding: "0.2rem 0.65rem",
                  fontSize: "0.6rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 500,
                  ...statusStyle,
                }}
              >
                {liveStatus.replace("_", " ")}
              </span>
              <LeadScoreBadge score={inquiry.leadScore} showLabel />
            </div>

            <h2
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.6rem",
                fontWeight: 300,
                lineHeight: 1.2,
                color: "var(--charcoal)",
                marginBottom: "0.2rem",
              }}
            >
              {inquiry.firstName} {inquiry.lastName}
            </h2>
            <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
              {inquiry.email}
            </p>
          </div>

          <button
            onClick={handleClose}
            style={{
              width: "36px",
              height: "36px",
              background: "none",
              border: "0.5px solid var(--border-strong)",
              color: "var(--charcoal)",
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: "1rem",
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Quick action bar ── */}
        <div
          style={{
            display: "flex",
            padding: "0.75rem 1.5rem",
            borderBottom: "0.5px solid var(--border)",
            flexWrap: "wrap",
            gap: "0.5rem",
            flexShrink: 0,
          }}
        >
          {liveStatus !== "BOOKED" && liveStatus !== "ARCHIVED" && (
            <button
              onClick={() => handleStatusChange(nextStatus)}
              disabled={isPending}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "var(--olive)",
                color: "var(--white)",
                border: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                fontFamily: "'Jost', sans-serif",
                transition: "background 0.15s",
              }}
            >
              {isPending ? "…" : `Move → ${nextLabel}`}
            </button>
          )}

          <select
            value={liveStatus}
            onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            disabled={isPending}
            style={{
              padding: "0.5rem 0.8rem",
              fontSize: "0.65rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              background: "transparent",
              color: "var(--charcoal)",
              border: "0.5px solid var(--border-strong)",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
              outline: "none",
            }}
          >
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>

          {liveStatus !== "ARCHIVED" && (
            <button
              onClick={() => {
                if (confirm("Archive this inquiry?"))
                  handleStatusChange("ARCHIVED");
              }}
              style={{
                padding: "0.5rem 0.9rem",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                background: "transparent",
                color: "var(--charcoal-muted)",
                border: "0.5px solid var(--border-strong)",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              Archive
            </button>
          )}

          <button
            onClick={handleDelete}
            disabled={isPending}
            style={{
              padding: "0.5rem 0.9rem",
              fontSize: "0.65rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: "transparent",
              color: "#991B1B",
              border: "0.5px solid #FCA5A5",
              cursor: isPending ? "not-allowed" : "pointer",
              fontFamily: "'Jost', sans-serif",
              marginLeft: "auto",
            }}
          >
            Delete
          </button>
        </div>

        {/* ── Tabs ── */}
        <div
          style={{
            display: "flex",
            borderBottom: "0.5px solid var(--border)",
            flexShrink: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "0.7rem 1.1rem",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                cursor: "pointer",
                color:
                  tab === t.id ? "var(--charcoal)" : "var(--charcoal-muted)",
                background: "none",
                border: "none",
                borderBottomStyle: "solid",
                borderBottomWidth: "1.5px",
                borderBottomColor:
                  tab === t.id ? "var(--olive)" : "transparent",
                marginBottom: "-0.5px",
                fontFamily: "'Jost', sans-serif",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1.5rem" }}>

          {/* OVERVIEW */}
          {tab === "overview" && (
            <div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                  marginBottom: "1.25rem",
                }}
              >
                {[
                  { label: "Session Type", value: inquiry.sessionType },
                  { label: "Preferred Date", value: inquiry.preferredDate ?? "—" },
                  { label: "Received", value: inquiry.createdAt },
                  { label: "Lead Source", value: inquiry.leadSource ?? "—" },
                  ...(inquiry.estimatedValue
                    ? [{ label: "Est. Value", value: `$${inquiry.estimatedValue.toLocaleString()}` }]
                    : []),
                  ...(inquiry.pricing
                    ? [{ label: "Quoted Pricing", value: inquiry.pricing }]
                    : []),
                  ...(inquiry.followUpDate
                    ? [{ label: "Follow-Up", value: new Date(inquiry.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }]
                    : []),
                  ...(inquiry.lastRespondedAt
                    ? [{ label: "Last Responded", value: inquiry.lastRespondedAt }]
                    : []),
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p style={{ fontSize: "0.6rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.2rem" }}>
                      {label}
                    </p>
                    <p style={{ fontSize: "0.85rem", color: "var(--charcoal)", fontFamily: "'Jost', sans-serif" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <LeadScoreBadge score={inquiry.leadScore} size="md" showLabel />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Tags</p>
                <TagManager inquiryId={inquiry.id} currentTags={inquiry.tags} />
              </div>

              <div>
                <p style={sectionLabelStyle}>Client Message</p>
                <div
                  style={{
                    padding: "1rem",
                    border: "0.5px solid var(--border)",
                    background: "rgba(42,42,40,0.02)",
                    fontSize: "0.88rem",
                    lineHeight: 1.8,
                    color: "var(--charcoal-light)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {inquiry.message}
                </div>
              </div>
            </div>
          )}

          {/* NOTES & CRM */}
          {tab === "notes" && (
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Lead Source</p>
                <select value={inquiry.leadSource ?? ""} onChange={handleSourceChange} style={inputStyle}>
                  <option value="">Unknown</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Estimated Value (USD)</p>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={estimatedValue}
                  onChange={(e) => setEstimated(e.target.value)}
                  placeholder="e.g. 3500"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Quoted Pricing</p>
                <input
                  type="text"
                  value={pricing}
                  onChange={(e) => setPricing(e.target.value)}
                  placeholder="e.g. $2,800 – $4,500 (8hr wedding)"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Follow-Up Date</p>
                <div style={{ display: "flex", gap: 0 }}>
                  <input
                    type="date"
                    value={followUp ?? ""}
                    onChange={(e) => setFollowUp(e.target.value)}
                    style={{ ...inputStyle, borderRight: "none", flex: 1 }}
                  />
                  <button onClick={handleSaveFollowUp} disabled={isPending} style={inlineButtonStyle}>
                    Set
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: "1.25rem" }}>
                <p style={sectionLabelStyle}>Internal Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Private notes — visible only in admin…"
                  style={{ ...inputStyle, resize: "vertical", minHeight: "120px", lineHeight: 1.7 }}
                />
              </div>

              <button
                onClick={handleSaveNotes}
                disabled={isPending}
                style={{
                  padding: "0.72rem 1.8rem",
                  fontSize: "0.68rem",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  background: isPending ? "var(--charcoal-muted)" : "var(--olive)",
                  color: "var(--white)",
                  border: "none",
                  cursor: isPending ? "not-allowed" : "pointer",
                  fontFamily: "'Jost', sans-serif",
                  transition: "background 0.15s",
                }}
              >
                {isPending ? "Saving…" : "Save Changes"}
              </button>

              <div style={{ marginTop: "1.5rem" }}>
                <p style={sectionLabelStyle}>Link to Event</p>
                <EventLinkSelect currentEventId={liveEventId} onChange={handleLinkEvent} />
                {liveEventId && liveEventName && (
                  <a
                    href={`/admin/events/${liveEventId}`}
                    style={{ display: "inline-block", marginTop: "0.5rem", fontSize: "0.78rem", color: "var(--olive)", textDecoration: "underline" }}
                  >
                    View: {liveEventName}
                  </a>
                )}
              </div>
            </div>
          )}

          {/* COMMUNICATION LOG */}
          {tab === "comms" && (
            <div>
              <div style={{ marginBottom: "1.75rem" }}>
                <p style={sectionLabelStyle}>Log an Interaction</p>
                <CommunicationLogger inquiryId={inquiry.id} onLogged={() => { needsRefresh.current = true; }} />
              </div>

              {inquiry.communicationLog.length > 0 ? (
                <div>
                  <p style={sectionLabelStyle}>History ({inquiry.communicationLog.length})</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {[...inquiry.communicationLog]
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                      .map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: "0.9rem 1rem",
                            border: "0.5px solid var(--border)",
                            background: "var(--white)",
                            borderLeft: "2px solid var(--olive)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                            <span style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--charcoal-muted)", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                              {CHANNEL_ICONS[entry.channel] ?? "📌"}
                              <span style={{ textTransform: "uppercase" }}>{entry.channel.replace("_", " ")}</span>
                            </span>
                            <span style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)" }}>
                              {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <p style={{ fontSize: "0.85rem", color: "var(--charcoal-light)", lineHeight: 1.7 }}>
                            {entry.summary}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)", fontStyle: "italic" }}>
                  No interactions logged yet.
                </p>
              )}
            </div>
          )}

          {/* EMAIL */}
          {tab === "email" && (
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <EmailTemplateSelector
                  firstName={inquiry.firstName}
                  sessionType={inquiry.sessionType}
                  onSelect={(subj, body) => {
                    setEmailSubject(subj);
                    setEmailBody(body);
                  }}
                />
              </div>

              <form onSubmit={handleSendEmail}>
                <p style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", marginBottom: "1rem", lineHeight: 1.6 }}>
                  Sending to{" "}
                  <strong style={{ color: "var(--charcoal)" }}>{inquiry.email}</strong>
                </p>

                <div style={{ marginBottom: "1rem" }}>
                  <p style={sectionLabelStyle}>Subject</p>
                  <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} required style={inputStyle} />
                </div>

                <div style={{ marginBottom: "1.25rem" }}>
                  <p style={sectionLabelStyle}>Message</p>
                  <textarea
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    placeholder="Write your response…"
                    required
                    style={{ ...inputStyle, resize: "vertical", minHeight: "220px", lineHeight: 1.75 }}
                  />
                  <p style={{ marginTop: "0.35rem", fontSize: "0.68rem", color: "var(--charcoal-muted)" }}>
                    Line breaks preserved. Sending moves the lead to Qualified automatically.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.6rem" }}>
                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    style={{
                      padding: "0.72rem 1.8rem",
                      fontSize: "0.68rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      background: isSendingEmail ? "var(--charcoal-muted)" : "var(--olive)",
                      color: "var(--white)",
                      border: "none",
                      cursor: isSendingEmail ? "not-allowed" : "pointer",
                      fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    {isSendingEmail ? "Sending…" : "Send Email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailBody("")}
                    style={{
                      padding: "0.72rem 1.1rem",
                      fontSize: "0.68rem",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      background: "transparent",
                      color: "var(--charcoal-muted)",
                      border: "0.5px solid var(--border-strong)",
                      cursor: "pointer",
                      fontFamily: "'Jost', sans-serif",
                    }}
                  >
                    Clear
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );

  // Portal to body — escapes all ancestor overflow/transform stacking contexts
  return createPortal(drawerContent, document.body);
}

// ── Shared style constants ─────────────────────────────────────────────────────

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.5rem",
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.75rem 0.9rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.88rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
  display: "block",
  marginBottom: 0,
};

const inlineButtonStyle: React.CSSProperties = {
  padding: "0 1rem",
  fontSize: "0.65rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  background: "var(--charcoal)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  flexShrink: 0,
};

// ── EventLinkSelect ───────────────────────────────────────────────────────────

function EventLinkSelect({
  currentEventId,
  onChange,
}: {
  currentEventId: string | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events-list")
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <select value={currentEventId ?? ""} onChange={onChange} disabled={loading} style={inputStyle}>
      <option value="">— No event —</option>
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>{ev.title}</option>
      ))}
    </select>
  );
}