// app/sign-contract/[id]/page.tsx
// Public landing page for clients to review and sign a contract.
//
// Phase 1.7 — auth model: the contractId in the URL + the `?t=<token>` query
// parameter together form the credential. No Firebase session is required.
// Validation order:
//   1) contract exists                                   → else 404
//   2) status === VOIDED                                 → "voided" page
//   3) status === SIGNED                                 → "already signed" page
//   4) token matches & not expired                       → render contract + form
//   5) token missing / mismatched / expired              → "expired link" page
//
// Token comparison uses crypto.timingSafeEqual on equal-length buffers to
// avoid leaking the token via response-time side channels.

import { timingSafeEqual } from "crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { getContract, type ContractDoc } from "@/lib/db/contracts";
import { formatDateTime } from "@/lib/date";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { SigningForm } from "./SigningForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign your contract",
  description: "Review and sign your photography contract.",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string | string[] }>;
};

/**
 * Constant-time comparison of two ASCII strings. Returns false if either
 * input is missing or the lengths differ — falling back to !== for
 * different-length inputs is fine since the length itself is not secret.
 */
function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

function isTokenExpired(contract: ContractDoc): boolean {
  if (!contract.tokenExpiresAt) return false; // legacy contracts: no expiry stored
  try {
    return contract.tokenExpiresAt.toMillis() < Date.now();
  } catch {
    return false;
  }
}

export default async function SignContractPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const rawToken = Array.isArray(sp.t) ? sp.t[0] : sp.t;
  const token = typeof rawToken === "string" ? rawToken : null;

  const contract = await getContract(id);

  if (!contract) {
    notFound();
  }

  // ── VOIDED ───────────────────────────────────────────────────────────────
  if (contract.status === "VOIDED") {
    return (
      <ApologyPage
        eyebrow="Voided"
        title="This contract has been voided"
        body="The agreement linked here is no longer valid. Please reach out to Korrin directly so a fresh contract can be prepared for you."
      />
    );
  }

  // ── ALREADY SIGNED ───────────────────────────────────────────────────────
  if (contract.status === "SIGNED") {
    const signedAtLabel = formatDateTime(contract.signedAt);
    const signedName =
      contract.signerName ??
      contract.signedTypedName ??
      "Signature on file";

    // Best-effort signed-copy download. We mint a short presigned GET URL on
    // every page load so the URL itself is not stable/cacheable.
    let downloadUrl: string | null = null;
    if (contract.signedPdfR2Key) {
      try {
        downloadUrl = await generatePresignedGetUrl(contract.signedPdfR2Key, 600);
      } catch (err) {
        console.error("[sign-contract] Failed to mint signed-copy URL", err);
      }
    }

    return (
      <div style={{ paddingTop: "72px" }} className="page-fade-in">
        <section style={{ padding: "5rem 2rem", maxWidth: "880px", margin: "0 auto" }}>
          <PageHeader
            eyebrow="Signed"
            title={<>Thank you, <em>your contract is on file</em></>}
            lede="A copy has been saved for both parties. You can download a signed copy below."
          />

          <div
            style={{
              borderLeft: "2px solid var(--olive)",
              padding: "1.75rem 2rem",
              background: "var(--olive-dim)",
              marginBottom: "2rem",
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
              Signed by
            </p>
            <p
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "1.8rem",
                fontWeight: 300,
                lineHeight: 1.2,
                marginBottom: "0.4rem",
                fontStyle: "italic",
              }}
            >
              {signedName}
            </p>
            {signedAtLabel && (
              <p style={{ fontSize: "0.82rem", color: "var(--charcoal-muted)" }}>
                Signed on {signedAtLabel}
              </p>
            )}
          </div>

          {downloadUrl ? (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-block",
                padding: "0.95rem 2.6rem",
                fontSize: "0.72rem",
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                background: "var(--olive)",
                color: "var(--white)",
                textDecoration: "none",
                fontFamily: "'Jost', sans-serif",
              }}
            >
              Download signed copy
            </a>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--charcoal-muted)" }}>
              The signed document is being archived. If you need a copy right away, please email Korrin.
            </p>
          )}
        </section>
        <Footer />
      </div>
    );
  }

  // ── TOKEN VALIDATION ─────────────────────────────────────────────────────
  // For contracts in any state other than DRAFT we expect a signing token.
  // (DRAFT shouldn't even be reachable via the public route, but treat it
  // as expired-link to be safe — admin hasn't sent it yet.)
  const tokenOk =
    contract.status === "SENT" &&
    !!contract.signingToken &&
    tokensMatch(contract.signingToken, token) &&
    !isTokenExpired(contract);

  if (!tokenOk) {
    return (
      <ApologyPage
        eyebrow="Link expired"
        title="This signing link is no longer valid"
        body="Signing links expire 14 days after they're sent. Please email Korrin and a fresh link will be sent right over."
      />
    );
  }

  // ── READY TO SIGN ────────────────────────────────────────────────────────
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section style={{ padding: "5rem 2rem", maxWidth: "880px", margin: "0 auto" }}>
        <PageHeader
          eyebrow="Korrin's Photography"
          title={<>Your <em>contract</em></>}
          lede="Please read the agreement below carefully. When you're ready, draw or type your signature to sign electronically."
        />

        {/* Contract HTML — rendered into a sandboxed iframe via srcDoc so the
            template's own <html>/<style> can't leak into the page chrome. */}
        <iframe
          title="Contract preview"
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:'Cormorant Garamond', Georgia, serif;color:#2A2A28;line-height:1.8;padding:2rem;background:#FAF9F6;}h1,h2,h3{font-weight:300;}a{color:#6B7845;}</style></head><body>${contract.renderedHtml}</body></html>`}
          sandbox="allow-same-origin"
          style={{
            width: "100%",
            minHeight: "560px",
            border: "0.5px solid var(--border-strong)",
            background: "rgba(250,249,246,0.6)",
            marginBottom: "3rem",
          }}
        />

        <SigningForm contractId={contract.id} token={token!} />
      </section>
      <Footer />
    </div>
  );
}

// ─── Subviews ───────────────────────────────────────────────────────────────

function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
}) {
  return (
    <>
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
          {eyebrow}
        </span>
        <div style={{ flex: 1, height: "0.5px", background: "var(--border)" }} />
      </div>
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
        {title}
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
        {lede}
      </p>
    </>
  );
}

function ApologyPage({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div style={{ paddingTop: "72px" }} className="page-fade-in">
      <section
        style={{
          padding: "6rem 2rem",
          maxWidth: "720px",
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
          {eyebrow}
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "clamp(2.2rem, 5vw, 3.4rem)",
            fontWeight: 300,
            lineHeight: 1.2,
            marginBottom: "1.5rem",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.8,
            marginBottom: "2.5rem",
          }}
        >
          {body}
        </p>
        <a
          href="mailto:korrin@korrinsphotos.com?subject=Contract%20link%20issue"
          style={{
            display: "inline-block",
            padding: "0.95rem 2.6rem",
            fontSize: "0.72rem",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            background: "var(--olive)",
            color: "var(--white)",
            textDecoration: "none",
            fontFamily: "'Jost', sans-serif",
          }}
        >
          Email Korrin
        </a>
      </section>
      <Footer />
    </div>
  );
}
