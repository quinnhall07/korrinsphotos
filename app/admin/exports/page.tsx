// app/admin/exports/page.tsx
// Wave 11 — single hub page from which Korrin can download CSV exports of
// every important collection in the studio. All routes are admin-guarded.

import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";
import { ExpenseYearPicker } from "./ExpenseYearPicker";

export const metadata: Metadata = { title: "Exports | Admin" };
export const dynamic = "force-dynamic";

interface ExportCard {
  title: string;
  description: string;
  href?: string;
  custom?: "expense-year-picker";
}

const CARDS: ExportCard[] = [
  {
    title: "Clients",
    description:
      "Every Client record — referral codes, first-touch attribution, recurring cadence, lifetime session count.",
    href: "/api/exports/clients",
  },
  {
    title: "Projects (full)",
    description:
      "All projects with their lifecycle dates (deposit, balance, contract, delivery), tags, score, and the joined client email.",
    href: "/api/exports/projects",
  },
  {
    title: "Invoices",
    description:
      "Every invoice — type, status, amount / subtotal / tax in cents, refund ledger, Stripe correlation IDs.",
    href: "/api/exports/invoices",
  },
  {
    title: "Expenses",
    description:
      "Manual expense ledger for the chosen calendar year, in QuickBooks Self-Employed compatible format.",
    custom: "expense-year-picker",
  },
  {
    title: "Photos summary by event",
    description:
      "One row per event — photo count, gallery-ready count, total favorites, total views and downloads.",
    href: "/api/exports/photos-summary",
  },
  {
    title: "Sales tax filings",
    description:
      "State-by-state sales-tax filing ledger — period, due date, taxable sales, tax owed, status.",
    href: "/api/exports/sales-tax-filings",
  },
];

function expenseYears(now: Date): number[] {
  const current = now.getUTCFullYear();
  const out: number[] = [];
  // Last six years inclusive — long enough to cover IRS amendment windows
  // (3 years) without becoming a runaway dropdown.
  for (let y = current; y >= current - 5; y -= 1) out.push(y);
  return out;
}

export default async function ExportsPage() {
  await requireAdmin();

  const now = new Date();
  const years = expenseYears(now);
  const defaultYear = now.getUTCFullYear();

  return (
    <div style={{ padding: "3rem clamp(1.5rem, 4vw, 4rem) 6rem", maxWidth: "1100px" }}>
      {/* ── Editorial header ──────────────────────────────────────────── */}
      <header style={{ marginBottom: "3rem" }}>
        <p
          style={{
            fontSize: "0.65rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            marginBottom: "0.5rem",
          }}
        >
          Reports
        </p>
        <h1
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 300,
            fontSize: "clamp(2rem, 4vw, 2.8rem)",
            color: "var(--charcoal)",
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Exports <em style={{ color: "var(--charcoal-light)" }}>&mdash;</em>{" "}
          download CSVs of your data.
        </h1>
        <p
          style={{
            marginTop: "1rem",
            color: "var(--charcoal-light)",
            fontSize: "0.95rem",
            maxWidth: "60ch",
          }}
        >
          Every CSV is generated on demand and streamed straight to your
          browser. Money is exported in cents; timestamps in UTC ISO-8601 so
          spreadsheets can sort them lexically.
        </p>
      </header>

      {/* ── Cards ─────────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gap: "1px", background: "var(--border)" }}>
        {CARDS.map((card) => (
          <article
            key={card.title}
            style={{
              background: "var(--white)",
              padding: "1.5rem 1.75rem",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              gap: "1.5rem",
              alignItems: "center",
              border: "0.5px solid var(--border)",
            }}
          >
            <div>
              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontWeight: 400,
                  fontSize: "1.4rem",
                  color: "var(--charcoal)",
                  margin: 0,
                  marginBottom: "0.35rem",
                }}
              >
                {card.title}
              </h2>
              <p
                style={{
                  fontSize: "0.85rem",
                  color: "var(--charcoal-light)",
                  margin: 0,
                  lineHeight: 1.45,
                }}
              >
                {card.description}
              </p>
            </div>

            <div style={{ justifySelf: "end" }}>
              {card.custom === "expense-year-picker" ? (
                <ExpenseYearPicker years={years} defaultYear={defaultYear} />
              ) : card.href ? (
                <a
                  href={card.href}
                  download
                  style={{
                    fontSize: "0.72rem",
                    letterSpacing: "0.16em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                    borderBottom: "0.5px solid var(--olive)",
                    paddingBottom: "2px",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  Download CSV
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <p
        style={{
          marginTop: "2.5rem",
          fontSize: "0.75rem",
          color: "var(--charcoal-muted)",
          fontStyle: "italic",
        }}
      >
        Tip — open these in Numbers or Sheets and drop them into a backup
        folder once a quarter. The data lives in Firestore but a flat CSV is
        the cheapest possible disaster-recovery snapshot.
      </p>
    </div>
  );
}
