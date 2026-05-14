"use server";

// app/sign-contract/[id]/actions.ts
// Public Server Action — clients sign the contract from the email link.
// No requireAdmin/requireSession guard: the contractId + the `?t=<token>`
// query param together are the credential. Validation order:
//   1) name & checkbox required
//   2) contract exists, not SIGNED, not VOIDED
//   3) token matches & not expired (constant-time compare)
//   4) write SIGNED status + signer metadata, upload completion certificate
//      to R2, notify admin via mail/, create inboxItem, copy client.
//
// IMPLEMENTATION NOTE — completion document format
// ─────────────────────────────────────────────────
// puppeteer-core / @sparticuz/chromium are NOT current dependencies. Rather
// than add a heavy serverless-chromium pipeline now, v1 stores the signed
// completion certificate as `contracts/{id}/signed.html` in R2. The HTML
// embeds the original rendered contract, the captured signature image,
// the typed name, and an audit appendix (IP / UA / timestamp). A future
// follow-up can swap the writer to PDF without changing the storage key
// shape or any other call site.

import { timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { adminDb } from "@/lib/firebase-admin";
import { contractsCol, getContract, type ContractDoc } from "@/lib/db/contracts";
import { logActivity } from "@/lib/db/activity";
import { createInboxItem } from "@/lib/db/inbox";
import { enqueueTrackedMail } from "@/lib/email/tracking";

type SignResult =
  | { success: true; signedAt: string }
  | { success: false; error: string };

const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_EMAILS?.split(",")[0]?.trim() ||
  process.env.ADMIN_EMAIL ||
  "";

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
  if (!contract.tokenExpiresAt) return false;
  try {
    return contract.tokenExpiresAt.toMillis() < Date.now();
  } catch {
    return false;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Build the completion-certificate HTML: contract body + signature block +
 * audit appendix. Self-contained — no external CSS or fonts, so it renders
 * the same when re-opened years later.
 */
function buildCertificateHtml(args: {
  contract: ContractDoc;
  signerName: string;
  signatureDataUrl: string | null;
  signedAt: Date;
  ip: string | null;
  userAgent: string | null;
}): string {
  const { contract, signerName, signatureDataUrl, signedAt, ip, userAgent } = args;
  const sigBlock = signatureDataUrl
    ? `<img src="${signatureDataUrl}" alt="Signature" style="max-width:360px;height:auto;display:block;border-bottom:1px solid #2A2A28;padding-bottom:8px;" />`
    : `<div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:2rem;font-style:italic;border-bottom:1px solid #2A2A28;padding-bottom:8px;display:inline-block;min-width:280px;">${escapeHtml(
        signerName
      )}</div>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Signed contract — ${escapeHtml(contract.id)}</title>
  <style>
    body { font-family: Georgia, 'Cormorant Garamond', serif; color: #2A2A28; line-height: 1.7; max-width: 820px; margin: 2rem auto; padding: 0 2rem; background: #FAF9F6; }
    h1, h2, h3 { font-weight: 300; }
    .eyebrow { font-family: -apple-system, system-ui, sans-serif; font-size: 0.7rem; letter-spacing: 0.2em; text-transform: uppercase; color: #6B7845; margin-bottom: 1rem; }
    .appendix { margin-top: 3rem; padding: 1.5rem 2rem; background: #E8EBD8; font-family: -apple-system, system-ui, sans-serif; font-size: 0.82rem; line-height: 1.7; color: #4A4A47; }
    .appendix dt { font-weight: 600; color: #2A2A28; }
    .appendix dd { margin: 0 0 0.6rem 0; word-break: break-all; }
    hr { border: none; border-top: 0.5px solid rgba(42,42,40,0.22); margin: 3rem 0; }
  </style>
</head>
<body>
  <p class="eyebrow">Korrin's Photography — Signed contract</p>
  <div>${contract.renderedHtml}</div>
  <hr />
  <p class="eyebrow">Client signature</p>
  ${sigBlock}
  <p style="font-family: -apple-system, system-ui, sans-serif; font-size: 0.85rem; color: #4A4A47; margin-top: 0.75rem;">
    ${escapeHtml(signerName)} — signed ${escapeHtml(signedAt.toUTCString())}
  </p>
  <div class="appendix">
    <p style="margin:0 0 0.75rem 0;font-weight:600;color:#2A2A28;">Audit trail</p>
    <dl>
      <dt>Contract ID</dt><dd>${escapeHtml(contract.id)}</dd>
      <dt>Signed at (UTC)</dt><dd>${escapeHtml(signedAt.toISOString())}</dd>
      <dt>Signer IP</dt><dd>${escapeHtml(ip ?? "unknown")}</dd>
      <dt>User agent</dt><dd>${escapeHtml(userAgent ?? "unknown")}</dd>
    </dl>
  </div>
</body>
</html>`;
}

/**
 * Direct R2 PUT for the certificate file. We don't reuse the presigned-URL
 * helpers because the body is small (<1MB), we already trust the server, and
 * presigning would just add a hop.
 */
async function uploadCertificateToR2(key: string, html: string): Promise<void> {
  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
  });
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      Key: key,
      Body: html,
      ContentType: "text/html; charset=utf-8",
      Metadata: {
        kind: "signed-contract",
        uploadedAt: new Date().toISOString(),
      },
    })
  );
}

export async function submitSignature(
  contractId: string,
  token: string,
  payload: {
    name: string;
    signatureDataUrl: string | null;
    typedName: string | null;
    agreed: boolean;
  }
): Promise<SignResult> {
  const trimmedName = (payload.name ?? "").trim();
  if (trimmedName.length < 2) {
    return { success: false, error: "Please enter your full legal name." };
  }
  if (!payload.agreed) {
    return { success: false, error: "You must agree to the electronic signature terms." };
  }
  // At least one of drawn or typed signature must be present. The page UI
  // already enforces this, but defend in depth here.
  const hasDrawn = typeof payload.signatureDataUrl === "string" && payload.signatureDataUrl.startsWith("data:image/");
  const hasTyped = typeof payload.typedName === "string" && payload.typedName.trim().length >= 2;
  if (!hasDrawn && !hasTyped) {
    return { success: false, error: "Please draw or type a signature." };
  }

  try {
    const contract = await getContract(contractId);
    if (!contract) {
      return { success: false, error: "Contract not found." };
    }
    if (contract.status === "SIGNED") {
      return { success: false, error: "This contract has already been signed." };
    }
    if (contract.status === "VOIDED") {
      return { success: false, error: "This contract is no longer valid." };
    }
    if (contract.status !== "SENT") {
      return { success: false, error: "This contract is not ready to sign." };
    }

    // Token must match and not be expired. Same check as the page-level
    // gate, repeated here so a stale tab can't bypass it.
    if (!tokensMatch(contract.signingToken, token)) {
      return { success: false, error: "This signing link is no longer valid." };
    }
    if (isTokenExpired(contract)) {
      return { success: false, error: "This signing link has expired." };
    }

    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    const signerIp = fwd ? fwd.split(",")[0].trim() : null;
    const signerUserAgent = h.get("user-agent");

    // Persist a signature representation. Prefer the drawn canvas; fall back
    // to the typed name rendered later as italic text in the certificate.
    const signatureDataUrl = hasDrawn ? payload.signatureDataUrl! : null;
    const signedAt = new Date();

    // Build and upload the completion certificate. Best-effort: if R2 fails
    // we still mark SIGNED so the legal record exists in Firestore; the
    // certificate can be regenerated by an admin tool later.
    const certificateHtml = buildCertificateHtml({
      contract,
      signerName: trimmedName,
      signatureDataUrl,
      signedAt,
      ip: signerIp,
      userAgent: signerUserAgent,
    });
    const r2Key = `contracts/${contractId}/signed.html`;
    let signedPdfR2Key: string | null = null;
    try {
      await uploadCertificateToR2(r2Key, certificateHtml);
      signedPdfR2Key = r2Key;
    } catch (uploadErr) {
      console.error("[submitSignature] Certificate upload failed", uploadErr);
    }

    await contractsCol().doc(contractId).update({
      status: "SIGNED",
      signedAt: Timestamp.fromDate(signedAt),
      signerIp,
      signerUserAgent,
      signerName: trimmedName,
      signerSignatureDataUrl: signatureDataUrl,
      signedTypedName: hasTyped ? payload.typedName!.trim() : trimmedName,
      signedPdfR2Key,
      // Invalidate the token so the same link cannot be replayed.
      signingToken: null,
      tokenExpiresAt: null,
    });

    // Mirror the signed timestamp on the project for the workspace timeline.
    try {
      await adminDb.collection("projects").doc(contract.projectId).update({
        contractSignedAt: Timestamp.fromDate(signedAt),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (projErr) {
      console.error("[submitSignature] Failed to stamp project contractSignedAt", projErr);
    }

    // Best-effort activity log + inbox item — never block signing.
    logActivity("NOTE_ADDED", `Contract signed by ${trimmedName}`, {
      contractId,
      projectId: contract.projectId,
      clientId: contract.clientId,
      kind: "CONTRACT_SIGNED",
    }).catch(() => {});

    createInboxItem({
      type: "CONTRACT_SIGNED",
      projectId: contract.projectId,
      clientId: contract.clientId,
      title: `Contract signed by ${trimmedName}`,
      body: signerIp
        ? `Signed from ${signerIp}. A copy is archived in R2.`
        : `A copy is archived in R2.`,
      link: `/admin/projects/${contract.projectId}`,
      read: false,
    }).catch(() => {});

    // Notify admin via tracked mail. Best-effort.
    if (ADMIN_NOTIFICATION_EMAIL) {
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
      enqueueTrackedMail({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `Contract signed — ${trimmedName}`,
        html: `<p><strong>${escapeHtml(trimmedName)}</strong> just signed their contract.</p>
               <p><a href="${appUrl}/admin/projects/${contract.projectId}">Open project in admin</a></p>`,
        projectId: contract.projectId,
        sendKind: "contract-signed-admin",
      }).catch((err) => console.error("[submitSignature] Admin mail failed", err));
    }

    // Copy-to-client email. Best-effort.
    try {
      const clientSnap = await adminDb.collection("clients").doc(contract.clientId).get();
      const clientEmail = clientSnap.data()?.email;
      if (clientEmail) {
        // The signed copy lives in private R2; we link back to the
        // /sign-contract/ page itself, which will render the "already
        // signed" view and mint a fresh presigned download URL on demand.
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
        const viewUrl = `${appUrl}/sign-contract/${contractId}`;
        await enqueueTrackedMail({
          to: clientEmail,
          subject: "Your signed contract — Korrin's Photography",
          html: `<p>Hi ${escapeHtml(trimmedName.split(" ")[0] ?? "there")},</p>
                 <p>Thank you for signing. A copy of your contract has been archived. You can revisit it any time at the link below.</p>
                 <p><a href="${viewUrl}">View your signed contract</a></p>
                 <p>Best,<br/>Korrin's Photography</p>`,
          recipientClientId: contract.clientId,
          projectId: contract.projectId,
          sendKind: "contract-signed-client",
        });
      }
    } catch (clientMailErr) {
      console.error("[submitSignature] Client copy mail failed", clientMailErr);
    }

    revalidatePath(`/sign-contract/${contractId}`);
    revalidatePath(`/admin/projects/${contract.projectId}`);

    return { success: true, signedAt: signedAt.toLocaleString() };
  } catch (err) {
    console.error("[submitSignature] error", err);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}

