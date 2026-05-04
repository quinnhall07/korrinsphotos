"use client";

// app/error.tsx
// Global error boundary — catches unhandled errors in Server Components.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        paddingTop: "72px",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4rem 2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "32rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "1rem",
          }}
        >
          Something went wrong
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "2.5rem",
            fontWeight: 300,
            marginBottom: "1rem",
            lineHeight: 1.2,
          }}
        >
          An unexpected <em>error occurred</em>
        </h1>
        <p
          style={{
            fontSize: "0.88rem",
            color: "var(--charcoal-muted)",
            lineHeight: 1.8,
            marginBottom: "2rem",
          }}
        >
          We&apos;re sorry for the inconvenience. Please try again, or contact
          us if the problem persists.
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.85rem 2.2rem",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}