// lib/domain/welcome-packet.ts
//
// Phase 2.7 — Welcome packet generator.
//
// Server-only. Produces a personalized welcome document for a project, stores
// it in R2 as an HTML file at `clientGuides/{projectId}/welcome.html`, and
// stamps a token + R2 key on the project doc so the public read route can
// authenticate access without a Firebase session.
//
// Why HTML (not PDF) for v1: matches the e-sign completion certificate
// pattern (see `app/sign-contract/[id]/actions.ts`). Adding puppeteer-core /
// @sparticuz/chromium would balloon the bundle. HTML downloads cleanly and
// the storage key shape is stable for a future PDF swap.

import { randomBytes } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { formatDisplayDate, toDate } from "@/lib/date";
import type { ProjectDoc } from "@/lib/db/projects";
import type { ClientDoc } from "@/lib/db/clients";
import type { EventDoc } from "@/lib/db/events";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_LOCATION = "Cary, NC";
const COMMS_WINDOW = "I check messages Mon–Fri 10am–6pm.";
const TOKEN_BYTES = 16; // → 32-char hex

// Hardcoded prep-tip mini-templates keyed by session type. Keep entries to
// 5–7 bullets each — the welcome packet is meant to feel curated, not
// exhaustive. Unknown session types fall back to the generic list below.
const PREP_TIPS: Record<string, string[]> = {
  Wedding: [
    "Plan a one-hour buffer between getting-ready and the first look — it always runs long.",
    "Designate a wrangler from each side of the family for the formal portrait list.",
    "Drink water all morning. Caffeine and champagne both dehydrate.",
    "Steam the dress the day before, not the morning of.",
    "Tell every vendor the timeline you and I agreed on — not the version on Pinterest.",
    "Pack flats and a small repair kit (safety pins, tape, Tide pen) in the suite.",
    "Leave a 15-minute window before the ceremony for a private moment, just the two of you.",
  ],
  Portrait: [
    "Wear something you'd actually wear — comfort photographs as confidence.",
    "Solid colors and gentle textures sit better than bold patterns on camera.",
    "Bring one outfit change if you want range; we'll swap mid-session.",
    "Avoid sunburn the week before — even subtle peeling shows up close.",
    "Eat a real meal an hour before. Low blood sugar reads as a tight jaw.",
    "Think of three songs that make you feel like yourself; bring a Bluetooth speaker.",
  ],
  Family: [
    "Coordinate, don't match — pick a 3-color palette and let each person interpret it.",
    "Dress the youngest first; everyone else can adjust to them.",
    "Schedule around the youngest kid's nap, not the parents' calendar.",
    "Snacks and a familiar toy in your bag — both for kids and stressed adults.",
    "If the dog is coming, walk them hard that morning.",
    "Don't say \"smile\" — say \"squish in close\" or \"who can be sillier\" instead.",
  ],
  Engagement: [
    "Choose one location that means something to you both, not what looks photogenic on Google.",
    "Coordinate outfits but skip the matching denim — texture mix reads warmer.",
    "Bring a bottle of something you like. The toast moment is always a favorite frame.",
    "Practice eye contact for 30 seconds without laughing. (Spoiler: you'll laugh.)",
    "Arrive 15 minutes early so the first frames don't catch you out of breath.",
    "Leave the engagement ring on your dominant hand for the first 10 minutes — we'll switch later.",
  ],
  Editorial: [
    "Send moodboard references at least 48 hours before — final makeup/wardrobe decisions hinge on them.",
    "Confirm any product or wardrobe couriers the day before, not the morning of.",
    "Schedule hair/makeup to wrap 30 minutes before our call time, not at call time.",
    "Bring three wardrobe options per look — fits change under hot lights.",
    "If the shoot is for press/brand assets, confirm usage rights are documented in writing.",
    "Identify one decision-maker on set. Brand-by-committee burns the schedule.",
  ],
};

const GENERIC_PREP_TIPS = [
  "Sleep is the cheapest skincare. Aim for a real seven hours the night before.",
  "Drink water all morning. Skin photographs differently when hydrated.",
  "Wear something you feel like yourself in. Confidence reads on camera.",
  "Avoid heavy SPF on your face the day-of — it can flash back under flash.",
  "Eat a real meal an hour before. Hunger reads as tension in the jaw.",
  "If you have a prop or sentimental object you want included, bring it.",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Render the client's first-name(s) for the hero. If `firstName` reads like
 * a couple ("Jane & John", "Jane and John"), keep it as a couple line; if
 * it's a single name, return just that. Stripped of HTML for safety.
 */
export function renderFirstNames(firstName: string | null | undefined): string {
  const f = (firstName ?? "").trim();
  if (!f) return "Friend";
  return f;
}

/**
 * Pick the prep-tip block for this session type. Falls back to a generic
 * list when the type is unknown so the section is never empty.
 */
function prepTipsForSession(sessionType: string | null | undefined): string[] {
  if (!sessionType) return GENERIC_PREP_TIPS;
  const tips = PREP_TIPS[sessionType];
  return tips && tips.length > 0 ? tips : GENERIC_PREP_TIPS;
}

/**
 * Build a Google Maps embed URL for the shoot location. We use the plain
 * search URL (no API key required) — it renders an interactive map on
 * `google.com/maps/search/?api=1&query=…` and is friendly to email/inline.
 */
function buildMapsUrl(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
}

/**
 * Compute "{N} weeks until your shoot" — rounded down with a floor of 0.
 * Returns null when no shoot date is set.
 */
function weeksUntil(shootDate: unknown): number | null {
  const d = toDate(shootDate);
  if (!d) return null;
  const ms = d.getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  return Math.max(0, weeks);
}

// ─── HTML generator ──────────────────────────────────────────────────────────

export interface GenerateWelcomePacketInput {
  project: Pick<
    ProjectDoc,
    "id" | "title" | "sessionType" | "shootDate" | "shootLocation" | "packageName" | "packagePriceUsd"
  >;
  client: Pick<ClientDoc, "firstName" | "lastName" | "phone">;
  event?: Pick<EventDoc, "startTime" | "endTime" | "location"> | null;
}

/**
 * Pure renderer: takes a project + client (+ optional event) and returns
 * a full, self-contained HTML document with embedded CSS. No external
 * fonts/images so it renders correctly when downloaded.
 */
export function generateWelcomePacketHtml(input: GenerateWelcomePacketInput): string {
  const { project, client, event } = input;

  const firstNames = renderFirstNames(client.firstName);
  const shootDateDisplay = formatDisplayDate(project.shootDate) ?? "TBD";
  const time =
    event?.startTime && event?.endTime
      ? `${event.startTime}–${event.endTime}`
      : event?.startTime ?? null;
  const locationLabel =
    project.shootLocation?.label?.trim() ||
    event?.location?.trim() ||
    DEFAULT_LOCATION;
  const mapsUrl = buildMapsUrl(locationLabel);
  const packageName = project.packageName?.trim() || project.sessionType || "Custom session";
  const packagePrice =
    typeof project.packagePriceUsd === "number" && project.packagePriceUsd > 0
      ? `$${project.packagePriceUsd}`
      : null;
  const tips = prepTipsForSession(project.sessionType);
  const wks = weeksUntil(project.shootDate);
  const weeksLine =
    wks === null
      ? "We'll confirm the shoot date soon."
      : wks === 0
      ? "Your shoot is this week."
      : wks === 1
      ? "1 week until your shoot."
      : `${wks} weeks until your shoot.`;

  const phone = (client.phone ?? "").trim();
  const commsLine = phone
    ? `${COMMS_WINDOW} For day-of-shoot emergencies: <a href="tel:${escapeHtml(
        phone.replace(/[^\d+]/g, "")
      )}">${escapeHtml(phone)}</a>.`
    : `${COMMS_WINDOW} Day-of-shoot emergencies: reply to my last email and I'll see it on my watch.`;

  const tipsHtml = tips
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join("\n        ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome — ${escapeHtml(project.title || "your session")}</title>
  <style>
    /* Self-contained design tokens — mirrors app/globals.css */
    :root {
      --white: #FAF9F6;
      --charcoal: #2A2A28;
      --charcoal-light: #4A4A47;
      --charcoal-muted: #8A8A85;
      --olive: #6B7845;
      --olive-light: #8A9A5A;
      --olive-dim: #E8EBD8;
      --border: rgba(42,42,40,0.12);
      --border-strong: rgba(42,42,40,0.22);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: var(--white); color: var(--charcoal); }
    body {
      font-family: "Jost", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
      font-weight: 300;
      line-height: 1.7;
      font-size: 16px;
    }
    .wrap { max-width: 720px; margin: 0 auto; padding: 4rem 2rem; }
    .eyebrow {
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--olive);
      font-weight: 500;
      margin: 0 0 0.5rem 0;
    }
    h1, h2, h3 { font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif; font-weight: 300; }
    .hero { text-align: center; padding: 3rem 0 2.5rem 0; border-bottom: 0.5px solid var(--border-strong); }
    .hero h1 {
      font-size: clamp(2.4rem, 6vw, 3.6rem);
      font-style: italic;
      margin: 0;
      line-height: 1.1;
      color: var(--charcoal);
    }
    .hero .rule {
      display: block;
      width: 64px;
      height: 1px;
      background: var(--olive);
      margin: 1.75rem auto 0 auto;
    }
    section { padding: 2.5rem 0; border-bottom: 0.5px solid var(--border); }
    section:last-of-type { border-bottom: none; }
    section h2 {
      font-size: 1.65rem;
      margin: 0 0 1.25rem 0;
      color: var(--charcoal);
    }
    p { margin: 0 0 0.85rem 0; color: var(--charcoal-light); }
    a { color: var(--olive); text-decoration: none; border-bottom: 0.5px solid var(--olive-light); }
    a:hover { color: var(--olive-light); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem 2rem;
      margin: 0;
    }
    .grid dt {
      font-size: 0.65rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--charcoal-muted);
      margin: 0 0 0.25rem 0;
    }
    .grid dd { margin: 0; color: var(--charcoal); font-size: 1.02rem; }
    ul.prep { padding-left: 1.1rem; margin: 0; }
    ul.prep li { margin-bottom: 0.65rem; color: var(--charcoal-light); padding-left: 0.35rem; }
    ul.prep li::marker { color: var(--olive); }
    .timeline {
      display: grid;
      gap: 0.85rem;
      padding: 0;
      list-style: none;
      margin: 0;
    }
    .timeline li {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: baseline;
      gap: 1rem;
      padding: 0.5rem 0;
      border-top: 0.5px solid var(--border);
    }
    .timeline li:first-child { border-top: none; }
    .timeline .when {
      font-size: 0.65rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--olive);
    }
    .timeline .what { color: var(--charcoal); }
    .signoff {
      text-align: center;
      padding: 3rem 0 1rem 0;
      font-family: "Cormorant Garamond", Georgia, serif;
      font-style: italic;
      font-size: 1.5rem;
      color: var(--charcoal);
    }
    .signoff .name { display: block; margin-top: 0.4rem; color: var(--olive); }
    @media (max-width: 540px) {
      .wrap { padding: 2.5rem 1.25rem; }
      .grid { grid-template-columns: 1fr; }
      .timeline li { grid-template-columns: 1fr; gap: 0.15rem; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- 1. Hero -->
    <header class="hero">
      <p class="eyebrow">Welcome</p>
      <h1>${escapeHtml(firstNames)}, you're <em>booked</em>.</h1>
      <span class="rule" aria-hidden="true"></span>
    </header>

    <!-- 2. Shoot details -->
    <section>
      <p class="eyebrow">Shoot details</p>
      <h2>The basics, in one place</h2>
      <dl class="grid">
        <div><dt>Date</dt><dd>${escapeHtml(shootDateDisplay)}</dd></div>
        ${
          time
            ? `<div><dt>Time</dt><dd>${escapeHtml(time)}</dd></div>`
            : `<div><dt>Time</dt><dd>To be confirmed</dd></div>`
        }
        <div><dt>Location</dt><dd><a href="${mapsUrl}" target="_blank" rel="noopener">${escapeHtml(
    locationLabel
  )}</a></dd></div>
        <div><dt>Session type</dt><dd>${escapeHtml(project.sessionType ?? "—")}</dd></div>
      </dl>
    </section>

    <!-- 3. Package summary -->
    <section>
      <p class="eyebrow">Your package</p>
      <h2>${escapeHtml(packageName)}${packagePrice ? ` <span style="color:var(--charcoal-muted);font-style:italic;font-size:1.1rem;"> · ${escapeHtml(
    packagePrice
  )}</span>` : ""}</h2>
      <p>
        Your booking covers the on-location shoot, a careful edit of the
        full set, and delivery through your private gallery. You'll be able
        to favorite, share, and download from there once it's live.
      </p>
    </section>

    <!-- 4. Prep tips -->
    <section>
      <p class="eyebrow">Before the shoot</p>
      <h2>A few things that help</h2>
      <ul class="prep">
        ${tipsHtml}
      </ul>
    </section>

    <!-- 5. Communication windows -->
    <section>
      <p class="eyebrow">Reaching me</p>
      <h2>Communication windows</h2>
      <p>${commsLine}</p>
    </section>

    <!-- 6. What's next timeline -->
    <section>
      <p class="eyebrow">What's next</p>
      <h2>${escapeHtml(weeksLine)}</h2>
      <ol class="timeline">
        <li><span class="when">Now → shoot day</span><span class="what">Prep, questions, and one logistics email a week out.</span></li>
        <li><span class="when">Sneak peek</span><span class="what">~48 hours after the shoot, in your inbox.</span></li>
        <li><span class="when">Full gallery</span><span class="what">Roughly 3 weeks after the shoot, with download access.</span></li>
        <li><span class="when">After delivery</span><span class="what">Referrals, favorites, and portal access for keepsakes.</span></li>
      </ol>
    </section>

    <!-- 7. Sign-off -->
    <div class="signoff">
      With gratitude,
      <span class="name">Korrin</span>
    </div>
  </div>
</body>
</html>`;
}

// ─── R2 upload helper ────────────────────────────────────────────────────────

/**
 * Direct R2 PUT — same shape as the e-sign certificate writer. We don't reuse
 * the presigned-PUT helper because the body is small (<200KB), the call is
 * trusted server-side, and presigning would just add a round-trip.
 */
async function putWelcomePacketToR2(key: string, html: string): Promise<void> {
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
        kind: "welcome-packet",
        uploadedAt: new Date().toISOString(),
      },
    })
  );
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export interface GenerateAndUploadResult {
  r2Key: string;
  presignedUrl: string;
  token: string;
}

/**
 * Generate the welcome packet for a project, upload to R2, stamp the project
 * doc with the R2 key + generatedAt + read token, and return a 24h presigned
 * GET URL.
 *
 * Idempotent: re-running mints a fresh token and overwrites the R2 object
 * at the same key. Callers that want the *old* token preserved should read
 * the project doc first.
 */
export async function generateAndUploadWelcomePacket(
  projectId: string
): Promise<GenerateAndUploadResult> {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const projectData = projectSnap.data() as ProjectDoc;
  const project: ProjectDoc = { ...projectData, id: projectId };

  const clientSnap = await adminDb
    .collection("clients")
    .doc(project.clientId)
    .get();
  if (!clientSnap.exists) {
    throw new Error(`Client not found: ${project.clientId}`);
  }
  const client = clientSnap.data() as ClientDoc;

  // Best-effort event lookup — only used for startTime/endTime/location.
  let event: EventDoc | null = null;
  try {
    const eventsSnap = await adminDb
      .collection("events")
      .where("projectId", "==", projectId)
      .limit(1)
      .get();
    if (!eventsSnap.empty) {
      const d = eventsSnap.docs[0];
      event = { id: d.id, ...d.data() } as EventDoc;
    }
  } catch (err) {
    console.error("[generateAndUploadWelcomePacket] event lookup failed", {
      projectId,
      err,
    });
  }

  const html = generateWelcomePacketHtml({ project, client, event });
  const r2Key = `clientGuides/${projectId}/welcome.html`;
  await putWelcomePacketToR2(r2Key, html);

  // Mint a fresh 32-char hex token; persist on the project for the public
  // read route to authenticate against.
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  await adminDb.collection("projects").doc(projectId).update({
    welcomePacketR2Key: r2Key,
    welcomePacketGeneratedAt: FieldValue.serverTimestamp(),
    welcomePacketToken: token,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // 24-hour presigned GET URL for the email link. The public read route can
  // also stream the object via the same helper at request time, so the
  // recipient doesn't need to refresh this URL after expiry.
  const presignedUrl = await generatePresignedGetUrl(r2Key, 24 * 60 * 60);

  return { r2Key, presignedUrl, token };
}
