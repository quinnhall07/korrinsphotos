"use client";

// app/login/LoginForm.tsx
// Multi-provider Firebase Auth login:
//   • Google, Microsoft (Outlook/work/school)
//   • Email + Password sign-up / sign-in
//
// Magic links are an admin-only feature sent from the dashboard.
// Role-aware redirect: ADMIN → /admin, CLIENT → /gallery

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  type AuthProvider,
} from "firebase/auth";
import { firebaseAuth, requireFirebaseAuth } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.addScope("email");
microsoftProvider.addScope("profile");
microsoftProvider.setCustomParameters({ prompt: "select_account" });

const OAUTH_BUTTONS = [
  {
    id: "google",
    label: "Continue with Google",
    provider: googleProvider,
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
    id: "microsoft",
    label: "Continue with Microsoft",
    provider: microsoftProvider,
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

// These Firebase error codes mean the user intentionally dismissed the popup
const POPUP_CANCEL_CODES = new Set([
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
]);

function parseFirebaseError(code: string | undefined): string {
  switch (code) {
    case "auth/account-exists-with-different-credential":
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in with Google or Microsoft instead.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/user-not-found":
      return "No account found with this email. Use 'Create Account' to sign up.";
    case "auth/too-many-requests":
      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

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
  transition: "border-color 0.2s",
};

type EmailMode = "password-signin" | "password-signup";

export function LoginForm() {
  const { afterSignIn } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [emailMode, setEmailMode] = useState<EmailMode>("password-signin");

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);

  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  // Role-aware redirect helper.
  // CLIENT users land on /portal/router which auto-routes to their single
  // project (or a chooser if multiple) — the portal is the canonical client
  // home, not the raw gallery index.
  function redirectForRole(role: string) {
    router.push(role === "ADMIN" ? "/admin" : "/portal/router");
  }

  // Email a password-reset link via Firebase.
  async function handleForgotPassword() {
    setGlobalError(null);
    setEmailError(null);
    if (!email) {
      setEmailError("Enter your email above first, then click Forgot password.");
      return;
    }
    setResetSending(true);
    try {
      const auth = requireFirebaseAuth();
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      // Don't leak whether the email exists; show the same success message
      // for security parity unless the email itself is invalid.
      if (code === "auth/invalid-email") {
        setEmailError("Please enter a valid email address.");
      } else {
        setResetSent(true);
      }
    } finally {
      setResetSending(false);
    }
  }

  // ── OAuth (Google / Microsoft) ─────────────────────────────────────────────
  async function handleOAuth(id: string, provider: AuthProvider) {
    setGlobalError(null);
    setActiveProvider(id);
    setIsLoading(true);

    try {
      const auth = requireFirebaseAuth();
      await signInWithPopup(auth, provider);
      const { role } = await afterSignIn();
      redirectForRole(role);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      if (POPUP_CANCEL_CODES.has(code ?? "")) {
        // User dismissed — silently reset, no error needed
      } else if (code === "auth/account-exists-with-different-credential") {
        setGlobalError(parseFirebaseError(code));
      } else {
        console.error("OAuth error:", err);
        setGlobalError("Sign-in failed. Please try again.");
      }
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  // ── Email + Password Sign In ───────────────────────────────────────────────
  async function handlePasswordSignIn(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setGlobalError(null);

    if (!email) { setEmailError("Email is required."); return; }
    if (!password) { setPasswordError("Password is required."); return; }

    setActiveProvider("email-password");
    setIsLoading(true);

    const auth = requireFirebaseAuth();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      const { role } = await afterSignIn();
      redirectForRole(role);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      // Check what providers this email actually uses for a better hint
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [] as string[]);
        if (methods.includes("google.com")) {
          setGlobalError("This email is linked to a Google account. Use 'Continue with Google' above.");
        } else if (methods.includes("microsoft.com")) {
          setGlobalError("This email is linked to a Microsoft account. Use 'Continue with Microsoft' above.");
        } else {
          setGlobalError(parseFirebaseError(code));
        }
      } else {
        setGlobalError(parseFirebaseError(code));
      }
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  // ── Email + Password Sign Up ───────────────────────────────────────────────
  async function handlePasswordSignUp(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setPasswordError(null);
    setGlobalError(null);

    if (!email) { setEmailError("Email is required."); return; }
    if (!password) { setPasswordError("Password is required."); return; }
    if (password.length < 6) { setPasswordError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setPasswordError("Passwords do not match."); return; }

    setActiveProvider("email-signup");
    setIsLoading(true);

    try {
      const auth = requireFirebaseAuth();
      const methods = await fetchSignInMethodsForEmail(auth, email).catch(() => [] as string[]);
      if (methods.includes("google.com")) {
        setGlobalError("This email is already linked to a Google account. Sign in with Google instead.");
        return;
      }
      if (methods.includes("microsoft.com")) {
        setGlobalError("This email is already linked to a Microsoft account. Sign in with Microsoft instead.");
        return;
      }

      await createUserWithEmailAndPassword(auth, email, password);
      const { role } = await afterSignIn();
      redirectForRole(role);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      setGlobalError(parseFirebaseError(code));
    } finally {
      setActiveProvider(null);
      setIsLoading(false);
    }
  }

  const isSignUp = emailMode === "password-signup";
  const handleEmailSubmit = isSignUp ? handlePasswordSignUp : handlePasswordSignIn;
  const authConfigured = Boolean(firebaseAuth);

  return (
    <div>
      {/* OAuth buttons */}
      {!authConfigured && (
        <div style={{ padding: "0.75rem 1rem", background: "#FEF3C7", borderLeft: "2px solid #F59E0B", fontSize: "0.82rem", color: "#92400E", marginBottom: "1rem", lineHeight: 1.6 }}>
          Sign-in is not configured for this environment.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem" }}>
        {OAUTH_BUTTONS.map(({ id, label, provider, icon }) => (
          <button
            key={id}
            onClick={() => handleOAuth(id, provider)}
            disabled={isLoading || !authConfigured}
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
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        <span style={{ fontSize: "0.67rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal-muted)", whiteSpace: "nowrap" }}>
          or use email & password
        </span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
      </div>

      {/* Email mode toggle */}
      <div style={{ display: "flex", marginBottom: "1.4rem", border: "0.5px solid var(--border-strong)" }}>
        {(["password-signin", "password-signup"] as EmailMode[]).map((mode) => {
          const labels: Record<EmailMode, string> = {
            "password-signin": "Sign In",
            "password-signup": "Create Account",
          };
          const active = emailMode === mode;
          return (
            <button
              key={mode}
              onClick={() => {
                setEmailMode(mode);
                setEmailError(null);
                setPasswordError(null);
                setGlobalError(null);
              }}
              style={{
                flex: 1,
                padding: "0.6rem 0.5rem",
                fontSize: "0.68rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "'Jost', sans-serif",
                border: "none",
                borderRight: mode === "password-signin" ? "0.5px solid var(--border-strong)" : "none",
                background: active ? "var(--charcoal)" : "transparent",
                color: active ? "var(--white)" : "var(--charcoal-muted)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {labels[mode]}
            </button>
          );
        })}
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>
            Email Address
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
            placeholder="your@email.com"
            disabled={isLoading}
            style={{ ...inputStyle, borderColor: emailError ? "#B45309" : "var(--border-strong)" }}
          />
          {emailError && (
            <p style={{ color: "#B45309", fontSize: "0.75rem", marginTop: "0.4rem" }}>{emailError}</p>
          )}
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
            placeholder={isSignUp ? "Create a password (6+ characters)" : "Your password"}
            disabled={isLoading}
            style={{ ...inputStyle, borderColor: passwordError ? "#B45309" : "var(--border-strong)" }}
          />
        </div>

        {isSignUp && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(null); }}
              placeholder="Repeat your password"
              disabled={isLoading}
              style={{ ...inputStyle, borderColor: passwordError ? "#B45309" : "var(--border-strong)" }}
            />
          </div>
        )}

        {passwordError && (
          <p style={{ color: "#B45309", fontSize: "0.75rem", marginBottom: "0.75rem" }}>{passwordError}</p>
        )}

        {!isSignUp && !resetSent && (
          <div style={{ textAlign: "right", marginBottom: "0.85rem" }}>
            <button
              type="button"
              onClick={handleForgotPassword}
              disabled={isLoading || resetSending}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontFamily: "'Jost', sans-serif",
                fontSize: "0.74rem",
                color: "var(--olive)",
                cursor: isLoading || resetSending ? "not-allowed" : "pointer",
                textDecoration: "underline",
                letterSpacing: "0.04em",
              }}
            >
              {resetSending ? "Sending…" : "Forgot password?"}
            </button>
          </div>
        )}

        {resetSent && (
          <div style={{ padding: "0.65rem 0.85rem", background: "var(--olive-dim)", borderLeft: "2px solid var(--olive)", fontSize: "0.78rem", color: "var(--charcoal)", marginBottom: "0.85rem", lineHeight: 1.55 }}>
            If an account exists for that email, a reset link is on the way. Check your inbox (and spam folder).
          </div>
        )}

        {globalError && (
          <div style={{ padding: "0.75rem 1rem", background: "#FEF3C7", borderLeft: "2px solid #F59E0B", fontSize: "0.82rem", color: "#92400E", marginBottom: "1rem", lineHeight: 1.6 }}>
            {globalError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !authConfigured}
          style={{
            width: "100%",
            padding: "0.85rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor: isLoading || !authConfigured ? "not-allowed" : "pointer",
            fontFamily: "'Jost', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: isLoading || !authConfigured ? 0.7 : 1,
            transition: "background 0.2s",
          }}
        >
          {isLoading && (activeProvider === "email-password" || activeProvider === "email-signup") ? (
            <Dots light />
          ) : isSignUp ? (
            "Create Account"
          ) : (
            "Sign In"
          )}
        </button>
      </form>

      <p style={{ fontSize: "0.71rem", color: "var(--charcoal-muted)", marginTop: "1rem", textAlign: "center", lineHeight: 1.6 }}>
        {isSignUp
          ? "Already have an account? Switch to Sign In above."
          : "New here? Switch to Create Account above."}
      </p>
    </div>
  );
}

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
