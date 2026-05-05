"use client";

// app/admin/bookings/SmartFilters.tsx
// Preset filter chips that apply common combinations of filters.

export type SmartFilter =
  | "all"
  | "hot-leads"
  | "needs-follow-up"
  | "high-value"
  | "this-week"
  | "weddings";

const SMART_FILTERS: { id: SmartFilter; label: string; description: string }[] = [
  { id: "all",            label: "All",            description: "Every active inquiry" },
  { id: "hot-leads",      label: "🔥 Hot Leads",   description: "Score ≥ 80" },
  { id: "needs-follow-up",label: "⏰ Follow-Up",   description: "Overdue follow-up dates" },
  { id: "high-value",     label: "💎 High Value",  description: "Estimated value ≥ $2,500" },
  { id: "this-week",      label: "📅 This Week",   description: "Preferred date within 7 days" },
  { id: "weddings",       label: "💍 Weddings",    description: "Session type: Wedding" },
];

interface SmartFiltersProps {
  active: SmartFilter;
  onChange: (f: SmartFilter) => void;
  counts: Partial<Record<SmartFilter, number>>;
}

export function SmartFilters({ active, onChange, counts }: SmartFiltersProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.4rem",
        flexWrap: "wrap",
        padding: "0.75rem 0",
      }}
    >
      {SMART_FILTERS.map((f) => {
        const isActive = active === f.id;
        const count = counts[f.id];
        return (
          <button
            key={f.id}
            onClick={() => onChange(f.id)}
            title={f.description}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.38rem 0.85rem",
              fontSize: "0.65rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
              background: isActive ? "var(--charcoal)" : "transparent",
              color: isActive ? "var(--white)" : "var(--charcoal)",
              border: `0.5px solid ${isActive ? "var(--charcoal)" : "var(--border-strong)"}`,
              fontFamily: "'Jost', sans-serif",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}
          >
            {f.label}
            {count !== undefined && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "16px",
                  height: "16px",
                  borderRadius: "8px",
                  background: isActive ? "rgba(250,249,246,0.2)" : "var(--olive-dim)",
                  color: isActive ? "var(--white)" : "var(--olive)",
                  fontSize: "0.58rem",
                  fontWeight: 600,
                  padding: "0 3px",
                }}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Filter predicate ─────────────────────────────────────────────────────────
// Applied client-side after the full list is fetched.

export type InquiryForFilter = {
  sessionType: string;
  leadScore?: number;
  estimatedValue?: number | null;
  followUpDate?: string | null;
  preferredDate?: string | null;
  status: string;
};

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function applySmartFilter<T extends InquiryForFilter>(
  inquiries: T[],
  filter: SmartFilter
): T[] {
  const now = new Date();
  switch (filter) {
    case "all":
      return inquiries;

    case "hot-leads":
      return inquiries.filter((i) => (i.leadScore ?? 0) >= 80);

    case "needs-follow-up":
      return inquiries.filter((i) => {
        if (!i.followUpDate) return false;
        const d = new Date(i.followUpDate);
        return d <= now && i.status !== "BOOKED" && i.status !== "ARCHIVED";
      });

    case "high-value":
      return inquiries.filter((i) => (i.estimatedValue ?? 0) >= 2500);

    case "this-week":
      return inquiries.filter((i) => {
        if (!i.preferredDate) return false;
        const d = new Date(i.preferredDate);
        const days = daysBetween(now, d);
        return days >= 0 && days <= 7;
      });

    case "weddings":
      return inquiries.filter((i) => i.sessionType === "Wedding");

    default:
      return inquiries;
  }
}