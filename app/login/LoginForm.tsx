"use client";

// app/login/LoginForm.tsx
// Multi-provider Firebase Auth login:
//   • Google, Microsoft (Outlook/work/school), Apple (iCloud)
//   • Email magic link via Firebase sendSignInLinkToEmail
//
// After OAuth sign-in: POSTs ID token to /api/auth/session → session cookie → redirect /gallery
// After email link:    Stores email in localStorage, sends link, redirects from /login/complete

import { useState, useTransition } from "react";
import { useRouter }               from "next/navigation";
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  type AuthProvider,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { useAuth }      from "@/components/FirebaseAuthProvider";

const googleProvider    = new GoogleAuthProvider();
const microsoftProvider = new OAuthProvider("microsoft.com");
//const appleProvider     = new OAuthProvider("apple.com");
microsoftProvider.addScope("email");
microsoftProvider.addScope("profile");
microsoftProvider.setCustomParameters({ prompt: "select_account" });
//appleProvider.addScope("email");
//appleProvider.addScope("name");

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
  /*
  {
    id: "apple", label: "Continue with Apple", provider: appleProvider,
    icon: (
      <svg width="15" height="18" viewBox="0 0 814 1000" fill="currentColor">
        <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-42.3-150.3-109.2C80.5 773.9 32.5 668.1 32.5 566.6c0-161.6 105.6-247.1 209.2-247.1 75.9 0 139.1 46.9 186.8 46.9 45.5 0 116.7-50.2 199.3-50.2zm-234-181.5c31.1-36.9 53.1-88.1 53.1-139.3 0-7.1-.6-14.3-1.9-20.1-50.6 1.9-110.8 33.7-147.1 75.8-28.5 32.4-55.1 83.6-55.1 135.5 0 7.8 1.3 15.6 1.9 18.1 3.2.6 8.4 1.3 13.6 1.3 45.4 0 102.5-30.4 135.5-71.3z"/>
      </svg>
    ),
  },
  */
] as const;

const inputStyle: React.CSSProperties = {
  width: "100%", border: "0.5px solid var(--border-strong)", background: "transparent",
  padding: "0.85rem 1rem", fontFamily: "'Jost', sans-serif", fontSize: "0.92rem",
  color: "var(--charcoal)", outline: "none", borderRadius: 0, appearance: "none" as const,
};

export function LoginForm() {
  const { afterSignIn }  = useAuth();
  const router           = useRouter();
  const [email,          setEmail]          = useState("");
  const [emailError,     setEmailError]     = useState<string | null>(null);
  const [globalError,    setGlobalError]    = useState<string | null>(null);
  const [linkSent,       setLinkSent]       = useState(false);
  const [activeProvider, setActiveProvider] = useState<string | null>(null);
  const [isPending,      startTransition]   = useTransition();

  async function handleOAuth(id: string, provider: AuthProvider) {
    setGlobalError(null);
    setActiveProvider(id);
    startTransition(async () => {
      try {
        await signInWithPopup(firebaseAuth, provider);
        await afterSignIn();
        router.push("/gallery");
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          setActiveProvider(null);
          return;
        }
        setGlobalError("Sign-in failed. Please try again.");
        setActiveProvider(null);
      }
    });
  }

  function handleEmailLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !email.includes("@")) { setEmailError("Please enter a valid email address."); return; }
    setEmailError(null);
    setGlobalError(null);
    setActiveProvider("email");
    startTransition(async () => {
      try {
        await sendSignInLinkToEmail(firebaseAuth, email, {
          url: `${window.location.origin}/login/complete`,
          handleCodeInApp: true,
        });
        window.localStorage.setItem("emailForSignIn", email);
        setLinkSent(true);
      } catch {
        setGlobalError("Could not send the link. Please try again.");
      } finally {
        setActiveProvider(null);
      }
    });
  }

  if (linkSent) {
    return (
      <div style={{ textAlign: "center", padding: "1rem 0" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--olive-dim)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.2rem", fontSize: "1.4rem", color: "var(--olive)" }}>✓</div>
        <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.5rem", fontWeight: 400, marginBottom: "0.5rem" }}>Check your inbox</h3>
        <p style={{ fontSize: "0.88rem", color: "var(--charcoal-muted)", lineHeight: 1.7 }}>
          A sign-in link was sent to <strong>{email}</strong>.<br/>Click it to access your gallery.
        </p>
        <button onClick={() => { setLinkSent(false); setEmail(""); }} style={{ marginTop: "1.5rem", background: "none", border: "none", fontSize: "0.75rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--charcoal-muted)", cursor: "pointer" }}>
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1.75rem" }}>
        {OAUTH_BUTTONS.map(({ id, label, provider, icon }) => (
          <button key={id} onClick={() => handleOAuth(id, provider)} disabled={isPending}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem", width: "100%", padding: "0.8rem 1rem", background: "transparent", border: "0.5px solid var(--border-strong)", fontFamily: "'Jost', sans-serif", fontSize: "0.78rem", letterSpacing: "0.06em", color: "var(--charcoal)", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending && activeProvider !== id ? 0.45 : 1, transition: "all 0.2s", borderRadius: 0 }}>
            {isPending && activeProvider === id ? <Dots /> : <><span style={{ display: "flex" }}>{icon}</span>{label}</>}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.75rem" }}>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        <span style={{ fontSize: "0.67rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--charcoal-muted)", whiteSpace: "nowrap" }}>or use email</span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
      </div>

      <form onSubmit={handleEmailLink}>
        <div style={{ marginBottom: "1.2rem" }}>
          <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.14em", textTransform: "uppercase" as const, color: "var(--charcoal-muted)", marginBottom: "0.5rem" }}>Email Address</label>
          <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailError(null); }} placeholder="your@email.com" disabled={isPending} style={{ ...inputStyle, borderColor: emailError ? "#B45309" : "var(--border-strong)" }} />
          {emailError && <p style={{ color: "#B45309", fontSize: "0.75rem", marginTop: "0.4rem" }}>{emailError}</p>}
        </div>
        {globalError && <p style={{ color: "#B45309", fontSize: "0.8rem", marginBottom: "1rem", padding: "0.75rem", background: "#FEF3C7" }}>{globalError}</p>}
        <button type="submit" disabled={isPending} style={{ width: "100%", padding: "0.85rem", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", background: "var(--olive)", color: "var(--white)", border: "none", cursor: isPending ? "not-allowed" : "pointer", fontFamily: "'Jost', sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isPending && activeProvider === "email" ? <Dots light /> : "Send Magic Link"}
        </button>
      </form>
      <p style={{ fontSize: "0.71rem", color: "var(--charcoal-muted)", marginTop: "1.1rem", textAlign: "center", lineHeight: 1.6 }}>Works with Gmail, Outlook, iCloud, or any email.</p>
    </div>
  );
}

function Dots({ light = false }: { light?: boolean }) {
  const c = light ? "rgba(250,249,246,0.7)" : "var(--charcoal-muted)";
  return (
    <span style={{ display: "flex", gap: 4, alignItems: "center", height: 18 }}>
      {[0,1,2].map(i => <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: c, animation: `dp 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}
      <style>{`@keyframes dp{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </span>
  );
}