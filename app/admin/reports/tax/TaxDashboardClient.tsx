"use client";

// app/admin/reports/tax/TaxDashboardClient.tsx
// Renders the tax + expense dashboard: KPI tiles, Schedule C donut, mileage,
// equipment depreciation, expenses table with inline create, and the
// tax-saving calendar (Phase 13.8).

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { toast } from "@/components/ui/Toaster";
import type { ScheduleCLine } from "@/lib/db/expenses";
import type { DepreciationMethod } from "@/lib/db/assets";
import {
  createExpenseAction,
  deleteExpenseAction,
  createAssetAction,
} from "./actions";

// ─── Serialized shapes ────────────────────────────────────────────────────────
// Defined here (not in page.tsx) so the client bundle never picks up server-only
// imports through a type re-export. Matches the locations pattern.

export interface SerializedExpense {
  id: string;
  date: string; // ISO
  vendor: string | null;
  description: string;
  amountCents: number;
  scheduleCLine: ScheduleCLine;
  projectId: string | null;
  mileageMiles: number | null;
  isReimbursable: boolean;
  receiptR2Key: string | null;
  taxDeductible: boolean;
}

export interface SerializedAsset {
  id: string;
  name: string;
  description: string | null;
  purchaseDate: string; // ISO
  purchasePriceCents: number;
  depreciationMethod: DepreciationMethod;
  placedInServiceDate: string; // ISO
  section179Cents: number | null;
  salvageValueCents: number | null;
  retiredAt: string | null;
  photoR2Key: string | null;
  currentYearDepreciationCents: number;
}

export interface CategoryBreakdown {
  category: ScheduleCLine;
  label: string;
  amountCents: number;
}

// Mirrors the server-side maps in `lib/db/expenses.ts`. Duplicated here so the
// client bundle never reaches into Firebase Admin (which `lib/db/*` imports).
// Keep in sync with `SCHEDULE_C_LABELS` / `MILEAGE_RATE_2025_CENTS_PER_MILE`.
const SCHEDULE_C_LABELS: Record<ScheduleCLine, string> = {
  ADVERTISING: "Advertising",
  CAR_TRUCK: "Car & truck",
  COMMISSIONS: "Commissions & fees",
  CONTRACT_LABOR: "Contract labor",
  DEPRECIATION: "Depreciation",
  INSURANCE: "Insurance",
  LEGAL_PROF: "Legal & professional",
  OFFICE: "Office expense",
  RENT_LEASE: "Rent or lease",
  REPAIRS: "Repairs & maintenance",
  SUPPLIES: "Supplies",
  TAXES_LICENSES: "Taxes & licenses",
  TRAVEL: "Travel",
  MEALS: "Meals (50% deductible)",
  UTILITIES: "Utilities",
  OTHER: "Other",
};
const MILEAGE_RATE_2025_CENTS_PER_MILE = 70;

// ─── Props ────────────────────────────────────────────────────────────────────

interface Data {
  year: number;
  ytdIncomeCents: number;
  ytdRefundsCents: number;
  ytdExpensesCents: number;
  ytdNetCents: number;
  taxRatePct: number;
  taxReserveCents: number;
  categoryBreakdown: CategoryBreakdown[];
  mileageTotalMiles: number;
  mileageDeductionCents: number;
  expenses: SerializedExpense[];
  assets: SerializedAsset[];
  totalDepreciationCents: number;
}

interface Props {
  data: Data;
  depreciationMethodLabels: Record<DepreciationMethod, string>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatUSDPrecise(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Olive-tinted palette so the chart matches the design system.
const DONUT_COLORS = [
  "#6B7845",
  "#8A9A5A",
  "#A8B57A",
  "#4A5530",
  "#C4CFA0",
  "#5C6B3B",
  "#9DA86B",
  "#7A8855",
  "#B5C18C",
  "#3F4828",
];

// ─── Tax-saving calendar (Phase 13.8) ─────────────────────────────────────────

const TAX_CALENDAR_ITEMS: { month: number; title: string; body: string }[] = [
  {
    month: 1,
    title: "Q4 estimated tax due",
    body: "Final 2024 estimated payment due Jan 15. Reconcile YTD net.",
  },
  {
    month: 4,
    title: "Q1 estimated tax due",
    body: "Federal Q1 estimated payment due Apr 15. File the prior year return.",
  },
  {
    month: 6,
    title: "Q2 estimated tax due",
    body: "Federal Q2 estimated payment due Jun 15.",
  },
  {
    month: 8,
    title: "Section 179 mid-year check",
    body: "Mid-year gear purchases get the full §179 deduction in the same tax year. Plan upgrades now.",
  },
  {
    month: 9,
    title: "Q3 estimated tax due",
    body: "Federal Q3 estimated payment due Sep 15.",
  },
  {
    month: 11,
    title: "Equipment buy-window",
    body: "Last clean month to place equipment in service before Dec 31 and claim full-year depreciation.",
  },
  {
    month: 12,
    title: "SEP IRA + charitable giving",
    body: "SEP IRA contributions reduce taxable income. Bunch charitable giving into the higher-income year.",
  },
];

function getCurrentQuarterTaxItems(): typeof TAX_CALENDAR_ITEMS {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const ahead = TAX_CALENDAR_ITEMS.filter((i) => i.month >= currentMonth);
  // If we are late in the year (e.g. Dec), still surface the upcoming Jan item.
  if (ahead.length === 0) {
    return TAX_CALENDAR_ITEMS.slice(0, 4);
  }
  // Take the next four upcoming items, wrap into the new year if needed.
  if (ahead.length >= 4) return ahead.slice(0, 4);
  return [...ahead, ...TAX_CALENDAR_ITEMS.slice(0, 4 - ahead.length)];
}

// ─── Inline Expense Form ──────────────────────────────────────────────────────

function NewExpenseForm({ onCreated }: { onCreated: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [scheduleCLine, setScheduleCLine] = useState<ScheduleCLine>("SUPPLIES");
  const [mileageMiles, setMileageMiles] = useState<string>("");
  const [taxDeductible, setTaxDeductible] = useState(true);
  const [submitting, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim()) {
      toast("Description is required.");
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      toast("Amount must be a non-negative number.");
      return;
    }
    startTransition(async () => {
      const result = await createExpenseAction({
        date,
        vendor: vendor.trim() || undefined,
        description: description.trim(),
        amount: amt,
        scheduleCLine,
        mileageMiles: mileageMiles ? Number(mileageMiles) : undefined,
        taxDeductible,
      });
      if (result.success) {
        toast("Expense added");
        setVendor("");
        setDescription("");
        setAmount("");
        setMileageMiles("");
        onCreated();
      } else {
        toast(result.error);
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.6rem",
    fontSize: "0.78rem",
    border: "0.5px solid var(--border)",
    background: "var(--white)",
    color: "var(--charcoal)",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.62rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--charcoal-muted)",
    marginBottom: "0.3rem",
    display: "block",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
        gap: "0.75rem",
        padding: "1rem",
        border: "0.5px solid var(--border)",
        background: "rgba(107,120,69,0.04)",
        marginBottom: "1rem",
      }}
    >
      <div>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Vendor</label>
        <input
          type="text"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          placeholder="B&H Photo"
          style={inputStyle}
        />
      </div>
      <div style={{ gridColumn: "span 2" }}>
        <label style={labelStyle}>Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          placeholder="SD card + reader"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Amount (USD)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Schedule C line</label>
        <select
          value={scheduleCLine}
          onChange={(e) => setScheduleCLine(e.target.value as ScheduleCLine)}
          style={inputStyle}
        >
          {(Object.entries(SCHEDULE_C_LABELS) as [ScheduleCLine, string][]).map(
            ([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            )
          )}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Miles (optional)</label>
        <input
          type="number"
          step="1"
          min="0"
          value={mileageMiles}
          onChange={(e) => setMileageMiles(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", alignItems: "end" }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "var(--charcoal-light)",
            paddingBottom: "0.5rem",
          }}
        >
          <input
            type="checkbox"
            checked={taxDeductible}
            onChange={(e) => setTaxDeductible(e.target.checked)}
          />
          Tax deductible
        </label>
      </div>
      <div style={{ display: "flex", alignItems: "end" }}>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.55rem 1rem",
            background: "var(--olive)",
            color: "var(--white)",
            border: "none",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.5 : 1,
            width: "100%",
          }}
        >
          {submitting ? "Saving…" : "Add expense"}
        </button>
      </div>
      <div
        style={{
          gridColumn: "1 / -1",
          fontSize: "0.68rem",
          color: "var(--charcoal-muted)",
        }}
      >
        Receipts: TODO — receipt upload to R2 will land in a follow-up. For now
        keep PDF receipts in your usual folder; this dashboard tracks the line
        items.
      </div>
    </form>
  );
}

// ─── Inline Asset Form ────────────────────────────────────────────────────────

function NewAssetForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [depreciationMethod, setDepreciationMethod] =
    useState<DepreciationMethod>("MACRS_5");
  const [submitting, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(purchasePrice);
    if (!name.trim()) {
      toast("Asset name is required.");
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      toast("Price must be non-negative.");
      return;
    }
    startTransition(async () => {
      const result = await createAssetAction({
        name: name.trim(),
        purchaseDate,
        purchasePrice: amt,
        depreciationMethod,
      });
      if (result.success) {
        toast("Asset added");
        setName("");
        setPurchasePrice("");
        onCreated();
      } else {
        toast(result.error);
      }
    });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.5rem 0.6rem",
    fontSize: "0.78rem",
    border: "0.5px solid var(--border)",
    background: "var(--white)",
    color: "var(--charcoal)",
    fontFamily: "inherit",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "0.62rem",
    letterSpacing: "0.18em",
    textTransform: "uppercase",
    color: "var(--charcoal-muted)",
    marginBottom: "0.3rem",
    display: "block",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
        gap: "0.75rem",
        padding: "1rem",
        border: "0.5px solid var(--border)",
        background: "rgba(107,120,69,0.04)",
        marginBottom: "1rem",
        alignItems: "end",
      }}
    >
      <div>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Sony A7R V"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Purchase date</label>
        <input
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Price (USD)</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={purchasePrice}
          onChange={(e) => setPurchasePrice(e.target.value)}
          required
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Depreciation</label>
        <select
          value={depreciationMethod}
          onChange={(e) =>
            setDepreciationMethod(e.target.value as DepreciationMethod)
          }
          style={inputStyle}
        >
          <option value="MACRS_5">MACRS 5-year</option>
          <option value="MACRS_7">MACRS 7-year</option>
          <option value="SECTION_179">Section 179</option>
          <option value="BONUS">Bonus depreciation</option>
          <option value="NONE">None</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={submitting}
        style={{
          padding: "0.55rem 1rem",
          background: "var(--olive)",
          color: "var(--white)",
          border: "none",
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          cursor: submitting ? "wait" : "pointer",
          opacity: submitting ? 0.5 : 1,
        }}
      >
        {submitting ? "Saving…" : "Add asset"}
      </button>
    </form>
  );
}

// ─── KPI Tile ────────────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        padding: "1.25rem 1.25rem",
        border: "0.5px solid var(--border)",
        background: accent ? "rgba(107,120,69,0.06)" : "var(--white)",
      }}
    >
      <div
        style={{
          fontSize: "0.6rem",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.9rem",
          fontWeight: 400,
          color: accent ? "var(--olive)" : "var(--charcoal)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "0.4rem",
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function TaxDashboardClient({ data, depreciationMethodLabels }: Props) {
  const router = useRouter();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"ALL" | ScheduleCLine>("ALL");
  const [deleting, startDeleteTransition] = useTransition();

  // Year picker (last 3 years).
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const filteredExpenses = useMemo(() => {
    if (filterCategory === "ALL") return data.expenses;
    return data.expenses.filter((e) => e.scheduleCLine === filterCategory);
  }, [data.expenses, filterCategory]);

  const handleYearChange = (y: number) => {
    router.push(`/admin/reports/tax?year=${y}`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this expense?")) return;
    startDeleteTransition(async () => {
      const result = await deleteExpenseAction(id);
      if (result.success) {
        toast("Expense deleted");
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  };

  const calendarItems = getCurrentQuarterTaxItems();

  return (
    <div className="page-fade-in" style={{ padding: "0 0 4rem" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "2rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.4rem",
            }}
          >
            Reports
          </p>
          <h1
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.4rem",
              fontWeight: 300,
              color: "var(--charcoal)",
            }}
          >
            Tax <em style={{ color: "var(--olive)" }}>&amp;</em> Expenses
          </h1>
          <p
            style={{
              fontSize: "0.82rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.25rem",
            }}
          >
            YTD profit, expense ledger, equipment depreciation, and a tax-saving
            calendar. Sales tax invoicing is a TODO (Phase 3.11).
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
            }}
          >
            Year
          </label>
          <select
            value={data.year}
            onChange={(e) => handleYearChange(Number(e.target.value))}
            style={{
              padding: "0.45rem 0.75rem",
              fontSize: "0.78rem",
              border: "0.5px solid var(--border)",
              background: "var(--white)",
              color: "var(--charcoal)",
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <a
            href={`/api/expenses/export?year=${data.year}`}
            style={{
              padding: "0.45rem 0.9rem",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              border: "0.5px solid var(--olive)",
              color: "var(--olive)",
              background: "var(--white)",
              textDecoration: "none",
            }}
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* KPI Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2.5rem",
        }}
      >
        <KpiTile
          label={`${data.year} Income`}
          value={formatUSD(data.ytdIncomeCents - data.ytdRefundsCents)}
          sub={
            data.ytdRefundsCents > 0
              ? `${formatUSD(data.ytdIncomeCents)} gross · ${formatUSD(
                  data.ytdRefundsCents
                )} refunded`
              : "Paid invoices, net of refunds"
          }
        />
        <KpiTile
          label={`${data.year} Expenses`}
          value={formatUSD(data.ytdExpensesCents)}
          sub={`incl. ${formatUSD(data.mileageDeductionCents)} mileage + ${formatUSD(
            data.totalDepreciationCents
          )} depreciation`}
        />
        <KpiTile
          label={`${data.year} Net`}
          value={formatUSD(data.ytdNetCents)}
          sub="Income − expenses − mileage − depreciation"
          accent={data.ytdNetCents > 0}
        />
        <KpiTile
          label="Tax reserve recommendation"
          value={formatUSD(data.taxReserveCents)}
          sub={`${(data.taxRatePct * 100).toFixed(0)}% of YTD net · set users/{uid}.taxRate to override`}
          accent
        />
      </div>

      {/* Tax Saving Calendar */}
      <section style={{ marginBottom: "2.5rem" }}>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.4rem",
            fontWeight: 400,
            color: "var(--charcoal)",
            marginBottom: "0.8rem",
          }}
        >
          Tax-saving calendar
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {calendarItems.map((item) => {
            const monthName = new Date(2000, item.month - 1, 1).toLocaleString(
              "en-US",
              { month: "long" }
            );
            return (
              <div
                key={`${item.month}-${item.title}`}
                style={{
                  padding: "1rem",
                  border: "0.5px solid var(--border)",
                  background: "var(--white)",
                }}
              >
                <p
                  style={{
                    fontSize: "0.6rem",
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    color: "var(--olive)",
                    marginBottom: "0.5rem",
                  }}
                >
                  {monthName}
                </p>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: "1.05rem",
                    color: "var(--charcoal)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {item.title}
                </div>
                <p
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--charcoal-light)",
                    lineHeight: 1.5,
                  }}
                >
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Donut + Mileage */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 1fr) minmax(240px, 1fr)",
          gap: "1.5rem",
          marginBottom: "2.5rem",
        }}
      >
        <div
          style={{
            padding: "1.25rem",
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.2rem",
              fontWeight: 400,
              color: "var(--charcoal)",
              marginBottom: "1rem",
            }}
          >
            Schedule C breakdown
          </h3>
          {data.categoryBreakdown.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
              No deductible expenses recorded for {data.year} yet.
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    dataKey="amountCents"
                    nameKey="label"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={1}
                    stroke="var(--white)"
                  >
                    {data.categoryBreakdown.map((entry, idx) => (
                      <Cell
                        key={entry.category}
                        fill={DONUT_COLORS[idx % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value) =>
                      typeof value === "number" ? formatUSD(value) : String(value)
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <ul style={{ marginTop: "0.75rem", listStyle: "none", padding: 0 }}>
            {data.categoryBreakdown.slice(0, 6).map((c, idx) => (
              <li
                key={c.category}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.74rem",
                  color: "var(--charcoal-light)",
                  padding: "0.2rem 0",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      background: DONUT_COLORS[idx % DONUT_COLORS.length],
                      display: "inline-block",
                    }}
                  />
                  {c.label}
                </span>
                <span>{formatUSD(c.amountCents)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            padding: "1.25rem",
            border: "0.5px solid var(--border)",
            background: "var(--white)",
          }}
        >
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.2rem",
              fontWeight: 400,
              color: "var(--charcoal)",
              marginBottom: "1rem",
            }}
          >
            Mileage
          </h3>
          <p
            style={{
              fontSize: "0.7rem",
              color: "var(--charcoal-muted)",
              marginBottom: "0.6rem",
            }}
          >
            Standard rate: ${(MILEAGE_RATE_2025_CENTS_PER_MILE / 100).toFixed(2)}/mi (2025 IRS)
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: "0.8rem",
              marginBottom: "0.6rem",
            }}
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: "2.2rem",
                color: "var(--charcoal)",
              }}
            >
              {data.mileageTotalMiles.toLocaleString()}
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--charcoal-muted)" }}>
              miles tracked
            </div>
          </div>
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--olive)",
              fontWeight: 500,
            }}
          >
            {formatUSD(data.mileageDeductionCents)} deduction
          </div>
          <p
            style={{
              fontSize: "0.72rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.8rem",
              lineHeight: 1.5,
            }}
          >
            Log a trip by adding an expense with the &ldquo;Miles&rdquo; field set.
            CAR_TRUCK rows track the deduction; the standard rate replaces fuel
            + maintenance receipts.
          </p>
        </div>
      </section>

      {/* Equipment + depreciation */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.8rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.4rem",
              fontWeight: 400,
              color: "var(--charcoal)",
            }}
          >
            Equipment depreciation
          </h2>
          <button
            onClick={() => setShowAssetForm((s) => !s)}
            style={{
              padding: "0.4rem 0.9rem",
              fontSize: "0.7rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              border: "0.5px solid var(--olive)",
              color: "var(--olive)",
              background: "var(--white)",
              cursor: "pointer",
            }}
          >
            {showAssetForm ? "Cancel" : "+ Add asset"}
          </button>
        </div>
        {showAssetForm && (
          <NewAssetForm
            onCreated={() => {
              setShowAssetForm(false);
              router.refresh();
            }}
          />
        )}
        {data.assets.length === 0 ? (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--charcoal-muted)",
              padding: "1rem",
              border: "0.5px dashed var(--border)",
            }}
          >
            No depreciable assets recorded yet. Add cameras, lenses, computers,
            and lighting to track MACRS / §179 deductions.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    fontSize: "0.62rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Asset</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Purchased</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Method</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>Basis</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>{data.year} Deduction</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.map((a) => (
                  <tr key={a.id} style={{ color: "var(--charcoal-light)" }}>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      <div style={{ color: "var(--charcoal)" }}>{a.name}</div>
                      {a.description && (
                        <div style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
                          {a.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {formatDate(a.purchaseDate)}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {depreciationMethodLabels[a.depreciationMethod]}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>
                      {formatUSDPrecise(a.purchasePriceCents)}
                    </td>
                    <td
                      style={{
                        padding: "0.6rem 0.75rem",
                        borderBottom: "0.5px solid var(--border)",
                        textAlign: "right",
                        color:
                          a.currentYearDepreciationCents > 0
                            ? "var(--olive)"
                            : "var(--charcoal-muted)",
                      }}
                    >
                      {formatUSDPrecise(a.currentYearDepreciationCents)}
                    </td>
                  </tr>
                ))}
                <tr style={{ background: "rgba(107,120,69,0.04)", fontWeight: 500 }}>
                  <td colSpan={4} style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "var(--charcoal)" }}>
                    Total {data.year} depreciation
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right", color: "var(--olive)" }}>
                    {formatUSDPrecise(data.totalDepreciationCents)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expenses table + form */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "0.8rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.4rem",
              fontWeight: 400,
              color: "var(--charcoal)",
            }}
          >
            Expenses
          </h2>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <select
              value={filterCategory}
              onChange={(e) =>
                setFilterCategory(e.target.value as "ALL" | ScheduleCLine)
              }
              style={{
                padding: "0.4rem 0.7rem",
                fontSize: "0.74rem",
                border: "0.5px solid var(--border)",
                background: "var(--white)",
                color: "var(--charcoal)",
              }}
            >
              <option value="ALL">All categories</option>
              {(Object.entries(SCHEDULE_C_LABELS) as [ScheduleCLine, string][]).map(
                ([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                )
              )}
            </select>
            <button
              onClick={() => setShowExpenseForm((s) => !s)}
              style={{
                padding: "0.4rem 0.9rem",
                fontSize: "0.7rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                border: "0.5px solid var(--olive)",
                color: "var(--olive)",
                background: "var(--white)",
                cursor: "pointer",
              }}
            >
              {showExpenseForm ? "Cancel" : "+ Add expense"}
            </button>
          </div>
        </div>

        {showExpenseForm && (
          <NewExpenseForm
            onCreated={() => {
              setShowExpenseForm(false);
              router.refresh();
            }}
          />
        )}

        {filteredExpenses.length === 0 ? (
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--charcoal-muted)",
              padding: "1rem",
              border: "0.5px dashed var(--border)",
            }}
          >
            No expenses for the selected filter.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    fontSize: "0.62rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "var(--charcoal-muted)",
                  }}
                >
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Date</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Vendor</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Description</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Category</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>Miles</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>Project</th>
                  <th style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }} />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr
                    key={e.id}
                    style={{
                      color: "var(--charcoal-light)",
                      opacity: e.taxDeductible ? 1 : 0.55,
                    }}
                  >
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {formatDate(e.date)}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {e.vendor ?? "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", color: "var(--charcoal)" }}>
                      {e.description}
                      {!e.taxDeductible && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: "0.6rem",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: "var(--charcoal-muted)",
                          }}
                        >
                          · non-deductible
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {SCHEDULE_C_LABELS[e.scheduleCLine]}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>
                      {e.mileageMiles ?? "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)", textAlign: "right" }}>
                      {formatUSDPrecise(e.amountCents)}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      {e.projectId ? (
                        <Link
                          href={`/admin/projects/${e.projectId}`}
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--olive)",
                            textDecoration: "none",
                          }}
                        >
                          View →
                        </Link>
                      ) : (
                        <span style={{ color: "var(--charcoal-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", borderBottom: "0.5px solid var(--border)" }}>
                      <button
                        onClick={() => handleDelete(e.id)}
                        disabled={deleting}
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--charcoal-muted)",
                          background: "none",
                          border: "none",
                          cursor: deleting ? "wait" : "pointer",
                          textDecoration: "underline",
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
