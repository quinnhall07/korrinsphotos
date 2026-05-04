"use client";

// app/login/LoginForm.tsx
// Sends a Firebase magic link to the user's email.
// Firebase handles the email delivery automatically — no Resend needed.
//
// After submitting:
//   1. We save the email to localStorage (needed to complete sign-in on return)
//   2. Firebase sends the link
//   3. User clicks link → lands back on /login → AuthProvider completes sign-in

import { useState, useTransition } from "react";
import { sendSignInLinkToEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";

const ACTION_CODE_SETTINGS = {
  // This MUST match the authorized domain in Firebase Console
  // Firebase Console → Authentication → Settings → Authorized domains
  url:             `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  handleCodeInApp: true, // Required for email link sign-in
};

export function LoginForm() {
  const [email, setEmail]     = useState("");
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await sendSignInLinkToEmail(auth, email, ACTION_CODE_SETTINGS);
        // Store the email so we can use it when the user returns via the link
        window.localStorage.setItem("emailForSignIn", email);
        setSent(true);
      } catch (err: unknown) {
        console.error(err);
        setError("Something went wrong. Please try again.");
      }
    });
  }

  if (sent) {
    return (
      <div style={{ textAlign: "center", paddingTop: "1.5rem" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            background: "var(--olive-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.2rem",
            fontSize: "1.3rem",
            color: "var(--olive)",
          }}
        >
          ✓
        </div>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.5rem",
            fontWeight: 400,
            marginBottom: "0.5rem",
          }}
        >
          Check your inbox
        </h3>
        <p style={{ fontSize: "0.88rem", color: "var(--charcoal-muted)", lineHeight: 1.7 }}>
          A magic link has been sent to <strong>{email}</strong>.
          The link expires in 1 hour.
        </p>
      </div>
    );
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

      {/* Dev shortcut — remove before going live */}
      {process.env.NODE_ENV === "development" && (
        <div
          style={{
            borderTop: "0.5px solid var(--border)",
            marginTop: "2rem",
            paddingTop: "1.5rem",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)", marginBottom: "0.75rem" }}>
            Are you the photographer?
          </p>
          <a href="/admin" style={devLinkStyle}>Admin Access</a>
          &nbsp;
          <a href="/gallery" style={devLinkStyle}>Demo Client View</a>
        </div>
      )}
    </form>
  );
}

const devLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "0.6rem 1.4rem",
  fontSize: "0.68rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
};