"use client";

// app/login/LoginForm.tsx
// Calls NextAuth's signIn("resend", { email }) which triggers the magic-link
// email via Resend. NextAuth handles the redirect to ?verify=1 automatically.

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);

    startTransition(async () => {
      // NextAuth will call our custom sendVerificationRequest in lib/auth.ts,
      // then redirect to /login?verify=1 (configured in the pages config).
      await signIn("resend", {
        email,
        callbackUrl: "/gallery",
        redirect: true,
      });
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ marginBottom: "1.6rem" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.68rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            marginBottom: "0.5rem",
          }}
        >
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          className="form-input"
          style={{
            width: "100%",
            border: "0.5px solid var(--border-strong)",
            background: "transparent",
            padding: "0.85rem 1rem",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.92rem",
            color: "var(--charcoal)",
            outline: "none",
            borderRadius: 0,
          }}
        />
      </div>

      {error && (
        <p style={{ color: "#B45309", fontSize: "0.82rem", marginBottom: "1rem" }}>
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
        {isPending ? "Sending…" : "Send Magic Link"}
      </button>
    </form>
  );
}