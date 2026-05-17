// app/booking/payment-success/page.tsx
// Public landing page after a successful Stripe Checkout deposit.
// The Stripe webhook (/api/webhooks/stripe) is the single writer of project
// state — this page only renders a confirmation. Failures retrieving the
// Stripe session are non-fatal; we fall back to a generic confirmation.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "You're booked",
  description: "Deposit received — your session is confirmed.",
  robots: { index: false, follow: false },
};

type RetrievedSession = {
  amountTotal: number | null;
  customerEmail: string | null;
};

async function retrieveCheckoutSession(sessionId: string): Promise<RetrievedSession | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
      amountTotal: session.amount_total ?? null,
      customerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    };
  } catch (err) {
    console.error("payment-success: could not retrieve checkout session", err);
    return null;
  }
}

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  const session = sessionId ? await retrieveCheckoutSession(sessionId) : null;

  const nextSteps = [
    {
      eyebrow: "Step One",
      title: "Welcome packet",
      body: "Korrin will send a short welcome email with everything you need before the shoot.",
    },
    {
      eyebrow: "Step Two",
      title: "Questionnaire",
      body: "A few questions about your vision, location preferences, and the people who'll be there.",
    },
    {
      eyebrow: "Step Three",
      title: "Day-of timeline",
      body: "Once the date is close, we'll lock in the schedule, locations, and any final details.",
    },
  ];

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      {/* Hero */}
      <section
        style={{
          padding: "7rem 2rem 5rem",
          maxWidth: "880px",
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "1.5rem",
          }}
        >
          Deposit Received
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.8rem, 6vw, 4.8rem)",
            fontWeight: 300,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            marginBottom: "1.5rem",
          }}
        >
          You&apos;re <em>booked.</em>
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            fontWeight: 300,
            lineHeight: 1.85,
            color: "var(--charcoal-light)",
            maxWidth: "38rem",
            margin: "0 auto",
          }}
        >
          Thank you for the deposit. Korrin will be in touch within 24 hours with your welcome packet and next steps.
        </p>

        {session && (session.amountTotal || session.customerEmail) && (
          <div
            style={{
              marginTop: "3rem",
              display: "inline-block",
              borderTop: "0.5px solid var(--border)",
              borderBottom: "0.5px solid var(--border)",
              padding: "1.25rem 2.5rem",
              textAlign: "left",
            }}
          >
            {session.amountTotal !== null && (
              <div style={{ marginBottom: session.customerEmail ? "0.6rem" : 0 }}>
                <span
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    marginRight: "0.75rem",
                  }}
                >
                  Amount
                </span>
                <span
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.4rem",
                    fontWeight: 300,
                  }}
                >
                  {formatUsd(session.amountTotal)}
                </span>
              </div>
            )}
            {session.customerEmail && (
              <div>
                <span
                  style={{
                    fontSize: "0.65rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                    marginRight: "0.75rem",
                  }}
                >
                  Receipt
                </span>
                <span style={{ fontSize: "0.95rem", color: "var(--charcoal)" }}>
                  {session.customerEmail}
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* What happens next */}
      <section style={{ padding: "4rem 2rem 6rem", maxWidth: "1120px", margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "3rem" }}>
          <span
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "var(--olive)",
              fontWeight: 400,
              whiteSpace: "nowrap",
            }}
          >
            What Happens Next
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "0",
            listStyle: "none",
            borderTop: "0.5px solid var(--border)",
            borderBottom: "0.5px solid var(--border)",
          }}
        >
          {nextSteps.map((step, i) => (
            <li
              key={step.eyebrow}
              style={{
                padding: "2.5rem 2rem",
                borderRight: i < nextSteps.length - 1 ? "0.5px solid var(--border)" : undefined,
              }}
            >
              <p
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                  color: "var(--olive)",
                  marginBottom: "0.9rem",
                }}
              >
                {step.eyebrow}
              </p>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: "1.6rem",
                  fontWeight: 300,
                  lineHeight: 1.2,
                  marginBottom: "0.75rem",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  lineHeight: 1.7,
                  color: "var(--charcoal-light)",
                  fontWeight: 300,
                }}
              >
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div style={{ textAlign: "center", marginTop: "4rem" }}>
          <Link
            href="/portal"
            style={{
              display: "inline-block",
              padding: "0.95rem 2.6rem",
              fontSize: "0.72rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              background: "var(--charcoal)",
              color: "var(--white)",
              textDecoration: "none",
            }}
          >
            Visit your client portal
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
