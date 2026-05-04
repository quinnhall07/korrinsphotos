"use client";

// app/booking/BookingForm.tsx
// Client component wrapping the booking form.
// On submit, calls the submitBooking Server Action which writes to the DB.

import { useState, useTransition } from "react";
import { submitBooking } from "./actions";

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: "0.5px solid var(--border-strong)",
  background: "transparent",
  padding: "0.85rem 1rem",
  fontFamily: "'Jost', sans-serif",
  fontSize: "0.92rem",
  color: "var(--charcoal)",
  outline: "none",
  borderRadius: 0,
  appearance: "none" as const,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.68rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase" as const,
  color: "var(--charcoal-muted)",
  marginBottom: "0.5rem",
};

export function BookingForm() {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitBooking(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error ?? "Something went wrong. Please try again.");
      }
    });
  }

  if (success) {
    return (
      <div
        style={{
          padding: "1.5rem",
          background: "var(--olive-dim)",
          borderLeft: "2px solid var(--olive)",
          fontSize: "0.9rem",
          lineHeight: 1.7,
          color: "var(--charcoal-light)",
        }}
      >
        ✓ &nbsp; Your inquiry has been received. Korrin will be in touch within
        48 hours at the email address provided.
      </div>
    );
  }

  return (
    <form action={handleSubmit}>
      {/* Name row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.6rem",
        }}
      >
        <div>
          <label style={labelStyle}>First Name</label>
          <input
            name="firstName"
            className="form-input"
            type="text"
            placeholder="Jane"
            required
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Last Name</label>
          <input
            name="lastName"
            className="form-input"
            type="text"
            placeholder="Doe"
            required
            style={inputStyle}
          />
        </div>
      </div>

      {/* Email */}
      <div style={{ marginBottom: "1.6rem" }}>
        <label style={labelStyle}>Email Address</label>
        <input
          name="email"
          className="form-input"
          type="email"
          placeholder="jane@example.com"
          required
          style={inputStyle}
        />
      </div>

      {/* Session type + date */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1rem",
          marginBottom: "1.6rem",
        }}
      >
        <div>
          <label style={labelStyle}>Session Type</label>
          <select name="sessionType" required style={inputStyle}>
            <option value="">Select a type</option>
            <option>Wedding</option>
            <option>Portrait</option>
            <option>Editorial</option>
            <option>Family</option>
            <option>Engagement</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Preferred Date</label>
          <input
            name="preferredDate"
            className="form-input"
            type="date"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Message */}
      <div style={{ marginBottom: "1.6rem" }}>
        <label style={labelStyle}>Tell me about your vision</label>
        <textarea
          name="message"
          className="form-input"
          placeholder="Describe your ideal session, location ideas, mood, or anything you'd like me to know..."
          required
          style={{ ...inputStyle, resize: "vertical", minHeight: "120px", lineHeight: 1.7 }}
        />
      </div>

      {error && (
        <p
          style={{
            color: "#B45309",
            fontSize: "0.82rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          width: "100%",
          padding: "0.85rem 2.2rem",
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          background: isPending ? "var(--charcoal-muted)" : "var(--olive)",
          color: "var(--white)",
          border: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          fontFamily: "'Jost', sans-serif",
          transition: "background 0.25s",
        }}
      >
        {isPending ? "Sending…" : "Send Inquiry"}
      </button>
    </form>
  );
}