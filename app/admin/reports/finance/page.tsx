// app/admin/reports/finance/page.tsx
// Phase 3.1 — Financial dashboard.
//
// Server Component:
//   1. Reads today's snapshot from `analyticsCache/finance:YYYY-MM-DD`.
//   2. On miss, runs `persistFinanceSnapshot(now)` synchronously so the page
//      always renders fresh data on first visit of the day. Subsequent visits
//      use the cached row (cron writes a fresh one nightly).
//   3. Best-effort fetches Stripe `balance` + upcoming payouts. 5s timeout —
//      page renders without the sidecar if Stripe is slow / absent.
//
// All charts live in `FinanceCharts.tsx` (`"use client"` because recharts
// requires browser layout). KPI tiles + payout sidecar render server-side.

import { requireAdmin } from "@/lib/session";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getSnapshot, financeKey } from "@/lib/db/analytics-cache";
import { persistFinanceSnapshot } from "@/lib/domain/analytics";
import { FinanceCharts } from "./FinanceCharts";
import type { Metadata } from "next";
import type { ProjectStatus } from "@/lib/db/projects";
import type { InvoiceDoc } from "@/lib/db/invoices";
import { stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Finance | Reports" };
export const dynamic = "force-dynamic";

// ---------- Helpers --------------------------------------------------------

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Promise-with-timeout — used to keep Stripe API calls from blocking the
 * page render past 5s. Resolves to `null` on timeout or failure.
 */
async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then((v) => {
      clearTimeout(t);
      resolve(v);
    }).catch(() => {
      clearTimeout(t);
      resolve(null);
    });
  });
}

interface StripeSidecar {
  available: number;        // cents, USD
  pending: number;          // cents, USD
  nextPayoutAmount?: number; // cents
  nextPayoutDate?: number;   // ms
}

async function fetchStripeSidecar(): Promise<StripeSidecar | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    const balanceP = stripe.balance.retrieve();
    const payoutsP = stripe.payouts.list({ limit: 5, status: "pending" });

    const [balance, payouts] = await Promise.all([
      withTimeout(balanceP, 5000),
      withTimeout(payoutsP, 5000),
    ]);
    if (!balance) return null;

    const sumUsd = (rows: Array<{ amount: number; currency: string }> | undefined) =>
      (rows ?? [])
        .filter((r) => (r.currency ?? "usd").toLowerCase() === "usd")
        .reduce((sum, r) => sum + (r.amount ?? 0), 0);

    const available = sumUsd(balance.available);
    const pending = sumUsd(balance.pending);

    let nextPayoutAmount: number | undefined;
    let nextPayoutDate: number | undefined;
    if (payouts?.data?.length) {
      // Earliest by arrival_date.
      const sorted = [...payouts.data].sort(
        (a, b) => (a.arrival_date ?? 0) - (b.arrival_date ?? 0)
      );
      const next = sorted[0];
      nextPayoutAmount = next.amount;
      nextPayoutDate = (next.arrival_date ?? 0) * 1000;
    }

    return { available, pending, nextPayoutAmount, nextPayoutDate };
  } catch (err) {
    console.error("[finance] stripe sidecar failed:", err);
    return null;
  }
}

/**
 * "Booked pipeline value" = sum of `estimatedValue` for projects whose
 * status is BOOKED, SHOOT_READY, or IN_EDITING. Computed live (not cached)
 * because it's cheap (single composite-free query, capped).
 */
async function bookedPipelineValueCents(): Promise<number> {
  const STATUSES: ProjectStatus[] = ["BOOKED", "SHOOT_READY", "IN_EDITING"];
  let total = 0;
  for (const status of STATUSES) {
    try {
      const snap = await adminDb
        .collection("projects")
        .where("status", "==", status)
        .limit(200)
        .get();
      for (const d of snap.docs) {
        const data = d.data() as { estimatedValue?: number | null };
        const ev = typeof data.estimatedValue === "number" ? data.estimatedValue : 0;
        total += ev;
      }
    } catch (err) {
      console.error(`[finance] pipeline lookup for ${status} failed:`, err);
    }
  }
  // estimatedValue is stored in dollars (matches packagePriceUsd convention);
  // convert to cents for parity with the rest of the dashboard.
  return Math.round(total * 100);
}

/**
 * Monthly revenue last 12 months — small enough to compute on the page
 * render. Pulls paid invoices from the last ~13 months and buckets by
 * `paidAt.YYYY-MM`.
 */
async function monthlyRevenueLast12(now: Date): Promise<Array<{ month: string; cents: number }>> {
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const startTs = Timestamp.fromDate(start);
  let invoices: InvoiceDoc[] = [];
  try {
    const snap = await adminDb
      .collection("invoices")
      .where("status", "==", "PAID")
      .where("paidAt", ">=", startTs)
      .limit(500)
      .get();
    invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvoiceDoc));
  } catch (err) {
    console.error("[finance] monthly revenue query failed (composite index?):", err);
    // Fallback: drop the paidAt range filter, just fetch PAID. May exceed limit
    // but keeps the chart from going blank.
    try {
      const snap = await adminDb
        .collection("invoices")
        .where("status", "==", "PAID")
        .limit(500)
        .get();
      invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() } as InvoiceDoc));
    } catch {
      invoices = [];
    }
  }

  // Pre-seed 12 months (newest last).
  const buckets: Array<{ month: string; cents: number; key: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    buckets.push({ month: label, cents: 0, key });
  }
  const idx = new Map(buckets.map((b, i) => [b.key, i]));

  for (const inv of invoices) {
    const paidAtRaw = inv.paidAt as unknown;
    let paid: Date | null = null;
    if (paidAtRaw && typeof paidAtRaw === "object" && "toDate" in paidAtRaw && typeof (paidAtRaw as { toDate: () => Date }).toDate === "function") {
      try {
        paid = (paidAtRaw as { toDate: () => Date }).toDate();
      } catch {
        paid = null;
      }
    }
    if (!paid) continue;
    const key = `${paid.getFullYear()}-${String(paid.getMonth() + 1).padStart(2, "0")}`;
    const i = idx.get(key);
    if (typeof i !== "number") continue;
    buckets[i].cents += inv.amountCents ?? 0;
  }

  return buckets.map((b) => ({ month: b.month, cents: b.cents }));
}

// ---------- Page -----------------------------------------------------------

export default async function FinanceReportPage() {
  await requireAdmin();

  const now = new Date();
  const key = financeKey(now);

  let snapshot = await getSnapshot(key);
  if (!snapshot) {
    try {
      const payload = await persistFinanceSnapshot(now);
      snapshot = {
        id: key,
        computedAt: Timestamp.now(),
        ...payload,
      };
    } catch (err) {
      console.error("[finance] snapshot compute failed:", err);
    }
  }

  // Parallel live fetches (pipeline value + Stripe sidecar + monthly chart).
  const [pipelineCents, stripeSidecar, monthly] = await Promise.all([
    bookedPipelineValueCents(),
    fetchStripeSidecar(),
    monthlyRevenueLast12(now),
  ]);

  const revenue = snapshot?.revenue ?? {
    mtd: 0,
    ytd: 0,
    last30: 0,
    gross: 0,
    refunded: 0,
    deposits: 0,
    balance: 0,
  };
  const funnel = snapshot?.funnel ?? {
    leads: 0,
    proposals: 0,
    contracts: 0,
    deposits: 0,
    booked: 0,
    delivered: 0,
    lost: 0,
  };
  const sources = snapshot?.sources ?? {};
  const byType = snapshot?.byType ?? {};
  const depositLiability = snapshot?.depositLiability ?? 0;

  // Reshape sources / byType for the chart consumer.
  const sourceSlices = Object.entries(sources)
    .filter(([, v]) => v > 0)
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents);
  const typeSlices = Object.entries(byType)
    .filter(([, v]) => v.revenueCents > 0)
    .map(([name, v]) => ({ name, cents: v.revenueCents }))
    .sort((a, b) => b.cents - a.cents);
  const funnelStages = [
    { stage: "Leads", count: funnel.leads },
    { stage: "Proposals", count: funnel.proposals },
    { stage: "Contracts", count: funnel.contracts },
    { stage: "Deposits", count: funnel.deposits },
    { stage: "Booked", count: funnel.booked },
    { stage: "Delivered", count: funnel.delivered },
    { stage: "Lost", count: funnel.lost },
  ];

  return (
    <div className="page-fade-in" style={{ padding: "2rem", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.25rem",
          }}
        >
          Reports
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "2.4rem",
            margin: 0,
            color: "var(--charcoal)",
          }}
        >
          Finance
        </h1>
        <p
          style={{
            fontSize: "0.78rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.5rem",
          }}
        >
          Snapshot {snapshot?.computedAt ? `computed ${formatDate(snapshot.computedAt.toMillis())}` : "computed on demand"}.
          All revenue figures are gross USD across paid invoices in the trailing 18 months.
        </p>
      </div>

      {/* Hero KPI strip — 6 tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1px",
          background: "var(--border)",
          border: "0.5px solid var(--border)",
          marginBottom: "2rem",
        }}
      >
        <KpiTile label="Revenue MTD" value={formatUsd(revenue.mtd)} />
        <KpiTile label="Revenue YTD" value={formatUsd(revenue.ytd)} />
        <KpiTile label="Revenue Last 30d" value={formatUsd(revenue.last30)} />
        <KpiTile label="Booked Pipeline" value={formatUsd(pipelineCents)} hint="Sum of estimatedValue · BOOKED → IN_EDITING" />
        <KpiTile label="Deposit Liability" value={formatUsd(depositLiability)} hint="Deposits collected, balance unearned" />
        <KpiTile label="Refunds Last 30d" value={formatUsd(revenue.refunded)} accent={revenue.refunded > 0 ? "warn" : undefined} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: stripeSidecar ? "1fr 280px" : "1fr", gap: "1.5rem" }}>
        <div>
          <FinanceCharts
            monthly={monthly}
            typeSlices={typeSlices}
            sourceSlices={sourceSlices}
            funnel={funnelStages}
          />
        </div>

        {stripeSidecar && (
          <aside
            style={{
              border: "0.5px solid var(--border)",
              padding: "1.25rem",
              alignSelf: "start",
              background: "rgba(42,42,40,0.02)",
            }}
          >
            <p
              style={{
                fontSize: "0.6rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--charcoal-muted)",
                marginBottom: "0.75rem",
              }}
            >
              Stripe Payouts
            </p>
            <PayoutRow label="Available" value={formatUsd(stripeSidecar.available)} />
            <PayoutRow label="Pending" value={formatUsd(stripeSidecar.pending)} />
            {typeof stripeSidecar.nextPayoutAmount === "number" && (
              <>
                <hr style={{ margin: "0.75rem 0", border: 0, borderTop: "0.5px solid var(--border)" }} />
                <PayoutRow label="Next payout" value={formatUsd(stripeSidecar.nextPayoutAmount)} />
                {stripeSidecar.nextPayoutDate && (
                  <p style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)", marginTop: "0.25rem" }}>
                    Arrives {formatDate(stripeSidecar.nextPayoutDate)}
                  </p>
                )}
              </>
            )}
            <p style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", marginTop: "0.75rem", lineHeight: 1.5 }}>
              Live Stripe balance — not part of the cached snapshot.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

// ---------- Subcomponents --------------------------------------------------

function KpiTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "warn";
}) {
  return (
    <div
      style={{
        padding: "1rem 1.1rem",
        background: "var(--white)",
        display: "flex",
        flexDirection: "column",
        gap: "0.4rem",
        minHeight: 96,
      }}
    >
      <p
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontWeight: 400,
          fontSize: "1.7rem",
          color: accent === "warn" ? "#B45309" : "var(--charcoal)",
          margin: 0,
          lineHeight: 1.1,
        }}
      >
        {value}
      </p>
      {hint && (
        <p style={{ fontSize: "0.65rem", color: "var(--charcoal-muted)", margin: 0, lineHeight: 1.3 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function PayoutRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "0.25rem 0" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--charcoal-light)" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", fontFamily: "'Cormorant Garamond', serif", color: "var(--charcoal)" }}>
        {value}
      </span>
    </div>
  );
}
