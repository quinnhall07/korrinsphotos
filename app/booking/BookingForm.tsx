"use client";

// app/booking/BookingForm.tsx
// Client component wrapping the booking form.
// On submit, calls the submitBooking Server Action which writes to the DB.
// Uses controlled inputs so field values are preserved when a server-side
// validation error is returned.

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

  // Controlled field state — values are preserved across submit attempts
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [sessionType, setSessionType] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("firstName", firstName);
    formData.set("lastName", lastName);
    formData.set("email", email);
    formData.set("sessionType", sessionType);
    formData.set("preferredDate", preferredDate);
    formData.set("message", message);

    startTransition(async () => {
      const result = await submitBooking(formData);
      if (result.success) {
        setSuccess(true);
      } else {
        // Error is shown inline; all field values are preserved via state
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
    <form onSubmit={handleSubmit}>
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
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
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
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
          <select
            name="sessionType"
            required
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value)}
            style={inputStyle}
          >
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
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
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
          value={message}
          onChange={(e) => setMessage(e.target.value)}
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