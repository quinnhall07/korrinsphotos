// lib/db/broadcasts.ts
// Persistence + HTML rendering for `broadcasts/{id}`. A broadcast is a
// block-based composed email targeted at a saved segment. Sends go through
// `lib/email/tracking.ts > enqueueTrackedMail` so every recipient gets a
// unique sendId for per-recipient open/click attribution.
//
// Server-only: imports `adminDb`. Never import from a "use client" file.

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// ─── Block schema ────────────────────────────────────────────────────────────

export type BroadcastBlock =
  | { type: "hero"; title: string; subtitle?: string }
  | { type: "imageGrid"; imageUrls: string[] }
  | { type: "text"; html: string }
  | { type: "cta"; label: string; href: string }
  | { type: "footer"; text: string };

export type BroadcastStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT";

export interface BroadcastDoc {
  id: string;
  name: string;
  segmentId: string;
  subject: string;
  blocks: BroadcastBlock[];
  status: BroadcastStatus;
  scheduledFor?: Timestamp | null;
  sentAt?: Timestamp | null;
  recipientCount?: number | null;
  sentCount?: number | null;
  /** Per-recipient sendId — keyed by clientId. Lets us roll up engagement
   *  events (`emailEvents.where("sendId", "in", values)`) per broadcast. */
  sendIdsByRecipient?: Record<string, string> | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const broadcastsCol = () => adminDb.collection("broadcasts");

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getBroadcast(id: string): Promise<BroadcastDoc | null> {
  const snap = await broadcastsCol().doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as BroadcastDoc) : null;
}

export async function listBroadcasts(): Promise<BroadcastDoc[]> {
  const snap = await broadcastsCol().orderBy("createdAt", "desc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BroadcastDoc));
}

export async function createBroadcast(
  data: Omit<BroadcastDoc, "id" | "createdAt" | "updatedAt">
): Promise<BroadcastDoc> {
  const ref = broadcastsCol().doc();
  const now = Timestamp.now();
  const fullData = { ...data, createdAt: now, updatedAt: now };
  await ref.set(fullData);
  return { id: ref.id, ...fullData } as BroadcastDoc;
}

export async function updateBroadcast(
  id: string,
  data: Partial<Omit<BroadcastDoc, "id" | "createdAt">>
): Promise<void> {
  await broadcastsCol().doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteBroadcast(id: string): Promise<void> {
  await broadcastsCol().doc(id).delete();
}

/**
 * Mark a broadcast as in-flight. Idempotency guard: rejects (returns false)
 * if the doc is already SENDING or SENT so a duplicate cron tick can't
 * double-fire the same broadcast.
 */
export async function markBroadcastSending(id: string): Promise<boolean> {
  const ref = broadcastsCol().doc(id);
  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const status = (snap.data() as BroadcastDoc).status;
    if (status === "SENDING" || status === "SENT") return false;
    tx.update(ref, {
      status: "SENDING",
      updatedAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

/**
 * Finalise a broadcast after the send loop completes.
 */
export async function markBroadcastSent(
  id: string,
  data: {
    recipientCount: number;
    sentCount: number;
    sendIdsByRecipient: Record<string, string>;
  }
): Promise<void> {
  await broadcastsCol().doc(id).update({
    status: "SENT",
    sentAt: FieldValue.serverTimestamp(),
    recipientCount: data.recipientCount,
    sentCount: data.sentCount,
    sendIdsByRecipient: data.sendIdsByRecipient,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Drained by `dispatchScheduledBroadcasts(now)` in the cron route. Returns
 * docs where `status == "SCHEDULED"` and `scheduledFor <= now`.
 */
export async function listDueScheduledBroadcasts(
  now: Date
): Promise<BroadcastDoc[]> {
  const snap = await broadcastsCol()
    .where("status", "==", "SCHEDULED")
    .where("scheduledFor", "<=", Timestamp.fromDate(now))
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BroadcastDoc));
}

// ─── HTML renderer ───────────────────────────────────────────────────────────

/**
 * Walk the block list and emit a clean responsive HTML email. The output is
 * table-based for Outlook/Gmail compatibility and uses inline styles
 * (most email clients strip `<style>` blocks).
 *
 * The shell is wrapped in `<html><body>` so `enqueueTrackedMail` can locate
 * `</body>` when injecting the tracking pixel. External link tracking is
 * applied later by `rewriteLinks` in the same module — every `<a href>` we
 * emit here should point at the canonical target URL, not a pre-rewrapped
 * tracker URL.
 */
export function renderBroadcastHtml(broadcast: {
  subject: string;
  blocks: BroadcastBlock[];
}): string {
  const blocksHtml = broadcast.blocks.map(renderBlock).join("\n");

  // 620px is the de-facto safe content width for desktop + Gmail clipping.
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(broadcast.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FAF9F6;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#2A2A28;-webkit-font-smoothing:antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F6;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="max-width:620px;width:100%;background:#FFFFFF;border:0.5px solid rgba(42,42,40,0.12);">
${blocksHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderBlock(block: BroadcastBlock): string {
  switch (block.type) {
    case "hero":
      return renderHero(block);
    case "imageGrid":
      return renderImageGrid(block);
    case "text":
      return renderText(block);
    case "cta":
      return renderCta(block);
    case "footer":
      return renderFooter(block);
    default: {
      // Exhaustiveness — unknown block type renders nothing.
      const _exhaustive: never = block;
      void _exhaustive;
      return "";
    }
  }
}

function renderHero(block: { title: string; subtitle?: string }): string {
  const subtitle = block.subtitle
    ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#4A4A47;letter-spacing:0.04em;">${escapeHtml(
        block.subtitle
      )}</p>`
    : "";
  return `          <tr>
            <td style="padding:48px 40px 24px;text-align:center;border-bottom:0.5px solid rgba(42,42,40,0.12);">
              <h1 style="margin:0;font-family:Georgia,'Cormorant Garamond',serif;font-size:32px;font-weight:300;line-height:1.2;color:#2A2A28;">${escapeHtml(
                block.title
              )}</h1>
              ${subtitle}
            </td>
          </tr>`;
}

function renderImageGrid(block: { imageUrls: string[] }): string {
  const urls = block.imageUrls.filter((u) => typeof u === "string" && u.trim());
  if (urls.length === 0) return "";
  // Two-column layout for >= 2 images, single column for 1.
  if (urls.length === 1) {
    return `          <tr>
            <td style="padding:24px 40px;text-align:center;">
              <img src="${escapeHtmlAttr(urls[0])}" alt="" width="540" style="max-width:100%;height:auto;display:block;margin:0 auto;border:0;" />
            </td>
          </tr>`;
  }
  // Group every 2 URLs into a row.
  const rows: string[] = [];
  for (let i = 0; i < urls.length; i += 2) {
    const row = urls
      .slice(i, i + 2)
      .map(
        (u) =>
          `              <td width="50%" style="padding:6px;text-align:center;"><img src="${escapeHtmlAttr(
            u
          )}" alt="" width="260" style="max-width:100%;height:auto;display:block;border:0;" /></td>`
      )
      .join("\n");
    rows.push(`            <tr>\n${row}\n            </tr>`);
  }
  return `          <tr>
            <td style="padding:18px 34px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rows.join("\n")}
              </table>
            </td>
          </tr>`;
}

function renderText(block: { html: string }): string {
  // The text block accepts admin-authored HTML. We trust admin input — this
  // composer is admin-only — but defensively strip <script> tags so a paste
  // from a sketchy source can't ship JavaScript to recipients (most mail
  // clients block it anyway, but belt + suspenders).
  const safe = stripScripts(block.html ?? "");
  return `          <tr>
            <td style="padding:20px 40px;font-size:15px;line-height:1.7;color:#2A2A28;">
              ${safe}
            </td>
          </tr>`;
}

function renderCta(block: { label: string; href: string }): string {
  return `          <tr>
            <td style="padding:24px 40px 32px;text-align:center;">
              <a href="${escapeHtmlAttr(block.href)}"
                 style="display:inline-block;padding:14px 36px;background:#6B7845;color:#FFFFFF;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-family:Helvetica,Arial,sans-serif;border:none;">
                ${escapeHtml(block.label)}
              </a>
            </td>
          </tr>`;
}

function renderFooter(block: { text: string }): string {
  return `          <tr>
            <td style="padding:24px 40px 32px;border-top:0.5px solid rgba(42,42,40,0.12);font-size:12px;line-height:1.6;color:#8A8A85;text-align:center;letter-spacing:0.04em;">
              ${escapeHtml(block.text)}
            </td>
          </tr>`;
}

// ─── Escape helpers ──────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, "&#96;");
}

function stripScripts(html: string): string {
  return String(html ?? "").replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ""
  );
}
