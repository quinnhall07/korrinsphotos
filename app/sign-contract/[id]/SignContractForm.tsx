"use client";

// app/sign-contract/[id]/SignContractForm.tsx
// Client-side signature capture. Submits to the signContract Server Action.
// On success, swaps in an in-place "Signed" confirmation (no redirect).

import { useState, useTransition } from "react";
import { signContract } from "./actions";

type Props = {
  contractId: string;
  clientId: string;
};

export function SignContractForm({ contractId }: Props) {
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canSubmit = typedName.trim().length >= 2 && agreed && !isPending && !signedAt;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);

    startTransition(async () => {
      const result = await signContract(contractId, typedName.trim(), agreed);
      if (result.success) {
        setSignedAt(result.signedAt ?? new Date().toLocaleString());
      } else {
        setError(result.error ?? "Unable to sign contract. Please try again.");
      }
    });
  }

  // Post-sign in-place confirmation
  if (signedAt) {
    return (
      <div
        style={{
          borderLeft: "2px solid var(--olive)",
          padding: "1.5rem 1.75rem",
          background: "var(--olive-dim)",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.6rem",
          }}
        >
          Signed
        </p>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.6rem",
            fontWeight: 300,
            lineHeight: 1.2,
            marginBottom: "0.4rem",
          }}
        >
          {typedName}
        </p>
        <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
          Signed on {signedAt}
        </p>
        <p
          style={{
            marginTop: "1.25rem",
            fontSize: "0.88rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.7,
          }}
        >
          Thank you. Korrin has been notified and will follow up shortly with payment details.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Eyebrow */}
      <p
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--olive)",
          marginBottom: "0.75rem",
        }}
      >
        Electronic Signature
      </p>

      <label
        htmlFor="signature-name"
        style={{
          display: "block",
          fontSize: "0.78rem",
          color: "var(--charcoal-light)",
          marginBottom: "0.5rem",
          letterSpacing: "0.02em",
        }}
      >
        Type your full legal name
      </label>
      <input
        id="signature-name"
        type="text"
        className="form-input"
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        placeholder="Full name"
        autoComplete="name"
        spellCheck={false}
        disabled={isPending}
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.5rem",
          fontWeight: 300,
          padding: "0.9rem 1rem",
          marginBottom: "1.5rem",
        }}
      />

      <label
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          marginBottom: "2rem",
          cursor: "pointer",
          fontSize: "0.88rem",
          color: "var(--charcoal-light)",
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          disabled={isPending}
          style={{
            marginTop: "0.25rem",
            width: "14px",
            height: "14px",
            accentColor: "var(--olive)",
            flexShrink: 0,
          }}
        />
        <span>
          I agree this typed name constitutes my electronic signature, and that I have read and accept the terms of this contract.
        </span>
      </label>

      {error && (
        <div
          style={{
            padding: "0.85rem 1rem",
            background: "#FEF3C7",
            borderLeft: "2px solid #F59E0B",
            fontSize: "0.82rem",
            color: "#92400E",
            marginBottom: "1.5rem",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          display: "inline-block",
          padding: "0.95rem 2.6rem",
          fontSize: "0.72rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          background: canSubmit ? "var(--olive)" : "var(--charcoal-muted)",
          color: "var(--white)",
          border: "none",
          cursor: canSubmit ? "pointer" : "not-allowed",
          transition: "background 0.2s",
          fontFamily: "'Jost', sans-serif",
        }}
      >
        {isPending ? "Signing..." : "Sign Contract"}
      </button>
    </form>
  );
}
