// lib/email/tracking.ts
// Phase 1.6 / 4.3 — Outbound mail wrapper that:
//   1) Mints a unique sendId per email.
//   2) Rewrites every external <a href="…"> in the HTML so clicks pass
//      through `/t/c/{sendId}?u=<base64url(target)>`.
//   3) Appends a 1×1 tracking pixel pointing at `/t/o/{sendId}`.
//   4) Inserts an `emailEvents` row of type "sent".
//   5) Enqueues the rewritten message into the existing `mail/` collection
//      (the Firebase Trigger Email extension still delivers).
//
// This is the only place that should call `adminDb.collection("mail").add(…)`
// in the entire codebase. Every other call site must route through here so we
// capture engagement on every send. See `docs/architecture/business-dashboard-roadmap.md`
// §4.3 for the design.
//
// Server-only. Imports `adminDb` (transitively, via lib/db/email-events).

import { randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { createEmailEvent } from "@/lib/db/email-events";

export interface TrackedMailInput {
  to: string;
  subject: string;
  html: string;
  /** Optional plain-text alternative — passed straight through to the
   *  `mail/` doc. Not link-tracked: we only rewrite the html part. */
  text?: string;
  recipientClientId?: string | null;
  projectId?: string | null;
  /** Free-form classifier for grouping sends (e.g. "auto-responder",
   *  "contract", "invoice", "review-request"). Persisted on the emailEvents
   *  "sent" row so dashboards can compute per-kind open/click rates. */
  sendKind?: string | null;
}

export interface TrackedMailResult {
  sendId: string;
}

/** 16 random bytes → 32-char hex. The sendId is opaque; it shows up in the
 *  email pixel URL and click URLs, so we don't want it guessable. */
function newSendId(): string {
  return randomBytes(16).toString("hex");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");
}

/**
 * Base64URL — RFC 4648 §5. Buffer.toString("base64") produces standard
 * base64; we strip the padding and swap `+/` for `-_` so the value is safe
 * inside a URL query string without further encoding.
 */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(input: string): string {
  // Restore padding + standard alphabet.
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad === 2) s += "==";
  else if (pad === 3) s += "=";
  else if (pad !== 0) throw new Error("Invalid base64url length");
  return Buffer.from(s, "base64").toString("utf8");
}

/**
 * Decide whether a given href should be rewritten. We only rewrap absolute
 * http/https URLs that are NOT our own internal routes — both because
 *   a) we don't want to double-track our own click trackers (`/r/review/*`,
 *      `/t/c/*`), and
 *   b) internal routes can carry session-bearing query params or cookies
 *      that we don't want to leak through a redirect that strips cookies.
 *
 * We also skip `mailto:` / `tel:` / `javascript:` / fragments — anything
 * that isn't `http(s)://…` stays untouched.
 */
function shouldRewriteHref(href: string, ownOrigin: string): boolean {
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const u = new URL(trimmed);
    // Compare origin (protocol + host + port) — case-insensitive on host.
    const own = new URL(ownOrigin);
    if (u.host.toLowerCase() === own.host.toLowerCase()) {
      // Internal — never rewrite.
      return false;
    }
    return true;
  } catch {
    // Malformed URL — leave it alone.
    return false;
  }
}

/**
 * Rewrite all qualifying `href="…"` attributes inside an HTML string to
 * route through `/t/c/{sendId}?u=<base64url>`. The regex is intentionally
 * permissive — it matches `href="…"`, `href='…'`, and `href=…` (unquoted).
 * Anchors whose href fails `shouldRewriteHref` are left as-is.
 *
 * NOTE: this is not a full HTML parser. It is a heuristic rewrite that
 * handles every email-friendly anchor we emit. If an email template ever
 * embeds an `<area>`/`<link>` we want to track, extend the regex.
 */
export function rewriteLinks(html: string, sendId: string): string {
  const origin = appUrl();
  const tracker = `${origin}/t/c/${sendId}`;
  // Capture the opening `<a `, then any attributes, then the href, then
  // continue. Process href values whether quoted or bare.
  return html.replace(
    /(<a\b[^>]*?\bhref\s*=\s*)("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (full, prefix: string, _whole: string, dq?: string, sq?: string, bare?: string) => {
      const raw = dq ?? sq ?? bare ?? "";
      if (!shouldRewriteHref(raw, origin)) return full;
      const encoded = base64UrlEncode(raw);
      const wrapped = `${tracker}?u=${encoded}`;
      return `${prefix}"${wrapped}"`;
    }
  );
}

/**
 * Append a 1×1 transparent tracking pixel to the html. The pixel src is an
 * absolute URL (mail clients can't resolve relative URLs). If a `</body>` tag
 * exists, the pixel is inserted just before it; otherwise it's appended.
 */
export function injectTrackingPixel(html: string, sendId: string): string {
  const pixel = `<img src="${appUrl()}/t/o/${sendId}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;
  const idx = html.toLowerCase().lastIndexOf("</body>");
  if (idx >= 0) {
    return html.slice(0, idx) + pixel + html.slice(idx);
  }
  return html + pixel;
}

/**
 * Tracked-mail enqueue. Returns the generated `sendId` so call sites can
 * persist it on the originating Message/Invoice/Contract doc — this enables
 * the Messages-tab engagement chips and the per-doc open/click rollup.
 */
export async function enqueueTrackedMail(
  input: TrackedMailInput
): Promise<TrackedMailResult> {
  const sendId = newSendId();

  // 1. Rewrite + inject. Order matters: rewrite anchors first, then drop the
  //    pixel so the pixel itself never gets rewritten by accident (the pixel
  //    isn't an <a>, but be defensive).
  const rewritten = rewriteLinks(input.html, sendId);
  const finalHtml = injectTrackingPixel(rewritten, sendId);

  // 2. Stamp the "sent" event. Best-effort — never block the email send if
  //    Firestore is slow / down.
  try {
    await createEmailEvent({
      sendId,
      recipientEmail: input.to,
      type: "sent",
      recipientClientId: input.recipientClientId ?? null,
      projectId: input.projectId ?? null,
      sendKind: input.sendKind ?? null,
    });
  } catch (err) {
    console.error("[enqueueTrackedMail] failed to write 'sent' event", { sendId, err });
  }

  // 3. Enqueue into the existing `mail/` queue. The Firebase Trigger Email
  //    extension watches this collection and delivers.
  const messagePayload: Record<string, unknown> = {
    subject: input.subject,
    html: finalHtml,
  };
  if (input.text !== undefined) messagePayload.text = input.text;

  await adminDb.collection("mail").add({
    to: input.to,
    message: messagePayload,
    createdAt: FieldValue.serverTimestamp(),
    // Persist sendId on the mail doc itself too — makes it possible to
    // correlate a delivery failure (logged by the extension on the same
    // mail/{id} doc) back to the sendId in our events stream.
    sendId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.recipientClientId ? { recipientClientId: input.recipientClientId } : {}),
    ...(input.sendKind ? { sendKind: input.sendKind } : {}),
  });

  return { sendId };
}
