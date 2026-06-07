// app/booking/page.tsx
// Booking inquiry page. The form is a 3-step Client Component that submits
// via the `submitBooking` Server Action (no API route involved).
//
// Accepts these query params — they are read directly by BookingFormSteps via
// useSearchParams(), so the page no longer needs to thread them as props:
//   - `?package=mini|story|day` — from /investment (resolves to sessionType).
//   - `?sessionType=<Wedding|Portrait|…>` — direct sessionType override (e.g.
//     from a /c/<slug> campaign CTA).
//   - `?campaign=<slug>` — informational only; the server reads the cookie
//     written by `/c/[slug]/page.tsx` for attribution.

import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingFormSteps } from "./BookingFormSteps";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Book a photography session — weddings, portraits, editorial, and more.",
};

export default function BookingPage() {
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: "calc(100vh - 72px)",
        }}
      >
        {/* Left — image panel */}
        <div
          style={{
            background:
              "url('https://picsum.photos/seed/wedding44/900/1200') center/cover no-repeat",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(42,42,40,0.25)",
            }}
          />
        </div>

        {/* Right — form panel */}
        <div
          style={{
            padding: "5rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
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
            Book a Session
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.4rem",
              fontWeight: 300,
              lineHeight: 1.2,
              marginBottom: "0.5rem",
            }}
          >
            Let&apos;s make
            <br />
            <em>something beautiful</em>
          </h1>
          <p
            style={{
              fontSize: "0.88rem",
              color: "var(--charcoal-muted)",
              lineHeight: 1.7,
              marginBottom: "2.5rem",
            }}
          >
            Tell me about your vision. I&apos;ll follow up within 48 hours to
            discuss availability and details.
          </p>

          <Suspense fallback={null}><BookingFormSteps /></Suspense>
        </div>
      </div>
    </div>
  );
}