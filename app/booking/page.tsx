// app/booking/page.tsx
// Booking inquiry page. The form is a 3-step Client Component that submits
// via the `submitBooking` Server Action (no API route involved).
//
// Accepts an optional `?package=mini|story|day` query param coming from the
// /investment page CTAs; the param is resolved server-side against
// INVESTMENT_PACKAGES and the matching sessionType is threaded into the
// form as `initialSessionType` so the relevant tile is pre-selected.

import type { Metadata } from "next";
import { BookingFormSteps } from "./BookingFormSteps";
import { findPackageById } from "@/app/investment/packages";

export const metadata: Metadata = {
  title: "Booking",
  description:
    "Book a photography session — weddings, portraits, editorial, and more.",
};

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const { package: packageParam } = await searchParams;
  const initialSessionType = findPackageById(packageParam)?.sessionType ?? null;

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

          <BookingFormSteps initialSessionType={initialSessionType} />
        </div>
      </div>
    </div>
  );
}