"use client";

// app/admin/bookings/BookingDetailPanel.tsx
// Expandable detail panel for a single booking inquiry.
// Shows and allows editing of: notes, pricing, and a direct email response composer.

import { useState, useTransition } from "react";
import { updateBookingDetails, sendBookingResponse } from "./actions";
import { toast } from "@/components/ui/Toaster";

interface BookingDetailPanelProps {
  id: string;
  firstName: string;
  email: string;
  sessionType: string;
  message: string;
  notes: string;
  pricing: string;
  status: string;
  lastRespondedAt: string | null;
}

const DEFAULT_RESPONSE = (name: string, sessionType: string) =>
  `Hi ${name},\n\nThank you so much for reaching out about a ${sessionType.toLowerCase()} session — I would love to work with you!\n\nI've had a chance to review your inquiry and I'd like to learn more about your vision. Please let me know a few dates that work for you and we can find a time that works for both of us.\n\nLooking forward to connecting!\n\nKorrin`;

export function BookingDetailPanel({
  id,
  firstName,
  email,
  sessionType,
  message: clientMessage,
  notes: initialNotes,
  pricing: initialPricing,
  status,
  lastRespondedAt,
}: BookingDetailPanelProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [pricing, setPricing] = useState(initialPricing);
  const [responseSubject, setResponseSubject] = useState(`Re: Your ${sessionType} Inquiry`);
  const [responseMessage, setResponseMessage] = useState(DEFAULT_RESPONSE(firstName, sessionType));
  const [activeTab, setActiveTab] = useState<"details" | "respond" | "inquiry">("inquiry");
  const [isPending, startTransition] = useTransition();
  const [isSending, setIsSending] = useState(false);

  function handleSaveDetails() {
    startTransition(async () => {
      const result = await updateBookingDetails(id, { notes, pricing });
      if (result.success) {
        toast("Details saved ✓");
      } else {
        toast("Failed to save — please try again.");
      }
    });
  }

  async function handleSendResponse(e: React.FormEvent) {
    e.preventDefault();
    if (!responseMessage.trim()) return;
    setIsSending(true);
    try {
      const result = await sendBookingResponse(id, {
        to: email,
        name: firstName,
        subject: responseSubject,
        message: responseMessage,
      });
      if (result.success) {
        toast(`Response sent to ${email} ✓`);
      } else {
        toast(`Failed: ${result.error}`);
      }
    } finally {
      setIsSending(false);
    }
  }

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: "inquiry", label: "Client Message" },
    { id: "details", label: "Notes & Pricing" },
    { id: "respond", label: "Send Response" },
  ];

  return (
    <div
      style={{
        background: "rgba(107,120,69,0.03)",
        borderTop: "0.5px solid var(--border)",
        padding: "1.5rem 1rem",
      }}
    >
      {/* Inner tab bar */}
      <div style={{ display: "flex", gap: 0, marginBottom: "1.5rem", borderBottom: "0.5px solid var(--border)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "0.6rem 1.2rem",
              fontSize: "0.68rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              color: activeTab === tab.id ? "var(--charcoal)" : "var(--charcoal-muted)",
              borderBottom: activeTab === tab.id ? "1.5px solid var(--olive)" : "1.5px solid transparent",
              marginBottom: "-0.5px",
              background: "none",
              border: "none",
              borderBottomStyle: "solid",
              borderBottomWidth: "1.5px",
              borderBottomColor: activeTab === tab.id ? "var(--olive)" : "transparent",
              fontFamily: "'Jost', sans-serif",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}

        {lastRespondedAt && (
          <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--charcoal-muted)", alignSelf: "center", fontStyle: "italic" }}>
            Last replied {lastRespondedAt}
          </span>
        )}
      </div>

      {/* ── Client Message ── */}
      {activeTab === "inquiry" && (
        <div style={{ maxWidth: "680px" }}>
          <p style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal-muted)", marginBottom: "0.75rem" }}>
            Original message from {firstName}
          </p>
          <div
            style={{
              padding: "1.2rem 1.4rem",
              border: "0.5px solid var(--border)",
              background: "var(--white)",
              fontSize: "0.9rem",
              lineHeight: 1.8,
              color: "var(--charcoal-light)",
              whiteSpace: "pre-wrap",
            }}
          >
            {clientMessage}
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
            Email: <strong style={{ color: "var(--charcoal)" }}>{email}</strong>
          </p>
        </div>
      )}

      {/* ── Notes & Pricing ── */}
      {activeTab === "details" && (
        <div style={{ maxWidth: "680px" }}>
          <div style={{ marginBottom: "1.4rem" }}>
            <label style={labelStyle}>Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add private notes about this inquiry — visible only to you in the admin panel..."
              style={{
                ...inputStyle,
                resize: "vertical",
                minHeight: "120px",
                lineHeight: 1.7,
              }}
            />
          </div>

          <div style={{ marginBottom: "1.4rem" }}>
            <label style={labelStyle}>Quoted Pricing</label>
            <input
              type="text"
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              placeholder="e.g. $2,800 – $4,500 (8hr wedding coverage)"
              style={inputStyle}
            />
            <p style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
              For your reference — will appear on future invoice exports.
            </p>
          </div>

          <button
            onClick={handleSaveDetails}
            disabled={isPending}
            style={saveButtonStyle(isPending)}
          >
            {isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}

      {/* ── Send Response ── */}
      {activeTab === "respond" && (
        <form onSubmit={handleSendResponse} style={{ maxWidth: "680px" }}>
          <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)", lineHeight: 1.6, marginBottom: "1.4rem" }}>
            Sending to <strong style={{ color: "var(--charcoal)" }}>{email}</strong> via your Firebase email provider.
          </p>

          <div style={{ marginBottom: "1.2rem" }}>
            <label style={labelStyle}>Subject</label>
            <input
              type="text"
              value={responseSubject}
              onChange={(e) => setResponseSubject(e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ marginBottom: "1.4rem" }}>
            <label style={labelStyle}>Message</label>
            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="Write your response..."
              style={{ ...inputStyle, resize: "vertical", minHeight: "200px", lineHeight: 1.7 }}
              required
            />
            <p style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "var(--charcoal-muted)" }}>
              Line breaks are preserved. Your name and a link to the booking page are added automatically.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="submit"
              disabled={isSending}
              style={saveButtonStyle(isSending)}
            >
              {isSending ? "Sending…" : "Send Email"}
            </button>
            <button
              type="button"
              onClick={() => setResponseMessage(DEFAULT_RESPONSE(firstName, sessionType))}
              style={{
                padding: "0.72rem 1.4rem",
                fontSize: "0.68rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                border: "0.5px solid var(--border-strong)",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              Reset to Template
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.5rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "var(--white)",
  padding: "0.85rem 1rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.92rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
  transition: "border-color 0.2s",
};

const saveButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: "0.75rem 2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: disabled ? "var(--charcoal-muted)" : "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: disabled ? "not-allowed" : "pointer",
  fontFamily: "'Jost', sans-serif",
  transition: "background 0.2s",
});