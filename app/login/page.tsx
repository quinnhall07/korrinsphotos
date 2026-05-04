// app/login/page.tsx
// Client portal login — magic link + Google, Microsoft, Apple OAuth.
// ?verify=1  → "Check your inbox" confirmation state
// ?error=1   → expired / invalid link error

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
            Client Portal
          </p>

          {showVerify ? (
            /* ── Magic link sent ───────────────────────────────────────── */
            <div style={{ textAlign: "center", paddingTop: "1rem" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  background: "var(--olive-dim)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 1.4rem",
                  fontSize: "1.4rem",
                  color: "var(--olive)",
                }}
              >
                ✓
              </div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "2rem",
                  fontWeight: 300,
                  lineHeight: 1.2,
                  marginBottom: "0.75rem",
                }}
              >
                Check your inbox
              </h2>
              <p
                style={{
                  fontSize: "0.88rem",
                  color: "var(--charcoal-muted)",
                  lineHeight: 1.8,
                  maxWidth: "300px",
                  margin: "0 auto",
                }}
              >
                A magic link has been sent to your email address. The link
                expires in 15 minutes.
              </p>
            </div>
          ) : (
            /* ── Login form ───────────────────────────────────────────── */
            <>
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
                  That link has expired or is invalid. Please sign in again.
                </div>
              )}

              <LoginForm />

              {/* Admin / demo links — dev only */}
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
                  <a href="/admin" style={devLink}>Admin Access</a>
                  &nbsp;
                  <a href="/gallery" style={devLink}>Demo Client View</a>
                </div>
              )}
            </>
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