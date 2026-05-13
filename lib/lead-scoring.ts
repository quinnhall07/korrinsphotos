// lib/lead-scoring.ts
// Calculates an automated lead score (0–100) based on inquiry attributes.
// Higher scores = higher priority + higher likelihood to book.
// Call this on inquiry creation and on any field update that affects score.

import type { BookingInquiryDoc } from "@/lib/db/bookings";

// ─── Session value weights ─────────────────────────────────────────────────────
const SESSION_WEIGHTS: Record<string, number> = {
  Wedding:    30,
  Commercial: 25,
  Editorial:  18,
  Engagement: 15,
  Portrait:   10,
  Family:      8,
};

// ─── Tag multipliers ───────────────────────────────────────────────────────────
const TAG_BONUSES: Record<string, number> = {
  VIP:              12,
  Rush:             10,
  "Return Client":  15,
  Destination:       8,
  "High-Budget":    10,
};

function daysBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function parseDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  // Firestore Timestamp
  if (typeof raw === "object" && raw !== null && "toDate" in raw) {
    return (raw as { toDate: () => Date }).toDate();
  }
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// ─── Main scoring function ─────────────────────────────────────────────────────

export function calculateLeadScore(inquiry: Partial<BookingInquiryDoc>): number {
  let score = 35; // Reasonable baseline for any genuine inquiry

  // ── Session type ──────────────────────────────────────────────────────────
  score += SESSION_WEIGHTS[inquiry.sessionType ?? ""] ?? 5;

  // ── Message quality (detail signals genuine intent) ───────────────────────
  const msgLen = (inquiry.message ?? "").trim().length;
  if (msgLen > 400)      score += 15;
  else if (msgLen > 200) score += 10;
  else if (msgLen > 100) score += 5;

  // ── Date urgency ──────────────────────────────────────────────────────────
  const date = parseDate(inquiry.preferredDate);
  if (date) {
    const days = daysBetween(new Date(), date);
    if (days > 0 && days <= 30)       score += 15;  // very soon
    else if (days > 0 && days <= 90)  score += 10;
    else if (days > 0 && days <= 180) score += 5;
  }

  // ── Lead source ───────────────────────────────────────────────────────────
  const sourceBonus: Record<string, number> = {
    REFERRAL:  18,
    GOOGLE:     6,
    INSTAGRAM:  4,
    WEBSITE:    2,
    OTHER:      0,
  };
  score += sourceBonus[inquiry.leadSource ?? ""] ?? 0;

  // ── Tag bonuses ───────────────────────────────────────────────────────────
  (inquiry.tags ?? []).forEach((tag) => {
    score += TAG_BONUSES[tag] ?? 0;
  });

  // ── Estimated value bonus ─────────────────────────────────────────────────
  const val = inquiry.estimatedValue ?? 0;
  if (val >= 5000) score += 10;
  else if (val >= 2500) score += 5;

  return Math.min(Math.max(Math.round(score), 0), 100);
}

// ─── Display helpers ───────────────────────────────────────────────────────────

export function getScoreColor(score: number): string {
  if (score >= 80) return "#059669";  // emerald — Hot
  if (score >= 60) return "#D97706";  // amber   — Warm
  if (score >= 40) return "#6B7845";  // olive   — Lukewarm
  return "#8A8A85";                   // muted   — Cold
}

export function getScoreBackground(score: number): string {
  if (score >= 80) return "#D1FAE5";
  if (score >= 60) return "#FEF3C7";
  if (score >= 40) return "#E8EBD8";
  return "rgba(42,42,40,0.06)";
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return "Hot";
  if (score >= 60) return "Warm";
  if (score >= 40) return "Lukewarm";
  return "Cold";
}