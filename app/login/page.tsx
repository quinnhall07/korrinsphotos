// app/login/page.tsx
// Client portal login — email/password + Google/Microsoft OAuth.
// ?error=1   → expired / invalid invite link error
//
// Logged-in users are immediately redirected:
//   ADMIN  → /admin
//   CLIENT → /gallery

import type { Metadata } from "next";
import Link              from "next/link";
import { redirect }      from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { adminDb }        from "@/lib/firebase-admin";
import { LoginForm }      from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Access your private photo gallery.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // ── Redirect already-authenticated users ──────────────────────────────────
  // Check the server-side session cookie. If valid, look up the role in
  // Firestore (more reliable than relying solely on JWT claims) and redirect.
  const session = await getSessionUser();
  if (session) {
    try {
      const userDoc = await adminDb.collection("users").doc(session.uid).get();
      const role = userDoc.exists ? (userDoc.data()?.role as string) : null;
      redirect(role === "ADMIN" ? "/admin" : "/portal/router");
    } catch {
      // Firestore unavailable — fall back to JWT claim
      redirect(session["role"] === "ADMIN" ? "/admin" : "/gallery");
    }
  }

  const { error } = await searchParams;
  const hasError  = error === "1";

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <div
        style={{
          minHeight: "calc(100vh - 72px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* Subtle background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "url('https://picsum.photos/seed/forest22/1200/800') center/cover no-repeat",
            opacity: 0.07,
          }}
        />

        {/* Card */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: "460px",
            padding: "3.5rem",
            border: "0.5px solid var(--border-strong)",
            background: "rgba(250,249,246,0.96)",
            backdropFilter: "blur(12px)",
          }}
        >
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "1rem",
            }}
          >
            Login Portal
          </p>

          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.2rem",
              fontWeight: 300,
              lineHeight: 1.2,
              marginBottom: "0.5rem",
            }}
          >
            Welcome
            <br />
            <em>back</em>
          </h2>
          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--charcoal-muted)",
              lineHeight: 1.7,
              marginBottom: "2rem",
            }}
          >
            Sign in to access your private gallery.
          </p>

          {hasError && (
            <div
              style={{
                padding: "0.9rem 1rem",
                background: "#FEF3C7",
                borderLeft: "2px solid #F59E0B",
                fontSize: "0.82rem",
                color: "#92400E",
                marginBottom: "1.5rem",
                lineHeight: 1.6,
              }}
            >
              That invite link has expired or is invalid. Please sign in below
              or ask Korrin to resend your invitation.
            </div>
          )}

          <LoginForm />

          {/* Admin shortcut — dev only */}
          {process.env.NODE_ENV === "development" && (
            <div
              style={{
                borderTop: "0.5px solid var(--border)",
                marginTop: "2rem",
                paddingTop: "1.5rem",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--charcoal-muted)",
                  marginBottom: "0.75rem",
                }}
              >
                Are you the photographer?
              </p>
              <Link href="/admin" style={devLink}>Admin Access</Link>
              &nbsp;
              <Link href="/gallery" style={devLink}>Demo Client View</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const devLink: React.CSSProperties = {
  display: "inline-block",
  padding: "0.55rem 1.2rem",
  fontSize: "0.67rem",
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  textDecoration: "none",
  marginBottom: "0.25rem",
};