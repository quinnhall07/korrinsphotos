// app/login/page.tsx
// Client portal login page — magic link via NextAuth + Resend.
// If ?verify=1 is in the URL, show the "check your inbox" confirmation.

import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Client Login",
  description: "Access your private photo gallery.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; error?: string }>;
}) {
  const { verify, error } = await searchParams;
  const showVerify = verify === "1";
  const hasError = error === "1";

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
        {/* Subtle background image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "url('https://picsum.photos/seed/forest22/1200/800') center/cover no-repeat",
            opacity: 0.07,
          }}
        />

        {/* Login card */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            maxWidth: "440px",
            padding: "3.5rem",
            border: "0.5px solid var(--border-strong)",
            background: "rgba(250,249,246,0.92)",
            backdropFilter: "blur(8px)",
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
            Client Portal
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

          {showVerify ? (
            /* ── Verification sent state ────────────────────────────── */
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
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--charcoal-muted)",
                  lineHeight: 1.7,
                }}
              >
                A magic link has been sent to your email address. The link
                expires in 15 minutes.
              </p>
            </div>
          ) : (
            /* ── Login form ─────────────────────────────────────────── */
            <>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--charcoal-muted)",
                  lineHeight: 1.7,
                  marginBottom: "2.5rem",
                }}
              >
                Enter your email and we&apos;ll send you a secure magic link to
                access your private gallery.
              </p>

              {hasError && (
                <p
                  style={{
                    color: "#B45309",
                    fontSize: "0.82rem",
                    marginBottom: "1.2rem",
                    padding: "0.75rem",
                    background: "#FEF3C7",
                  }}
                >
                  That link has expired or is invalid. Please request a new one.
                </p>
              )}

              <LoginForm />

              {/* Admin quick-access (dev only — remove in production) */}
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
                      fontSize: "0.78rem",
                      color: "var(--charcoal-muted)",
                      marginBottom: "0.75rem",
                    }}
                  >
                    Are you the photographer?
                  </p>
                  <a
                    href="/admin"
                    style={{
                      display: "inline-block",
                      padding: "0.6rem 1.4rem",
                      fontSize: "0.68rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--charcoal)",
                      border: "0.5px solid var(--border-strong)",
                      textDecoration: "none",
                      marginRight: "0.5rem",
                    }}
                  >
                    Admin Access
                  </a>
                  <a
                    href="/gallery"
                    style={{
                      display: "inline-block",
                      padding: "0.6rem 1.4rem",
                      fontSize: "0.68rem",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "var(--charcoal)",
                      border: "0.5px solid var(--border-strong)",
                      textDecoration: "none",
                    }}
                  >
                    Demo Client View
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}