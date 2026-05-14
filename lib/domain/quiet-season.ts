// lib/domain/quiet-season.ts
// Phase 13.9 — Quiet-season planner.
//
// Pure analytics. Given the full set of projects + clients + a `today`
// reference date, this module derives:
//
//   • historicalMonthly:  12 month-of-year buckets (1=Jan … 12=Dec) with
//                         counts of BOOKED/SHOT projects and avg paid revenue.
//   • forecast:           the next 6 calendar months, each annotated with
//                         the count of currently-BOOKED-or-beyond projects
//                         on the books and a `quiet` flag if that count is
//                         below the historical average for the same month.
//   • reEngagementCandidates: clients whose most recent project was
//                         DELIVERED 9–24 months ago and who have no
//                         currently-open project — sorted by lifetime value
//                         descending.
//   • suggestedCampaigns: derived per-quiet-month nudges that pair a month
//                         with the candidate clients most likely to re-book.
//
// Server-only (lives under `lib/domain/`) but imports nothing from
// `lib/db/*` — call sites are expected to load the raw documents via the
// existing helpers and pass arrays in. This keeps the module trivially
// testable and avoids any Firestore round-trip during analysis.
//
// NOTE: `revenueByClientCents` is provided by the caller because the
// domain module does not read Firestore directly. If callers omit it, LTV
// defaults to 0 across the board (the candidates list still works, it just
// loses its sort fidelity).

import type { ProjectDoc, ProjectStatus } from "@/lib/db/projects";
import type { ClientDoc } from "@/lib/db/clients";
import { toDate } from "@/lib/date";

// ─── Status sets ────────────────────────────────────────────────────────────

/**
 * Statuses we treat as "real" historical bookings — i.e. projects that
 * actually went on the books and (for completed ones) shot. Lost / archived
 * projects are excluded so they cannot drag the historical baseline down.
 */
const HISTORICAL_BOOKED_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
]);

/**
 * Statuses that count toward "currently on the books" for the forward
 * forecast — once a deposit clears, the project is considered locked in.
 */
const FORWARD_BOOKED_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
]);

/**
 * Statuses that mean the client still has an in-flight project. A client
 * with one of these in their pipeline is NOT a re-engagement candidate
 * (we are not going to nudge someone we are already talking to).
 */
const OPEN_PROJECT_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "SITE_VISIT",
  "INQUIRY",
  "QUALIFYING",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "CONTRACT_SENT",
  "DEPOSIT_PENDING",
  "BOOKED",
  "SHOOT_READY",
  "IN_EDITING",
]);

/**
 * Statuses considered "delivered" for the re-engagement window. Once a
 * gallery is out the door we start a 9-month grace window before
 * surfacing the client as a re-engagement candidate.
 */
const DELIVERED_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
  "GALLERY_DELIVERED",
  "REFERRAL_SENT",
  "COMPLETED",
]);

// ─── Types ──────────────────────────────────────────────────────────────────

/** One row per calendar month (1=Jan … 12=Dec). */
export interface HistoricalMonthBucket {
  /** 1-indexed month-of-year. */
  month: number;
  /** Long month name ("January"). */
  monthName: string;
  /** Short month label ("Jan"). */
  monthLabel: string;
  /** Number of historical BOOKED-or-beyond projects whose shootDate falls in this month-of-year. */
  count: number;
  /** Avg paid invoice $ per project that booked in this month bucket (in dollars; 0 if no data). */
  avgRevenueUsd: number;
  /** True when this bucket is below 50% of the median month bucket count. */
  quiet: boolean;
}

export interface ForecastMonth {
  /** ISO `YYYY-MM` for the forecast month. */
  isoMonth: string;
  /** 1-indexed month-of-year (1 = Jan). */
  month: number;
  /** Calendar year. */
  year: number;
  /** Display label, e.g. "May 2026". */
  label: string;
  /** Currently-booked projects with shootDate in this month. */
  bookedCount: number;
  /** Historical average count for this month (rounded to 1 decimal). */
  historicalAvg: number;
  /**
   * `quiet` — the projection is meaningfully below history for this same
   * month-of-year (booked < historicalAvg AND historicalAvg >= 1).
   */
  quiet: boolean;
}

export interface ReEngagementCandidate {
  clientId: string;
  fullName: string;
  email: string;
  /** Last project session type ("Wedding", "Family", …) — best display fallback. */
  lastSessionType: string;
  /** ISO timestamp of last delivery. */
  lastDeliveredAtIso: string;
  /** Whole months between last delivery and `today`. */
  monthsSinceDelivered: number;
  /** Lifetime value (paid invoices, in cents). 0 if caller did not provide. */
  lifetimeValueCents: number;
  /** Most-recent project ID — used to deep-link the action button. */
  lastProjectId: string;
}

export interface SuggestedCampaign {
  /** ISO `YYYY-MM` of the quiet forecast month. */
  isoMonth: string;
  /** Display label, e.g. "May 2026". */
  monthLabel: string;
  /** How many re-engagement candidates fit the dominant session-type. */
  candidateCount: number;
  /** The session type that dominates the candidate list ("Family", "Portrait", …). */
  dominantSessionType: string;
  /** Headline copy ("May 2026 looks light — 12 past family clients are due for a re-shoot."). */
  headline: string;
  /** Suggested broadcast nudge ("Consider sending the 'Annual family update' broadcast."). */
  suggestion: string;
}

export interface QuietSeasonAnalysis {
  historicalMonthly: HistoricalMonthBucket[]; // length 12, ordered Jan → Dec
  forecast: ForecastMonth[]; // length 6 (or fewer if today is malformed)
  reEngagementCandidates: ReEngagementCandidate[];
  suggestedCampaigns: SuggestedCampaign[];
  /** True when no history at all is available — UI uses this to soften copy. */
  noHistory: boolean;
  /** Total quiet months in the next 6. */
  quietMonthsInForecast: number;
  /** Average per-quiet-month historical revenue (in dollars). */
  avgRevenuePerQuietMonthUsd: number;
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

export interface QuietSeasonInput {
  projects: ProjectDoc[];
  clients: ClientDoc[];
  today: Date;
  /**
   * Optional: paid revenue (cents) keyed by clientId. If omitted, candidate
   * LTV is reported as 0 and the sort falls back to `monthsSinceDelivered`.
   */
  revenueByClientCents?: Map<string, number>;
  /**
   * Optional: paid revenue (cents) keyed by projectId. Used to compute the
   * per-historical-month avg revenue. If omitted, avg revenue defaults to
   * `packagePriceUsd * 100` for each project (and zero where neither is set).
   */
  revenueByProjectCents?: Map<string, number>;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_LONG_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

const MONTH_SHORT_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

function safeMonth(date: Date | null): number | null {
  if (!date) return null;
  const m = date.getUTCMonth();
  return m >= 0 && m <= 11 ? m + 1 : null;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function isoMonthFor(year: number, monthIdx0: number): string {
  return `${year}-${String(monthIdx0 + 1).padStart(2, "0")}`;
}

function monthsBetween(earlier: Date, later: Date): number {
  const years = later.getUTCFullYear() - earlier.getUTCFullYear();
  const months = later.getUTCMonth() - earlier.getUTCMonth();
  const dayDelta = later.getUTCDate() - earlier.getUTCDate();
  let total = years * 12 + months;
  if (dayDelta < 0) total -= 1;
  return total;
}

function clientDisplayName(c: ClientDoc): string {
  const fn = (c.firstName ?? "").trim();
  const ln = (c.lastName ?? "").trim();
  const joined = [fn, ln].filter((s) => s.length > 0).join(" ");
  return joined.length > 0 ? joined : c.email;
}

/**
 * Normalise a session type label to its dominant family for campaign
 * suggestion copy. Returns the raw value when unknown.
 */
function normalizeSessionType(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "Portrait";
  return raw.trim() || "Portrait";
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Pure analytics — no Firestore reads, no side effects. Safe to call with
 * empty `projects` and `clients` arrays (returns a zero-filled result).
 */
export function buildQuietSeasonAnalysis(
  input: QuietSeasonInput
): QuietSeasonAnalysis {
  const { projects, clients, today } = input;
  const revenueByProject = input.revenueByProjectCents ?? new Map<string, number>();
  const revenueByClient = input.revenueByClientCents ?? new Map<string, number>();

  // ─── Guard against malformed `today` so callers don't crash ───────────
  const safeToday =
    today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();

  // ─── Step 1: Historical month buckets ────────────────────────────────
  const monthCounts = new Array<number>(12).fill(0);
  const monthRevenueSums = new Array<number>(12).fill(0); // in cents
  const monthRevenueCounts = new Array<number>(12).fill(0);

  for (const p of projects) {
    if (!HISTORICAL_BOOKED_STATUSES.has(p.status)) continue;
    const shootDate = toDate(p.shootDate);
    if (!shootDate) continue;
    // Only count history — ignore future shoots so they don't double-count
    // against the forward forecast.
    if (shootDate.getTime() > safeToday.getTime()) continue;
    const m = safeMonth(shootDate);
    if (m === null) continue;
    const idx0 = m - 1;
    monthCounts[idx0] += 1;

    const projectRevenue =
      revenueByProject.get(p.id) ??
      (typeof p.packagePriceUsd === "number" && p.packagePriceUsd > 0
        ? Math.round(p.packagePriceUsd * 100)
        : 0);
    if (projectRevenue > 0) {
      monthRevenueSums[idx0] += projectRevenue;
      monthRevenueCounts[idx0] += 1;
    }
  }

  const medianCount = median(monthCounts);
  const quietThreshold = medianCount * 0.5;

  const historicalMonthly: HistoricalMonthBucket[] = monthCounts.map((count, idx0) => {
    const avgCents =
      monthRevenueCounts[idx0] > 0
        ? monthRevenueSums[idx0] / monthRevenueCounts[idx0]
        : 0;
    return {
      month: idx0 + 1,
      monthName: MONTH_LONG_NAMES[idx0],
      monthLabel: MONTH_SHORT_NAMES[idx0],
      count,
      avgRevenueUsd: Math.round(avgCents / 100),
      // Mark a month as quiet only when we have at least *some* history,
      // otherwise every month would appear "quiet" on day one.
      quiet: medianCount > 0 && count < quietThreshold,
    };
  });

  // ─── Step 2: Forward 6-month forecast ────────────────────────────────
  // Bucket currently-booked-or-beyond projects by the forward calendar
  // month they fall in (year-aware, not month-of-year).
  const forwardKeyFor = (d: Date) =>
    isoMonthFor(d.getUTCFullYear(), d.getUTCMonth());

  const bookedByIsoMonth = new Map<string, number>();
  for (const p of projects) {
    if (!FORWARD_BOOKED_STATUSES.has(p.status)) continue;
    const sd = toDate(p.shootDate);
    if (!sd) continue;
    if (sd.getTime() < safeToday.getTime()) continue;
    bookedByIsoMonth.set(
      forwardKeyFor(sd),
      (bookedByIsoMonth.get(forwardKeyFor(sd)) ?? 0) + 1
    );
  }

  // We compute the average per month-of-year using project counts AND a
  // year span derived from the data, so a month that booked 6 projects
  // across 3 historical years has a historical avg of ~2/yr.
  const earliestBookedYear = projects.reduce<number | null>((acc, p) => {
    if (!HISTORICAL_BOOKED_STATUSES.has(p.status)) return acc;
    const sd = toDate(p.shootDate);
    if (!sd) return acc;
    if (sd.getTime() > safeToday.getTime()) return acc;
    const y = sd.getUTCFullYear();
    return acc === null ? y : Math.min(acc, y);
  }, null);

  const yearsOfHistory =
    earliestBookedYear !== null
      ? Math.max(1, safeToday.getUTCFullYear() - earliestBookedYear + 1)
      : 1;

  const forecast: ForecastMonth[] = [];
  for (let offset = 1; offset <= 6; offset++) {
    const dt = new Date(
      Date.UTC(safeToday.getUTCFullYear(), safeToday.getUTCMonth() + offset, 1)
    );
    const monthIdx0 = dt.getUTCMonth();
    const year = dt.getUTCFullYear();
    const iso = isoMonthFor(year, monthIdx0);
    const bookedCount = bookedByIsoMonth.get(iso) ?? 0;
    const histAvgRaw = monthCounts[monthIdx0] / yearsOfHistory;
    const historicalAvg = Math.round(histAvgRaw * 10) / 10;
    forecast.push({
      isoMonth: iso,
      month: monthIdx0 + 1,
      year,
      label: `${MONTH_LONG_NAMES[monthIdx0]} ${year}`,
      bookedCount,
      historicalAvg,
      // Only flag as quiet if we have enough history to reason about it.
      quiet: historicalAvg >= 1 && bookedCount < historicalAvg,
    });
  }

  // ─── Step 3: Re-engagement candidates ────────────────────────────────
  // Build a per-client view of: (a) most-recent delivered project and
  // (b) whether any open project exists today.
  interface ClientLastDelivered {
    project: ProjectDoc;
    deliveredAt: Date;
  }
  const lastDeliveredByClient = new Map<string, ClientLastDelivered>();
  const hasOpenProjectByClient = new Set<string>();

  for (const p of projects) {
    if (OPEN_PROJECT_STATUSES.has(p.status)) {
      hasOpenProjectByClient.add(p.clientId);
    }
    if (DELIVERED_STATUSES.has(p.status)) {
      // Prefer `deliveredAt`; fall back to `shootDate`.
      const delivered = toDate(p.deliveredAt) ?? toDate(p.shootDate);
      if (!delivered) continue;
      const prev = lastDeliveredByClient.get(p.clientId);
      if (!prev || delivered.getTime() > prev.deliveredAt.getTime()) {
        lastDeliveredByClient.set(p.clientId, { project: p, deliveredAt: delivered });
      }
    }
  }

  const clientsById = new Map<string, ClientDoc>(clients.map((c) => [c.id, c]));

  const candidates: ReEngagementCandidate[] = [];
  for (const [clientId, last] of lastDeliveredByClient) {
    if (hasOpenProjectByClient.has(clientId)) continue;
    const months = monthsBetween(last.deliveredAt, safeToday);
    if (months < 9 || months > 24) continue;
    const client = clientsById.get(clientId);
    if (!client) continue;
    candidates.push({
      clientId,
      fullName: clientDisplayName(client),
      email: client.email,
      lastSessionType: normalizeSessionType(last.project.sessionType),
      lastDeliveredAtIso: last.deliveredAt.toISOString(),
      monthsSinceDelivered: months,
      lifetimeValueCents: revenueByClient.get(clientId) ?? 0,
      lastProjectId: last.project.id,
    });
  }

  candidates.sort((a, b) => {
    if (b.lifetimeValueCents !== a.lifetimeValueCents) {
      return b.lifetimeValueCents - a.lifetimeValueCents;
    }
    return b.monthsSinceDelivered - a.monthsSinceDelivered;
  });

  // ─── Step 4: Suggested campaigns ─────────────────────────────────────
  // For each forecast month flagged quiet, pick the dominant session
  // type across the candidate list and assemble a short copy block.
  const dominantTypeAcrossCandidates = (() => {
    const counts = new Map<string, number>();
    for (const c of candidates) {
      counts.set(c.lastSessionType, (counts.get(c.lastSessionType) ?? 0) + 1);
    }
    let best: { type: string; n: number } = { type: "Family", n: 0 };
    for (const [type, n] of counts) {
      if (n > best.n) best = { type, n };
    }
    return best;
  })();

  const suggestedCampaigns: SuggestedCampaign[] = forecast
    .filter((f) => f.quiet)
    .map((f) => {
      const dominantType =
        dominantTypeAcrossCandidates.n > 0
          ? dominantTypeAcrossCandidates.type
          : "Family";
      const candidateCount = candidates.filter(
        (c) => c.lastSessionType === dominantType
      ).length;

      const lowerType = dominantType.toLowerCase();
      const headline =
        candidateCount > 0
          ? `${f.label} looks light — ${candidateCount} past ${lowerType} ${
              candidateCount === 1 ? "client is" : "clients are"
            } due for a re-shoot.`
          : `${f.label} looks light — only ${f.bookedCount} on the books vs ~${f.historicalAvg} typical.`;

      const suggestion =
        candidateCount > 0
          ? `Consider sending the "Annual ${lowerType} update" broadcast to past ${lowerType} clients.`
          : `Consider running a mini-session promo or a referral push aimed at ${f.label}.`;

      return {
        isoMonth: f.isoMonth,
        monthLabel: f.label,
        candidateCount,
        dominantSessionType: dominantType,
        headline,
        suggestion,
      };
    });

  // ─── Step 5: Headline metrics ─────────────────────────────────────────
  const quietMonthsInForecast = forecast.filter((f) => f.quiet).length;
  const quietHistoricalRevenues = historicalMonthly
    .filter((m) => m.quiet)
    .map((m) => m.avgRevenueUsd);
  const avgRevenuePerQuietMonthUsd =
    quietHistoricalRevenues.length > 0
      ? Math.round(
          quietHistoricalRevenues.reduce((s, v) => s + v, 0) /
            quietHistoricalRevenues.length
        )
      : 0;

  const noHistory = monthCounts.every((n) => n === 0);

  return {
    historicalMonthly,
    forecast,
    reEngagementCandidates: candidates,
    suggestedCampaigns,
    noHistory,
    quietMonthsInForecast,
    avgRevenuePerQuietMonthUsd,
  };
}
