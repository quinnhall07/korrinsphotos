// lib/domain/sales-tax-reports.ts
// Phase 3.11 — Cross-collection orchestration for the sales-tax dashboard.
//
// Two exports:
//
//   computeSalesTaxLedger({ fromDate, toDate, stateCode? }) — walks paid invoices
//     in the date window, joins to clients, returns a flat row list + state
//     totals.
//
//   regenerateUpcomingFilings(now?) — idempotent sweep that ensures a
//     `salesTaxFilings/{id}` row exists for the current period of every state
//     in `STATE_TAX_RULES` (capped to states Korrin has actually collected for).
//     Flips DUE_SOON → OVERDUE when `dueBy < now`. Enqueues a single
//     SALES_TAX_OVERDUE inbox item per filing on the transition.
//
// Server-only.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import type { InvoiceDoc } from "@/lib/db/invoices";
import { readInvoiceTaxBreakdown } from "@/lib/db/invoices";
import type { ClientDoc } from "@/lib/db/clients";
import {
  STATE_TAX_RULES,
  applyRuleOverride,
  type StateTaxRule,
} from "@/lib/sales-tax-rules";
import {
  createSalesTaxFiling,
  findExistingFiling,
  listSalesTaxFilings,
  updateSalesTaxFiling,
  type FilingStatus,
  type SalesTaxFilingDoc,
} from "@/lib/db/sales-tax-filings";
import { getStudioTaxConfig } from "@/lib/db/admin-settings";
import { createInboxItem } from "@/lib/db/inbox";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LedgerRow {
  invoiceId: string;
  projectId: string;
  clientId: string;
  clientName: string;
  stateCode: string;
  subtotalCents: number;
  taxCents: number;
  paidAt: string; // ISO
}

export interface LedgerTotals {
  taxableSalesCents: number;
  taxOwedCents: number;
}

export interface LedgerResult {
  rows: LedgerRow[];
  totalsByState: Record<string, LedgerTotals>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatClientName(client: ClientDoc | null | undefined): string {
  if (!client) return "Unknown client";
  const name = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  return name || client.email || "Unknown client";
}

async function loadClientsByIds(
  clientIds: string[]
): Promise<Map<string, ClientDoc>> {
  const out = new Map<string, ClientDoc>();
  const unique = Array.from(new Set(clientIds.filter(Boolean)));
  if (unique.length === 0) return out;

  // Chunked `in` reads (Firestore caps at 30 per `in` filter).
  const chunkSize = 30;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const snap = await adminDb
        .collection("clients")
        .where("__name__", "in", chunk)
        .get();
      for (const d of snap.docs) {
        out.set(d.id, { id: d.id, ...(d.data() as Omit<ClientDoc, "id">) });
      }
    } catch (err) {
      console.error("[sales-tax-reports] client lookup failed", err);
    }
  }
  return out;
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

/**
 * Walks every PAID invoice that paid in the window and joins to the
 * `clients` doc for display name + tax state. Filters out invoices with
 * zero tax (clean ledger) unless `stateCode` is passed (in which case the
 * caller wants every row for the state).
 *
 * Aggregation is in-memory — at studio scale (low thousands of invoices) this
 * is cheap and avoids composite-index requirements on the `invoices` collection.
 */
export async function computeSalesTaxLedger(opts: {
  fromDate: Date;
  toDate: Date;
  stateCode?: string;
}): Promise<LedgerResult> {
  const { fromDate, toDate, stateCode } = opts;
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();
  const wantCode = stateCode ? stateCode.toUpperCase() : null;

  const rows: LedgerRow[] = [];
  const totalsByState: Record<string, LedgerTotals> = {};

  let invoices: InvoiceDoc[] = [];
  try {
    const snap = await adminDb
      .collection("invoices")
      .where("status", "==", "PAID")
      .get();
    invoices = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvoiceDoc, "id">) }));
  } catch (err) {
    console.error("[sales-tax-reports] paid invoices read failed", err);
    return { rows: [], totalsByState: {} };
  }

  // Pre-filter to the window so we don't fetch clients we won't use.
  const inWindow = invoices.filter((inv) => {
    if (!inv.paidAt) return false;
    const ms = inv.paidAt.toMillis();
    return ms >= fromMs && ms <= toMs;
  });

  const clientIds = inWindow.map((i) => i.clientId);
  const clientMap = await loadClientsByIds(clientIds);

  for (const inv of inWindow) {
    const breakdown = readInvoiceTaxBreakdown(inv);
    const code = (breakdown.taxStateCode ?? "").toUpperCase() || "OTHER";
    if (wantCode && wantCode !== code) continue;

    const client = clientMap.get(inv.clientId);
    rows.push({
      invoiceId: inv.id,
      projectId: inv.projectId,
      clientId: inv.clientId,
      clientName: formatClientName(client),
      stateCode: code,
      subtotalCents: breakdown.subtotalCents,
      taxCents: breakdown.taxCents,
      paidAt: inv.paidAt!.toDate().toISOString(),
    });

    if (!totalsByState[code]) {
      totalsByState[code] = { taxableSalesCents: 0, taxOwedCents: 0 };
    }
    // Only count subtotal toward taxable sales when tax was actually applied —
    // a 0-tax row for an exempt state shouldn't inflate the taxable bucket.
    if (breakdown.taxCents > 0) {
      totalsByState[code].taxableSalesCents += breakdown.subtotalCents;
    }
    totalsByState[code].taxOwedCents += breakdown.taxCents;
  }

  rows.sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));

  return { rows, totalsByState };
}

// ─── Period helpers ───────────────────────────────────────────────────────────

interface FilingPeriod {
  periodStart: Date;
  periodEnd: Date; // inclusive last day
  dueBy: Date;
}

/**
 * Compute the **previous** filing period for a given state at `now`. Returns
 * the just-closed month or quarter — that is the period a filing is due for.
 *
 * Example: NC is MONTHLY, due on the 20th of the following month. If `now`
 * is 2026-05-14, the previous period is April 2026 (2026-04-01 to 2026-04-30),
 * due 2026-05-20.
 */
function previousFilingPeriod(rule: StateTaxRule, now: Date): FilingPeriod {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  if (rule.filingFrequency === "MONTHLY") {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const periodStart = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
    const periodEnd = new Date(
      Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59)
    );
    // Due in the month AFTER the period ended, on `filingDueDayOfMonth`.
    const dueYear = prevMonth === 11 ? prevYear + 1 : prevYear;
    const dueMonth = prevMonth === 11 ? 0 : prevMonth + 1;
    const dueBy = new Date(
      Date.UTC(dueYear, dueMonth, Math.min(rule.filingDueDayOfMonth, 28), 23, 59, 59)
    );
    return { periodStart, periodEnd, dueBy };
  }

  // QUARTERLY — current quarter's previous one.
  const currentQuarter = Math.floor(month / 3); // 0..3
  const prevQuarter = currentQuarter === 0 ? 3 : currentQuarter - 1;
  const prevQuarterYear = currentQuarter === 0 ? year - 1 : year;
  const startMonth = prevQuarter * 3;
  const periodStart = new Date(Date.UTC(prevQuarterYear, startMonth, 1, 0, 0, 0));
  const periodEnd = new Date(
    Date.UTC(prevQuarterYear, startMonth + 3, 0, 23, 59, 59)
  );
  // Due one month after the quarter ends, on filingDueDayOfMonth.
  const dueMonth = startMonth + 3; // first month after period end
  const dueYear = dueMonth > 11 ? prevQuarterYear + 1 : prevQuarterYear;
  const normalisedDueMonth = dueMonth > 11 ? dueMonth - 12 : dueMonth;
  const dueBy = new Date(
    Date.UTC(dueYear, normalisedDueMonth, Math.min(rule.filingDueDayOfMonth, 28), 23, 59, 59)
  );
  return { periodStart, periodEnd, dueBy };
}

function resolveRule(
  base: StateTaxRule,
  overrides: Record<string, Partial<StateTaxRule>> | undefined
): StateTaxRule {
  if (!overrides) return base;
  return applyRuleOverride(base, overrides[base.stateCode]);
}

// ─── regenerateUpcomingFilings ────────────────────────────────────────────────

/**
 * Idempotent sweep — ensures a `salesTaxFilings` row exists for the most-recent
 * closed period of every state in `STATE_TAX_RULES` (skipping "OTHER" and any
 * state with `ratePct == 0`) where Korrin actually collected tax in that
 * window. Flips DUE_SOON → OVERDUE when `dueBy < now`, and enqueues a single
 * `SALES_TAX_OVERDUE` inbox item per filing on the transition.
 *
 * Returns `{ created, skipped }`. Failures on any individual state are
 * logged and counted as skipped — the sweep never throws.
 */
export async function regenerateUpcomingFilings(
  now: Date = new Date()
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  let config;
  try {
    config = await getStudioTaxConfig();
  } catch (err) {
    console.error("[sales-tax-reports] tax config read failed", err);
    return { created: 0, skipped: 0 };
  }

  // 1) For every taxable state, ensure a filing row for the previous period
  //    exists if Korrin collected any tax for it.
  for (const baseRule of Object.values(STATE_TAX_RULES)) {
    if (baseRule.stateCode === "OTHER") continue;
    try {
      const rule = resolveRule(baseRule, config.overrideRulesByState);
      if (rule.ratePct <= 0) continue;

      const period = previousFilingPeriod(rule, now);
      const periodStartTs = Timestamp.fromDate(period.periodStart);
      const periodEndTs = Timestamp.fromDate(period.periodEnd);
      const dueByTs = Timestamp.fromDate(period.dueBy);

      const existing = await findExistingFiling(rule.stateCode, periodStartTs, periodEndTs);

      // Aggregate paid-in-period totals for this state.
      const ledger = await computeSalesTaxLedger({
        fromDate: period.periodStart,
        toDate: period.periodEnd,
        stateCode: rule.stateCode,
      });
      const totals = ledger.totalsByState[rule.stateCode] ?? {
        taxableSalesCents: 0,
        taxOwedCents: 0,
      };

      // No revenue, no row.
      if (!existing && totals.taxOwedCents === 0) {
        skipped++;
        continue;
      }

      const status: FilingStatus =
        period.dueBy.getTime() < now.getTime() ? "OVERDUE" : "DUE_SOON";

      if (!existing) {
        await createSalesTaxFiling({
          stateCode: rule.stateCode,
          periodStart: periodStartTs,
          periodEnd: periodEndTs,
          dueBy: dueByTs,
          taxableSalesCents: totals.taxableSalesCents,
          taxOwedCents: totals.taxOwedCents,
          status,
        });
        created++;

        if (status === "OVERDUE") {
          await emitOverdueInboxItem(rule.stateCode, period.dueBy).catch(() => {});
        }
      } else if (existing.status === "DUE_SOON" || existing.status === "OVERDUE") {
        // Keep totals fresh as new paid invoices land within the same period
        // (e.g. a deposit paid late). Only flip status if the deadline passed.
        const patch: Partial<SalesTaxFilingDoc> = {
          taxableSalesCents: totals.taxableSalesCents,
          taxOwedCents: totals.taxOwedCents,
        };
        if (existing.status === "DUE_SOON" && status === "OVERDUE") {
          patch.status = "OVERDUE";
        }
        await updateSalesTaxFiling(existing.id, patch);
        if (patch.status === "OVERDUE") {
          await emitOverdueInboxItem(rule.stateCode, period.dueBy).catch(() => {});
          created++; // count the status transition as a meaningful change
        } else {
          skipped++;
        }
      } else {
        // FILED / PAID rows are terminal — leave alone.
        skipped++;
      }
    } catch (err) {
      console.error(
        `[sales-tax-reports] regenerate failed for ${baseRule.stateCode}`,
        err
      );
      skipped++;
    }
  }

  return { created, skipped };
}

/**
 * Surface a sales-tax overdue prompt in the admin inbox. Idempotent —
 * dedupes by scanning the last 50 inbox items for a matching unread row.
 */
async function emitOverdueInboxItem(stateCode: string, dueBy: Date): Promise<void> {
  try {
    const snap = await adminDb
      .collection("inboxItems")
      .where("type", "==", "SALES_TAX_OVERDUE")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();
    for (const d of snap.docs) {
      const data = d.data() as { read?: boolean; body?: string | null };
      if (data.read) continue;
      const body = data.body ?? "";
      if (body.includes(`(${stateCode})`)) return; // already queued
    }
  } catch {
    // ignore — fall through to create
  }

  const dueLabel = dueBy.toISOString().slice(0, 10);
  await createInboxItem({
    type: "SALES_TAX_OVERDUE",
    projectId: null,
    clientId: null,
    title: `Sales tax filing overdue (${stateCode})`,
    body: `Filing was due ${dueLabel} (${stateCode}). Review and remit on the reports page.`,
    link: "/admin/reports/sales-tax",
    read: false,
  });
}
