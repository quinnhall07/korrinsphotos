// app/shop/thank-you/page.tsx
// Post-checkout landing for digital products. The webhook does the actual
// fulfilment — emails the buyer a presigned download link. This page just
// confirms the purchase and tells the buyer to check their inbox.

import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Thank you | Shop | Korrin's Photos",
};

export const dynamic = "force-static";

export default function ShopThankYouPage() {
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section
        style={{
          padding: "6rem 4rem",
          maxWidth: "48rem",
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
            marginBottom: "1.25rem",
          }}
        >
          Order confirmed
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
            fontWeight: 300,
            lineHeight: 1.1,
            color: "var(--charcoal)",
            marginBottom: "1.5rem",
          }}
        >
          Thank you — your <em>download</em> is on its way.
        </h1>
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "1.05rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.75,
            maxWidth: "36rem",
            margin: "0 auto 2rem",
          }}
        >
          Check your inbox for a private download link. The link is valid for
          seven days. If you don&apos;t see it within a few minutes, check
          your spam folder.
        </p>
        <Link
          href="/shop"
          style={{
            display: "inline-block",
            padding: "0.85rem 2rem",
            background: "transparent",
            color: "var(--charcoal)",
            border: "0.5px solid var(--charcoal)",
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.74rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textDecoration: "none",
          }}
        >
          Back to shop
        </Link>
      </section>
      <Footer />
    </div>
  );
}
