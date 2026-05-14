// lib/domain/shoot-brief.ts
//
// Phase 3.4 — Shoot brief auto-generator.
//
// 24h before each shoot the cron worker enqueues a `SHOOT_BRIEF` scheduled
// task. The handler calls `dispatchShootBriefEmail()` which:
//   1) Composes a self-contained HTML brief (this file's `generateShootBriefHtml`).
//   2) Uploads it to R2 at `shoot-briefs/{projectId}/{ts}.html`.
//   3) Stamps `shootBriefR2Key` + `shootBriefGeneratedAt` on the project doc.
//   4) Emails Korrin a presigned 8h GET link through `enqueueTrackedMail`.
//
// Server-only. Defensive against missing/partial data: if weather, vendors,
// questionnaire, or gear data are unavailable, the brief renders a graceful
// "not yet" line for that section rather than crashing.

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { generatePresignedGetUrl } from "@/lib/storage/r2";
import { formatDisplayDate, formatDateTime, toDate } from "@/lib/date";
import { computeSunTimes, formatSunTimes } from "@/lib/golden-hour";
import { enqueueTrackedMail } from "@/lib/email/tracking";
import { listQuestionnairesForProject, getTemplate } from "@/lib/db/questionnaires";
import {
  listVendors,
  VENDOR_CATEGORIES,
  type VendorDoc,
  type VendorCategory,
} from "@/lib/db/vendors";
import type { ProjectDoc, WeatherSnapshot } from "@/lib/db/projects";
import type { ClientDoc } from "@/lib/db/clients";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRESIGN_TTL_SECONDS = 8 * 60 * 60; // 8h

const VENDOR_CATEGORY_LABELS: Record<VendorCategory, string> = {
  VENUE: "Venue",
  PLANNER: "Planner",
  FLORIST: "Florist",
  HMUA: "Hair / Makeup",
  VIDEOGRAPHER: "Videographer",
  DJ: "DJ",
  OFFICIANT: "Officiant",
  RENTALS: "Rentals",
  CATERER: "Caterer",
  BAKER: "Baker",
  STATIONERY: "Stationery",
  OTHER: "Other",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safe(s: string | null | undefined, fallback = "—"): string {
  const t = (s ?? "").trim();
  return t ? escapeHtml(t) : escapeHtml(fallback);
}

function adminEmail(): string | null {
  const fromList = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return fromList || process.env.ADMIN_EMAIL || null;
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://korrinsphotos.com").replace(/\/$/, "");
}

// ─── Section renderers (pure) ────────────────────────────────────────────────

function renderClientSection(client: ClientDoc | null): string {
  if (!client) {
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Client record not found.</p>`;
  }
  const name = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "—";
  const phone = (client.phone ?? "").trim();
  const phoneCell = phone
    ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>`
    : "—";
  const emailCell = client.email
    ? `<a href="mailto:${escapeHtml(client.email)}">${escapeHtml(client.email)}</a>`
    : "—";
  return `
    <dl class="grid">
      <div><dt>Name</dt><dd>${escapeHtml(name)}</dd></div>
      <div><dt>Phone</dt><dd>${phoneCell}</dd></div>
      <div><dt>Email</dt><dd>${emailCell}</dd></div>
    </dl>`;
}

function renderProjectSection(project: ProjectDoc): string {
  const shootDate = formatDisplayDate(project.shootDate) ?? "TBD";
  const shootEnd = formatDisplayDate(project.shootEndDate);
  const dateLine = shootEnd && shootEnd !== shootDate ? `${shootDate} → ${shootEnd}` : shootDate;
  const pkg = (project.packageName ?? "").trim() || project.sessionType || "Custom session";
  const price =
    typeof project.packagePriceUsd === "number" && project.packagePriceUsd > 0
      ? `$${project.packagePriceUsd}`
      : "—";
  return `
    <dl class="grid">
      <div><dt>Title</dt><dd>${safe(project.title)}</dd></div>
      <div><dt>Session type</dt><dd>${safe(project.sessionType)}</dd></div>
      <div><dt>Shoot date</dt><dd>${escapeHtml(dateLine)}</dd></div>
      <div><dt>Package</dt><dd>${safe(pkg)}</dd></div>
      <div><dt>Price</dt><dd>${escapeHtml(price)}</dd></div>
    </dl>`;
}

function renderLocationSection(project: ProjectDoc): string {
  const loc = project.shootLocation;
  if (!loc || !loc.label?.trim()) {
    return `<p style="color:var(--charcoal-muted);font-style:italic;">No location set</p>`;
  }
  const label = loc.label.trim();
  const notes = (loc.notes ?? "").trim();
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  return `
    <p style="margin:0 0 0.5rem 0;">
      <a href="${mapsUrl}" target="_blank" rel="noopener">${escapeHtml(label)}</a>
    </p>
    ${notes ? `<p style="color:var(--charcoal-light);margin:0;">${escapeHtml(notes)}</p>` : ""}`;
}

function renderWeatherSection(snap: WeatherSnapshot | undefined): string {
  if (!snap) {
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Weather not yet fetched</p>`;
  }
  const fetched = formatDateTime(snap.fetchedAt);
  const tempVal = typeof snap.temp === "number" ? `${Math.round(snap.temp)}°F` : "—";
  const feelsLike =
    typeof snap.feelsLike === "number" ? `${Math.round(snap.feelsLike)}°F` : null;
  const precip =
    typeof snap.precipChance === "number" ? `${Math.round(snap.precipChance)}%` : null;
  const wind = typeof snap.windMph === "number" ? `${Math.round(snap.windMph)} mph` : null;
  const friendly =
    typeof snap.isOutdoorFriendly === "boolean"
      ? snap.isOutdoorFriendly
        ? "Outdoor-friendly"
        : "Indoor-leaning"
      : null;
  return `
    <dl class="grid">
      <div><dt>Forecast</dt><dd>${safe(snap.conditions)}</dd></div>
      <div><dt>Temp</dt><dd>${escapeHtml(tempVal)}</dd></div>
      ${feelsLike ? `<div><dt>Feels like</dt><dd>${escapeHtml(feelsLike)}</dd></div>` : ""}
      ${precip ? `<div><dt>Precip chance</dt><dd>${escapeHtml(precip)}</dd></div>` : ""}
      ${wind ? `<div><dt>Wind</dt><dd>${escapeHtml(wind)}</dd></div>` : ""}
      ${friendly ? `<div><dt>Verdict</dt><dd>${escapeHtml(friendly)}</dd></div>` : ""}
      ${fetched ? `<div><dt>Fetched</dt><dd>${escapeHtml(fetched)}</dd></div>` : ""}
    </dl>`;
}

function renderGoldenHourSection(project: ProjectDoc): string {
  const date = toDate(project.shootDate);
  const lat = project.shootLocation?.lat;
  const lng = project.shootLocation?.lng;
  if (!date || typeof lat !== "number" || typeof lng !== "number") {
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Golden hour requires shoot date + location coordinates</p>`;
  }
  // Dynamic import keeps this leaf-level — the helper is pure but lives outside
  // the lib/db layer, so we wrap it in try/catch for absolute safety.
  try {
    const times = computeSunTimes(date, lat, lng);
    const summary = formatSunTimes(times);
    return `<p style="margin:0;">${escapeHtml(summary)}</p>`;
  } catch (err) {
    console.error("[shoot-brief] golden-hour compute failed", err);
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Golden hour calculation failed</p>`;
  }
}

async function renderQuestionnaireSection(projectId: string): Promise<string> {
  try {
    const all = await listQuestionnairesForProject(projectId);
    const completed = all
      .filter((q) => q.status === "COMPLETED")
      .sort((a, b) => {
        const ax = toDate(a.completedAt)?.getTime() ?? 0;
        const bx = toDate(b.completedAt)?.getTime() ?? 0;
        return bx - ax;
      })[0];
    if (!completed) {
      return `<p style="color:var(--charcoal-muted);font-style:italic;">Questionnaire not yet returned</p>`;
    }
    const template = await getTemplate(completed.templateId).catch(() => null);
    const labelById = new Map<string, string>();
    if (template) {
      for (const q of template.questions) labelById.set(q.id, q.label);
    }
    const rows = Object.entries(completed.responses ?? {}).map(([key, value]) => {
      const label = labelById.get(key) ?? key;
      const display = Array.isArray(value)
        ? value.map((v) => String(v)).join(", ")
        : value == null
        ? "—"
        : String(value);
      return `
        <div class="qa">
          <p class="qa-q">${escapeHtml(label)}</p>
          <p class="qa-a">${escapeHtml(display) || "—"}</p>
        </div>`;
    });
    if (rows.length === 0) {
      return `<p style="color:var(--charcoal-muted);font-style:italic;">No responses recorded.</p>`;
    }
    return rows.join("\n");
  } catch (err) {
    console.error("[shoot-brief] questionnaire load failed", err);
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Questionnaire unavailable</p>`;
  }
}

async function renderVendorSection(projectId: string): Promise<string> {
  try {
    // VendorDoc currently has no canonical project-link field. We probe for
    // `linkedProjectIds: string[]` (the documented Phase 3.8 shape) by reading
    // raw vendor docs and array-contains-checking the project id; vendors
    // without the field are simply excluded.
    const vendors: VendorDoc[] = await listVendors();
    const linked = vendors.filter((v) => {
      const ids = (v as unknown as { linkedProjectIds?: unknown }).linkedProjectIds;
      return Array.isArray(ids) && ids.includes(projectId);
    });
    if (linked.length === 0) {
      return `<p style="color:var(--charcoal-muted);font-style:italic;">No vendors linked to this project</p>`;
    }
    const byCategory = new Map<VendorCategory, VendorDoc[]>();
    for (const v of linked) {
      const cat = v.category ?? "OTHER";
      const bucket = byCategory.get(cat) ?? [];
      bucket.push(v);
      byCategory.set(cat, bucket);
    }
    const groupBlocks: string[] = [];
    for (const cat of VENDOR_CATEGORIES) {
      const group = byCategory.get(cat);
      if (!group || group.length === 0) continue;
      const rows = group
        .map((v) => {
          const phone = (v.phone ?? "").trim();
          const phoneCell = phone
            ? `<a href="tel:${escapeHtml(phone.replace(/[^\d+]/g, ""))}">${escapeHtml(phone)}</a>`
            : "—";
          return `
            <li>
              <span class="v-name">${safe(v.name)}</span>
              <span class="v-phone">${phoneCell}</span>
              <span class="v-role">${escapeHtml(VENDOR_CATEGORY_LABELS[cat])}</span>
            </li>`;
        })
        .join("");
      groupBlocks.push(`
        <div class="v-group">
          <p class="v-cat">${escapeHtml(VENDOR_CATEGORY_LABELS[cat])}</p>
          <ul class="v-list">${rows}</ul>
        </div>`);
    }
    return groupBlocks.join("\n");
  } catch (err) {
    console.error("[shoot-brief] vendor load failed", err);
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Vendor list unavailable</p>`;
  }
}

async function renderGearSection(projectId: string): Promise<string> {
  try {
    // Subcollection access is path-only; we DELIBERATELY do not import from
    // `lib/db/gear-log` because sibling-agent B may not have shipped that
    // helper module yet. The subcollection path works regardless.
    const snap = await adminDb
      .collection("projects")
      .doc(projectId)
      .collection("gearLog")
      .get();
    if (snap.empty) {
      return `<p style="color:var(--charcoal-muted);font-style:italic;">Gear log not yet initialized</p>`;
    }
    const items = snap.docs.map((d) => {
      const data = d.data() as {
        name?: string;
        category?: string;
        packed?: boolean;
        required?: boolean;
        notes?: string;
      };
      const name = (data.name ?? "").trim() || d.id;
      const status = data.packed ? "Packed" : data.required ? "Required" : "Optional";
      const cat = (data.category ?? "").trim();
      const notes = (data.notes ?? "").trim();
      const detail = [cat, notes].filter(Boolean).join(" · ");
      return `
        <li>
          <span class="g-name">${escapeHtml(name)}</span>
          <span class="g-status">${escapeHtml(status)}</span>
          ${detail ? `<span class="g-notes">${escapeHtml(detail)}</span>` : ""}
        </li>`;
    });
    return `<ul class="g-list">${items.join("")}</ul>`;
  } catch (err) {
    console.error("[shoot-brief] gear log load failed", err);
    return `<p style="color:var(--charcoal-muted);font-style:italic;">Gear log unavailable</p>`;
  }
}

// ─── HTML shell ──────────────────────────────────────────────────────────────

interface BriefSections {
  client: string;
  project: string;
  location: string;
  weather: string;
  goldenHour: string;
  questionnaire: string;
  vendors: string;
  gear: string;
}

function buildHtmlDocument(title: string, generatedAt: string, sections: BriefSections): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Shoot brief — ${escapeHtml(title)}</title>
  <style>
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
      line-height: 1.65;
      font-size: 15px;
    }
    .wrap { max-width: 760px; margin: 0 auto; padding: 3.5rem 2rem; }
    .eyebrow {
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--olive);
      font-weight: 500;
      margin: 0 0 0.5rem 0;
    }
    h1, h2, h3 { font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif; font-weight: 300; }
    .hero { padding: 0 0 2rem 0; border-bottom: 0.5px solid var(--border-strong); }
    .hero h1 {
      font-size: clamp(2rem, 4.5vw, 2.8rem);
      font-style: italic;
      margin: 0;
      line-height: 1.15;
      color: var(--charcoal);
    }
    .hero .meta {
      margin-top: 0.65rem;
      color: var(--charcoal-muted);
      font-size: 0.78rem;
      letter-spacing: 0.05em;
    }
    section { padding: 2rem 0; border-bottom: 0.5px solid var(--border); }
    section:last-of-type { border-bottom: none; }
    section h2 {
      font-size: 1.4rem;
      margin: 0 0 1rem 0;
      color: var(--charcoal);
    }
    a { color: var(--olive); text-decoration: none; border-bottom: 0.5px solid var(--olive-light); }
    a:hover { color: var(--olive-light); }
    p { margin: 0 0 0.75rem 0; color: var(--charcoal-light); }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.1rem 1.8rem;
      margin: 0;
    }
    .grid dt {
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--charcoal-muted);
      margin: 0 0 0.2rem 0;
    }
    .grid dd { margin: 0; color: var(--charcoal); font-size: 0.98rem; }
    .qa { padding: 0.65rem 0; border-top: 0.5px solid var(--border); }
    .qa:first-of-type { border-top: none; padding-top: 0; }
    .qa-q {
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--charcoal-muted);
      margin: 0 0 0.2rem 0;
    }
    .qa-a { margin: 0; color: var(--charcoal); font-size: 0.95rem; }
    .v-group { margin-bottom: 1rem; }
    .v-cat {
      font-size: 0.6rem;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--olive);
      margin: 0 0 0.4rem 0;
    }
    .v-list { list-style: none; padding: 0; margin: 0; }
    .v-list li {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      gap: 0.75rem;
      padding: 0.4rem 0;
      border-top: 0.5px solid var(--border);
      font-size: 0.9rem;
    }
    .v-list li:first-child { border-top: none; }
    .v-name { color: var(--charcoal); }
    .v-phone { color: var(--charcoal-light); }
    .v-role { color: var(--charcoal-muted); font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .g-list { list-style: none; padding: 0; margin: 0; }
    .g-list li {
      padding: 0.5rem 0;
      border-top: 0.5px solid var(--border);
      display: grid;
      grid-template-columns: 1.4fr auto 2fr;
      gap: 0.75rem;
      font-size: 0.92rem;
    }
    .g-list li:first-child { border-top: none; }
    .g-name { color: var(--charcoal); }
    .g-status {
      color: var(--olive);
      font-size: 0.7rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }
    .g-notes { color: var(--charcoal-muted); }
    @media (max-width: 540px) {
      .wrap { padding: 2rem 1.25rem; }
      .grid { grid-template-columns: 1fr; }
      .v-list li { grid-template-columns: 1fr; gap: 0.2rem; }
      .g-list li { grid-template-columns: 1fr; gap: 0.2rem; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="hero">
      <p class="eyebrow">Shoot brief</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="meta">Generated ${escapeHtml(generatedAt)}</p>
    </header>

    <section>
      <p class="eyebrow">Client</p>
      <h2>Who you're shooting</h2>
      ${sections.client}
    </section>

    <section>
      <p class="eyebrow">Project</p>
      <h2>Basics</h2>
      ${sections.project}
    </section>

    <section>
      <p class="eyebrow">Location</p>
      <h2>Where</h2>
      ${sections.location}
    </section>

    <section>
      <p class="eyebrow">Weather</p>
      <h2>Forecast</h2>
      ${sections.weather}
    </section>

    <section>
      <p class="eyebrow">Light</p>
      <h2>Golden &amp; blue hour</h2>
      ${sections.goldenHour}
    </section>

    <section>
      <p class="eyebrow">Questionnaire</p>
      <h2>Client responses</h2>
      ${sections.questionnaire}
    </section>

    <section>
      <p class="eyebrow">Vendors</p>
      <h2>Day-of team</h2>
      ${sections.vendors}
    </section>

    <section>
      <p class="eyebrow">Gear</p>
      <h2>Checklist</h2>
      ${sections.gear}
    </section>
  </div>
</body>
</html>`;
}

// ─── Public renderer ─────────────────────────────────────────────────────────

/**
 * Pure-ish renderer: reads project + client + ancillary data, returns the
 * fully-rendered HTML brief. Does not touch R2 or send any email.
 *
 * Graceful-degradation contract: every section has a "not yet" fallback,
 * so a missing questionnaire / weather / vendor link / gear log never
 * crashes the brief.
 */
export async function generateShootBriefHtml(projectId: string): Promise<{
  html: string;
  project: ProjectDoc;
  client: ClientDoc | null;
}> {
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  if (!projectSnap.exists) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const project = { id: projectId, ...(projectSnap.data() as Omit<ProjectDoc, "id">) } as ProjectDoc;

  let client: ClientDoc | null = null;
  try {
    const clientSnap = await adminDb.collection("clients").doc(project.clientId).get();
    if (clientSnap.exists) {
      client = { id: clientSnap.id, ...(clientSnap.data() as Omit<ClientDoc, "id">) } as ClientDoc;
    }
  } catch (err) {
    console.error("[generateShootBriefHtml] client lookup failed", { projectId, err });
  }

  const [questionnaireHtml, vendorsHtml, gearHtml] = await Promise.all([
    renderQuestionnaireSection(projectId),
    renderVendorSection(projectId),
    renderGearSection(projectId),
  ]);

  const sections: BriefSections = {
    client: renderClientSection(client),
    project: renderProjectSection(project),
    location: renderLocationSection(project),
    weather: renderWeatherSection(project.weatherSnapshot),
    goldenHour: renderGoldenHourSection(project),
    questionnaire: questionnaireHtml,
    vendors: vendorsHtml,
    gear: gearHtml,
  };

  const clientName = client
    ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Client"
    : "Client";
  const shootLabel = formatDisplayDate(project.shootDate) ?? "TBD";
  const title = `${clientName} · ${shootLabel}`;
  const generatedAt = formatDateTime(new Date()) ?? new Date().toISOString();

  const html = buildHtmlDocument(title, generatedAt, sections);
  return { html, project, client };
}

// ─── R2 upload ───────────────────────────────────────────────────────────────

/**
 * Direct PUT — body is small (a few hundred KB tops). Mirrors the welcome-packet
 * uploader; we don't reuse the presigned helper because the call is trusted
 * and presigning would just add a round-trip.
 */
async function putShootBriefToR2(key: string, html: string): Promise<void> {
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
        kind: "shoot-brief",
        uploadedAt: new Date().toISOString(),
      },
    })
  );
}

// ─── Orchestrators ───────────────────────────────────────────────────────────

/**
 * Render the brief, upload to R2, and stamp the project doc with the new R2
 * key + generatedAt. Returns the key + the rendered html for downstream
 * callers (e.g. tests, manual previews). Each call uses a fresh timestamp in
 * the R2 key so old briefs remain at their own keys for audit purposes.
 */
export async function generateAndStoreShootBrief(
  projectId: string
): Promise<{ r2Key: string; html: string }> {
  const { html } = await generateShootBriefHtml(projectId);
  const r2Key = `shoot-briefs/${projectId}/${Date.now()}.html`;
  await putShootBriefToR2(r2Key, html);
  await adminDb.collection("projects").doc(projectId).update({
    shootBriefR2Key: r2Key,
    shootBriefGeneratedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { r2Key, html };
}

/**
 * Generate + store the brief, then email Korrin a tracked link to the
 * presigned R2 download URL (8h expiry). No-op if no admin email is
 * configured (we log and return — the cron handler logs the skip).
 */
export async function dispatchShootBriefEmail(projectId: string): Promise<void> {
  const recipient = adminEmail();
  if (!recipient) {
    console.error("[dispatchShootBriefEmail] No ADMIN_EMAILS / ADMIN_EMAIL configured; skipping send", { projectId });
    return;
  }

  const { r2Key } = await generateAndStoreShootBrief(projectId);
  const presignedUrl = await generatePresignedGetUrl(r2Key, PRESIGN_TTL_SECONDS);

  // Re-read so the email reflects the freshly-stamped project state.
  const projectSnap = await adminDb.collection("projects").doc(projectId).get();
  const project = projectSnap.data() as ProjectDoc | undefined;
  const clientSnap = project
    ? await adminDb.collection("clients").doc(project.clientId).get().catch(() => null)
    : null;
  const client = clientSnap?.data() as ClientDoc | undefined;
  const clientName =
    client
      ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim() || "Client"
      : "Client";
  const shootLabel = formatDisplayDate(project?.shootDate) ?? "TBD";
  const subject = `Shoot brief — ${clientName} — ${shootLabel}`;
  const adminLink = `${appUrl()}/admin/projects/${projectId}`;

  const html = `
    <p>Hi Korrin,</p>
    <p>Tomorrow's shoot brief for <strong>${escapeHtml(clientName)}</strong> on <strong>${escapeHtml(shootLabel)}</strong> is ready.</p>
    <p><a href="${presignedUrl}">Download the brief (HTML, link expires in 8h)</a></p>
    <p style="color:#8A8A85;font-size:0.85rem;">Or jump straight to the project workspace: <a href="${adminLink}">${escapeHtml(adminLink)}</a></p>
    <p>Knock it out of the park.</p>`;

  await enqueueTrackedMail({
    to: recipient,
    subject,
    html,
    projectId,
    recipientClientId: null,
    sendKind: "shoot-brief",
  });
}
