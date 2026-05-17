"use client";

// app/magnet/[slug]/MagnetGateForm.tsx
// Client Component that collects an email + firstName, calls `gateAction`,
// and triggers a hidden-anchor download on success.

import { useState, useRef, type FormEvent } from "react";
import { gateAction, type GateActionResult } from "./actions";

interface MagnetGateFormProps {
  slug: string;
  sessionTypeHint: string;
}

export function MagnetGateForm({ slug, sessionTypeHint }: MagnetGateFormProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<GateActionResult & { success: true } | null>(null);
  const anchorRef = useRef<HTMLAnchorElement | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await gateAction(slug, email.trim(), firstName.trim() || undefined);
      if (!res.success) {
        setError(res.error);
        setSubmitting(false);
        return;
      }
      setSuccess(res);
      // Trigger the hidden-anchor download. R2 GET URLs honour
      // `response-content-disposition`, but the simpler portable path is to
      // just open the URL — the browser will follow the Content-Disposition
      // if R2 sends one. Either way, the user sees a download begin.
      requestAnimationFrame(() => {
        anchorRef.current?.click();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div
        style={{
          padding: "2rem",
          border: "0.5px solid var(--olive)",
          background: "var(--olive-dim)",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.75rem",
          }}
        >
          Your download is on its way
        </p>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.65rem",
            fontWeight: 300,
            lineHeight: 1.3,
            color: "var(--charcoal)",
            marginBottom: "1rem",
          }}
        >
          Check your inbox — we&apos;ve also queued some gentle prep emails over the next two weeks.
        </p>
        <p
          style={{
            fontSize: "0.92rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.7,
          }}
        >
          If the download didn&apos;t start automatically,&nbsp;
          <a
            href={success.downloadUrl}
            style={{ color: "var(--olive)", textDecoration: "underline" }}
            download={success.fileName}
          >
            click here to grab the file
          </a>
          .
        </p>
        {/* Hidden anchor to trigger the file download. */}
        <a
          ref={anchorRef}
          href={success.downloadUrl}
          download={success.fileName}
          style={{ display: "none" }}
          aria-hidden="true"
        >
          Download
        </a>
      </div>
    );
  }

  // ── Form state ─────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gap: "1.25rem",
        padding: "2rem",
        border: "0.5px solid var(--border-strong)",
        background: "rgba(250,249,246,0.8)",
      }}
    >
      <div>
        <label
          htmlFor="lead-magnet-firstName"
          style={{
            display: "block",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.5rem",
          }}
        >
          First name
        </label>
        <input
          id="lead-magnet-firstName"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
          required
          style={{
            width: "100%",
            padding: "0.85rem 0",
            background: "transparent",
            border: "none",
            borderBottom: "0.5px solid var(--border-strong)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "1rem",
            color: "var(--charcoal)",
            outline: "none",
          }}
        />
      </div>

      <div>
        <label
          htmlFor="lead-magnet-email"
          style={{
            display: "block",
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Email
        </label>
        <input
          id="lead-magnet-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          style={{
            width: "100%",
            padding: "0.85rem 0",
            background: "transparent",
            border: "none",
            borderBottom: "0.5px solid var(--border-strong)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "1rem",
            color: "var(--charcoal)",
            outline: "none",
          }}
        />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.6rem",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.88rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.5,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          defaultChecked
          name="prepTips"
          style={{ marginTop: "0.25rem", accentColor: "var(--olive)" }}
        />
        <span>
          I&apos;d like prep tips for {sessionTypeHint}-style shoots.
        </span>
      </label>

      {error && (
        <p
          style={{
            fontSize: "0.85rem",
            color: "#991B1B",
            padding: "0.6rem 0.75rem",
            background: "#FEF2F2",
            border: "0.5px solid #FCA5A5",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "0.9rem 2rem",
          background: "var(--charcoal)",
          color: "var(--white)",
          border: "none",
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.75rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.55 : 1,
          transition: "opacity 0.2s",
        }}
      >
        {submitting ? "Preparing…" : "Send me the guide"}
      </button>

      <p
        style={{
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          lineHeight: 1.6,
        }}
      >
        I&apos;ll never share your email. Unsubscribe at any time.
      </p>
    </form>
  );
}
