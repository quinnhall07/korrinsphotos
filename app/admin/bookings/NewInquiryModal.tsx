"use client";

// app/admin/bookings/NewInquiryModal.tsx
// Modal form for creating a new booking inquiry manually.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBookingInquiry } from "./inquiry-actions";
import { toast } from "@/components/ui/Toaster";

interface NewInquiryModalProps {
  onClose: () => void;
}

const SESSION_TYPES = [
  "Wedding",
  "Engagement",
  "Portrait",
  "Family",
  "Editorial",
  "Commercial",
];

export function NewInquiryModal({ onClose }: NewInquiryModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sessionType, setSessionType] = useState("Wedding");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createBookingInquiry({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        sessionType,
      });
      if (result.success) {
        toast("Inquiry created ✓");
        router.refresh();
        onClose();
      } else {
        toast(result.error ?? "Failed to create inquiry.");
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(42,42,40,0.35)",
          zIndex: 500,
          backdropFilter: "blur(2px)",
          animation: "fadeIn 0.2s ease",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 501,
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          boxShadow: "0 24px 64px rgba(42,42,40,0.2)",
          width: "min(480px, 92vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          animation: "fadeIn 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1.25rem 1.5rem",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.3rem",
              fontWeight: 400,
              color: "var(--charcoal)",
            }}
          >
            New Booking Inquiry
          </h3>
          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              background: "none",
              border: "0.5px solid var(--border-strong)",
              color: "var(--charcoal)",
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <label style={labelStyle}>First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Sarah"
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                style={inputStyle}
                placeholder="e.g. Williams"
              />
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={labelStyle}>Email *</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="sarah@example.com"
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={labelStyle}>Session Type *</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              style={inputStyle}
            >
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.65rem 1.2rem",
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              style={{
                padding: "0.65rem 1.6rem",
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
              {isPending ? "Creating…" : "Create Inquiry"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.62rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  marginBottom: "0.4rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.7rem 0.9rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.85rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
  display: "block",
};
