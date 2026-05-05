"use client";

// app/login/LoginForm.tsx
// Multi-provider Firebase Auth login:
//   • Google, Microsoft OAuth (popup)
//   • Email + Password (normal sign-in)
//   • Forgot Password (sends a reset email via Firebase)
//
// Note: the magic-link *invite* flow is intentionally separate.
// When an admin invites a client, Firebase sends a sign-in link whose
// continueUrl points to /login/complete. That page completes sign-in
// automatically — no need for magic links on this form.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  type AuthProvider,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth }      from "@/components/AuthProvider";

const googleProvider    = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.addScope("email");
microsoftProvider.addScope("profile");
microsoftProvider.setCustomParameters({ prompt: "select_account" });

const OAUTH_BUTTONS = [
  {
    id: "google", label: "Continue with Google", provider: googleProvider,
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
        <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
      </svg>
    ),
  },
  {
    id: "microsoft", label: "Continue with Microsoft", provider: microsoftProvider,
    icon: (
      <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
        <path d="M10 0H1v9h9V0z" fill="#F25022"/>
        <path d="M21 0h-9v9h9V0z" fill="#7FBA00"/>
        <path d="M10 11H1v9h9v-9z" fill="#00A4EF"/>
        <path d="M21 11h-9v9h9v-9z" fill="#FFB900"/>
      </svg>
    ),
  },
] as const;

// ── Shared input style ────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
type Mode = "signin" | "forgot";

export function LoginForm() {
  const { afterSignIn }    = useAuth();
  const router             = useRouter();

  const [mode,           setMode]           = useState<Mode>("signin");
  const [email,          setEmail]          = useState("");
  const [password,       setPassword]       = useState("");
  const [emailError,     setEmailError]     = useState<string | null>(null);
  const [passwordError,  setPasswordError]  = useState<string | null>(null);
  const [globalError,    setGlobalError]    = useState<string | null>(null);
  const [resetSent,      setResetSent]      = useState(false);
  const [isLoading,      setIsLoading]      = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  // ── OAuth sign-in ─────────────────────────────────────────────────────────
  async function handleOAuth(id: string, provider: AuthProvider) {
    clearErrors();
    setActiveProvider(id);
    setIsLoading(true);
    try {
      await signInWithPopup(firebaseAuth, provider);
      const { role } = await afterSignIn();
      router.push(role === "ADMIN" ? "/admin" : "/gallery");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code !== "auth/popup-closed-by-user" &&
        code !== "auth/cancelled-popup-request"
      ) {
        console.error("OAuth error:", err);
        setGlobalError("Sign-in failed. Please try again.");
      }
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  // ── Email / password sign-in ──────────────────────────────────────────────
  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    let valid = true;
    if (!email || !email.includes("@")) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }
    if (!password) {
      setPasswordError("Please enter your password.");
      valid = false;
    }
    if (!valid) return;

    setActiveProvider("email");
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email, password);
      const { role } = await afterSignIn();
      router.push(role === "ADMIN" ? "/admin" : "/gallery");
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password"  ||
        code === "auth/invalid-credential" ||
        code === "auth/invalid-email"
      ) {
        setGlobalError("Incorrect email or password. Try again, or use Forgot Password.");
      } else {
        console.error("Sign-in error:", err);
        setGlobalError("Sign-in failed. Please try again.");
      }
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (!email || !email.includes("@")) {
      setEmailError("Please enter the email address on your account.");
      return;
    }

    setActiveProvider("reset");
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(firebaseAuth, email);
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      // Don't reveal whether the email exists — show a generic success message
      // to avoid user enumeration, except for clearly invalid emails.
      if (code === "auth/invalid-email") {
        setEmailError("Please enter a valid email address.");
      } else {
        // Even if the address isn't found, tell the user to check their inbox.
        setResetSent(true);
      }
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  function clearErrors() {
    setEmailError(null);
    setPasswordError(null);
    setGlobalError(null);
  }

  // ── Forgot-password: success state ───────────────────────────────────────
  if (mode === "forgot" && resetSent) {
    return (
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "var(--olive-dim)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.2rem",
            fontSize: "1.4rem",
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
          If an account exists for <strong>{email}</strong>, a password-reset
          link has been sent. Check your spam folder if it doesn&apos;t arrive
          within a minute.
        </p>
        <button
          onClick={() => {
            setResetSent(false);
            setMode("signin");
          }}
          style={textBtnStyle}
        >
          Back to sign in
        </button>
      </div>
    );
  }

  // ── Forgot-password form ──────────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div>
        <p style={{ fontSize: "0.88rem", color: "var(--charcoal-muted)", lineHeight: 1.7, marginBottom: "1.5rem" }}>
          Enter your email and we&apos;ll send you a link to reset your
          password.
        </p>

        <form onSubmit={handleForgotPassword}>
          <div style={{ marginBottom: "1.2rem" }}>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
              placeholder="your@email.com"
              disabled={isLoading}
              style={{
                ...inputStyle,
                borderColor: emailError ? "#B45309" : "var(--border-strong)",
              }}
            />
            {emailError && (
              <p style={{ color: "#B45309", fontSize: "0.75rem", marginTop: "0.4rem" }}>
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={primaryBtnStyle(isLoading)}
          >
            {isLoading && activeProvider === "reset" ? <Dots light /> : "Send Reset Link"}
          </button>
        </form>

        <button onClick={() => { setMode("signin"); clearErrors(); }} style={textBtnStyle}>
          ← Back to sign in
        </button>
      </div>
    );
  }

  // ── Main sign-in form ─────────────────────────────────────────────────────
  return (
    <div>
      {/* OAuth buttons */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem" }}>
        {OAUTH_BUTTONS.map(({ id, label, provider, icon }) => (
          <button
            key={id}
            onClick={() => handleOAuth(id, provider)}
            disabled={isLoading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.65rem",
              width: "100%",
              padding: "0.8rem 1rem",
              background: "transparent",
              border: "0.5px solid var(--border-strong)",
              fontFamily: "'Jost', sans-serif",
              fontSize: "0.78rem",
              letterSpacing: "0.06em",
              color: "var(--charcoal)",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading && activeProvider !== id ? 0.45 : 1,
              transition: "all 0.2s",
              borderRadius: 0,
            }}
          >
            {isLoading && activeProvider === id ? (
              <Dots />
            ) : (
              <>
                <span style={{ display: "flex" }}>{icon}</span>
                {label}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        <span
          style={{
            fontSize: "0.67rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--charcoal-muted)",
            whiteSpace: "nowrap",
          }}
        >
          or sign in with email
        </span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
      </div>

      {/* Email + password form */}
      <form onSubmit={handleEmailSignIn}>
        {/* Email */}
        <div style={{ marginBottom: "1.2rem" }}>
          <label style={labelStyle}>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            placeholder="your@email.com"
            disabled={isLoading}
            autoComplete="email"
            style={{
              ...inputStyle,
              borderColor: emailError ? "#B45309" : "var(--border-strong)",
            }}
          />
          {emailError && (
            <p style={{ color: "#B45309", fontSize: "0.75rem", marginTop: "0.4rem" }}>
              {emailError}
            </p>
          )}
        </div>

        {/* Password */}
        <div style={{ marginBottom: "0.5rem" }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
            placeholder="••••••••"
            disabled={isLoading}
            autoComplete="current-password"
            style={{
              ...inputStyle,
              borderColor: passwordError ? "#B45309" : "var(--border-strong)",
            }}
          />
          {passwordError && (
            <p style={{ color: "#B45309", fontSize: "0.75rem", marginTop: "0.4rem" }}>
              {passwordError}
            </p>
          )}
        </div>

        {/* Forgot password link */}
        <div style={{ textAlign: "right", marginBottom: "1.4rem" }}>
          <button
            type="button"
            onClick={() => { setMode("forgot"); clearErrors(); }}
            style={{
              background: "none",
              border: "none",
              fontSize: "0.72rem",
              letterSpacing: "0.04em",
              color: "var(--olive)",
              cursor: "pointer",
              fontFamily: "'Jost', sans-serif",
              padding: 0,
            }}
          >
            Forgot password?
          </button>
        </div>

        {/* Global error */}
        {globalError && (
          <p
            style={{
              color: "#92400E",
              fontSize: "0.82rem",
              marginBottom: "1rem",
              padding: "0.75rem",
              background: "#FEF3C7",
              lineHeight: 1.5,
            }}
          >
            {globalError}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          style={primaryBtnStyle(isLoading)}
        >
          {isLoading && activeProvider === "email" ? <Dots light /> : "Sign In"}
        </button>
      </form>

      <p
        style={{
          fontSize: "0.71rem",
          color: "var(--charcoal-muted)",
          marginTop: "1.1rem",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Don&apos;t have a password yet?{" "}
        <button
          onClick={() => { setMode("forgot"); clearErrors(); }}
          style={{
            background: "none",
            border: "none",
            fontSize: "0.71rem",
            color: "var(--olive)",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
            padding: 0,
            textDecoration: "underline",
          }}
        >
          Set one via email
        </button>
        .
      </p>
    </div>
  );
}

// ── Shared style helpers ──────────────────────────────────────────────────────
function primaryBtnStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "0.85rem",
    fontSize: "0.72rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    background: loading ? "var(--charcoal-muted)" : "var(--olive)",
    color: "var(--white)",
    border: "none",
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "'Jost', sans-serif",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.25s",
  };
}

const textBtnStyle: React.CSSProperties = {
  display: "block",
  marginTop: "1.25rem",
  background: "none",
  border: "none",
  fontSize: "0.75rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
  textAlign: "center" as const,
  width: "100%",
};

// ── Loading dots ──────────────────────────────────────────────────────────────
function Dots({ light = false }: { light?: boolean }) {
  const c = light ? "rgba(250,249,246,0.7)" : "var(--charcoal-muted)";
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: c,
            animation: `dp 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes dp{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}