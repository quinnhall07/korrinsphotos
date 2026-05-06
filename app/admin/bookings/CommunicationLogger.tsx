"use client";

// app/admin/bookings/CommunicationLogger.tsx
// Log a phone call, in-person meeting, or manual email note to the
// inquiry's communication history timeline.

import { useState, useTransition } from "react";
import { logCommunication } from "./actions";
import { toast } from "@/components/ui/Toaster";
import type { CommunicationChannel } from "@/lib/booking-kanban";

interface CommunicationLoggerProps {
  inquiryId: string;
  onLogged?: () => void;
}

const CHANNELS: { id: CommunicationChannel; label: string; icon: string }[] = [
  { id: "PHONE",     label: "Phone",      icon: "📞" },
  { id: "EMAIL",     label: "Email",      icon: "✉️" },
  { id: "SMS",       label: "Text / SMS", icon: "💬" },
  { id: "IN_PERSON", label: "In Person",  icon: "🤝" },
];

export function CommunicationLogger({ inquiryId, onLogged }: CommunicationLoggerProps) {
  const [channel, setChannel]       = useState<CommunicationChannel>("PHONE");
  const [summary, setSummary]       = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) return;

    startTransition(async () => {
      const result = await logCommunication(inquiryId, { channel, summary });
      if (result.success) {
        toast("Communication logged ✓");
        setSummary("");
        onLogged?.();
      } else {
        toast(result.error ?? "Failed to log.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Channel picker */}
      <div style={{ display: "flex", gap: 0, marginBottom: "0.75rem", border: "0.5px solid var(--border-strong)", overflow: "hidden" }}>
        {CHANNELS.map((ch) => {
          const active = channel === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => setChannel(ch.id)}
              style={{
                flex: 1,
                padding: "0.55rem 0.25rem",
                fontSize: "0.65rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: active ? "var(--charcoal)" : "transparent",
                color: active ? "var(--white)" : "var(--charcoal-muted)",
                border: "none",
                borderRight: ch.id !== "IN_PERSON" ? "0.5px solid var(--border-strong)" : "none",
                fontFamily: "'Jost', sans-serif",
                transition: "all 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.2rem",
              }}
            >
              <span style={{ fontSize: "1rem" }}>{ch.icon}</span>
              {ch.label}
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <textarea
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder={`Describe the ${CHANNELS.find((c) => c.id === channel)?.label.toLowerCase()} conversation…`}
        required
        style={{
          width: "100%",
          border: "0.5px solid var(--border-strong)",
          background: "transparent",
          padding: "0.75rem 0.9rem",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.88rem",
          color: "var(--charcoal)",
          outline: "none",
          resize: "vertical",
          minHeight: "80px",
          lineHeight: 1.7,
          marginBottom: "0.75rem",
          display: "block",
        }}
      />

      <button
        type="submit"
        disabled={isPending || !summary.trim()}
        style={{
          padding: "0.65rem 1.5rem",
          fontSize: "0.68rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          background: isPending || !summary.trim() ? "var(--charcoal-muted)" : "var(--olive)",
          color: "var(--white)",
          border: "none",
          cursor: isPending || !summary.trim() ? "not-allowed" : "pointer",
          fontFamily: "'Jost', sans-serif",
          transition: "background 0.15s",
        }}
      >
        {isPending ? "Logging…" : "Log Interaction"}
      </button>
    </form>
  );
}
