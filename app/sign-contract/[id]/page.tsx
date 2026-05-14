// app/sign-contract/[id]/page.tsx
// Public landing page for clients to review and sign a contract.
// No auth required — clients arrive here via the link emailed by sendContract().
// The secure-token-bound URL is Phase 1.7; for now we read by raw contractId.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getContract } from "@/lib/db/contracts";
import { formatDateTime } from "@/lib/date";
import { SignContractForm } from "./SignContractForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign your contract",
  description: "Review and sign your photography contract.",
  robots: { index: false, follow: false },
};

export default async function SignContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contract = await getContract(id);

  if (!contract || contract.status === "VOIDED") {
    notFound();
  }

  const isSigned = contract.status === "SIGNED";
  const signedAtLabel = isSigned ? formatDateTime(contract.signedAt) : null;
  const signedName =
    isSigned && typeof (contract as { signedTypedName?: unknown }).signedTypedName === "string"
      ? ((contract as { signedTypedName?: string }).signedTypedName as string)
      : null;

  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section style={{ padding: "5rem 2rem", maxWidth: "880px", margin: "0 auto" }}>
        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "1.5rem", marginBottom: "2.5rem" }}>
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
            Korrin&apos;s Photography
          </span>
          <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
        </div>

        {/* Header */}
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.2rem, 4vw, 3.2rem)",
            fontWeight: 300,
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
            marginBottom: "1rem",
          }}
        >
          Your <em>contract</em>
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.7,
            marginBottom: "3rem",
            maxWidth: "44rem",
          }}
        >
          Please read the agreement below carefully. When you&apos;re ready, type your full name to sign electronically.
        </p>

        {/* Contract HTML — rendered from a controlled template */}
        <article
          style={{
            border: "0.5px solid var(--border-strong)",
            background: "rgba(250,249,246,0.6)",
            padding: "3rem 3rem",
            marginBottom: "3rem",
            fontSize: "0.95rem",
            lineHeight: 1.8,
            color: "var(--charcoal)",
          }}
          dangerouslySetInnerHTML={{ __html: contract.renderedHtml }}
        />

        {/* Signature surface */}
        {isSigned ? (
          <div
            style={{
              borderLeft: "2px solid var(--olive)",
              padding: "1.5rem 1.75rem",
              background: "var(--olive-dim)",
            }}
          >
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--olive)",
                marginBottom: "0.6rem",
              }}
            >
              Signed
            </p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.6rem",
                fontWeight: 300,
                lineHeight: 1.2,
                marginBottom: "0.4rem",
              }}
            >
              {signedName ?? "Signature on file"}
            </p>
            {signedAtLabel && (
              <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
                Signed on {signedAtLabel}
              </p>
            )}
          </div>
        ) : (
          <SignContractForm contractId={contract.id} clientId={contract.clientId} />
        )}
      </section>

      <Footer />
    </div>
  );
}
