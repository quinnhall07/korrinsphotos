"use client";

// app/admin/vendors/VendorsClientPage.tsx
// Client-side list/grid for the vendor network. Handles category + search
// filters, sort, and a modal for creating a new vendor.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { createVendor } from "./actions";
import type { VendorCategory } from "@/lib/db/vendors";

// Re-declared locally so this client component doesn't pull lib/db/vendors
// (server-only — imports adminDb) into the browser bundle.
const VENDOR_CATEGORIES: VendorCategory[] = [
  "VENUE",
  "PLANNER",
  "FLORIST",
  "HMUA",
  "VIDEOGRAPHER",
  "DJ",
  "OFFICIANT",
  "RENTALS",
  "CATERER",
  "BAKER",
  "STATIONERY",
  "OTHER",
];

export interface SerializedVendor {
  id: string;
  name: string;
  category: VendorCategory;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  city: string | null;
  state: string | null;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  isPreferred: boolean;
  referralsSent: number;
  referralsReceived: number;
  lastWorkedWith: string | null;
  lastWorkedWithMs: number | null;
  lastReciprocatedAt: string | null;
  lastReciprocatedAtMs: number | null;
  tags: string[];
  createdAtMs: number;
}

type SortKey =
  | "lastWorked"
  | "name"
  | "rating"
  | "referralsReceived"
  | "reciprocityVolume";

// Imbalance threshold — if (sent - received) >= IMBALANCE_GAP, flag the vendor
// as taking more than they give. Same threshold is used on the detail page.
export const IMBALANCE_GAP = 5;
export function isImbalanced(sent: number, received: number): boolean {
  return sent - received >= IMBALANCE_GAP;
}

const CATEGORY_LABELS: Record<VendorCategory, string> = {
  VENUE: "Venue",
  PLANNER: "Planner",
  FLORIST: "Florist",
  HMUA: "HMUA",
  VIDEOGRAPHER: "Videographer",
  DJ: "DJ",
  OFFICIANT: "Officiant",
  RENTALS: "Rentals",
  CATERER: "Caterer",
  BAKER: "Baker",
  STATIONERY: "Stationery",
  OTHER: "Other",
};

interface Props {
  vendors: SerializedVendor[];
}

export function VendorsClientPage({ vendors }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<VendorCategory | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("lastWorked");
  const [showModal, setShowModal] = useState(false);

  const filtered = useMemo(() => {
    let out = vendors;
    if (category !== "ALL") out = out.filter((v) => v.category === category);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          (v.city ?? "").toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...out];
    sorted.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sort === "referralsReceived")
        return b.referralsReceived - a.referralsReceived;
      if (sort === "reciprocityVolume")
        return (
          b.referralsSent + b.referralsReceived -
          (a.referralsSent + a.referralsReceived)
        );
      // lastWorked desc, falling back to createdAt
      const aMs = a.lastWorkedWithMs ?? a.createdAtMs;
      const bMs = b.lastWorkedWithMs ?? b.createdAtMs;
      return bMs - aMs;
    });
    return sorted;
  }, [vendors, category, search, sort]);

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "2rem",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.65rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              marginBottom: "0.3rem",
            }}
          >
            Vendor Network
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2rem",
              fontWeight: 300,
              margin: 0,
            }}
          >
            Vendors
          </h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
            }}
          >
            {vendors.length} vendor{vendors.length !== 1 ? "s" : ""} in network
          </p>
        </div>

        <button type="button" onClick={() => setShowModal(true)} style={btnOlive}>
          + New Vendor
        </button>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 220px 220px",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <input
          type="text"
          placeholder="Search by name, city, or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as VendorCategory | "ALL")}
          style={inputStyle}
        >
          <option value="ALL">All categories</option>
          {VENDOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          style={inputStyle}
        >
          <option value="lastWorked">Sort: Last worked</option>
          <option value="name">Sort: Name</option>
          <option value="rating">Sort: Rating</option>
          <option value="referralsReceived">Sort: Referrals received</option>
          <option value="reciprocityVolume">Sort: Reciprocity volume</option>
        </select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          empty={vendors.length === 0}
          onNew={() => setShowModal(true)}
        />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
          }}
        >
          {filtered.map((v) => (
            <VendorCard key={v.id} vendor={v} />
          ))}
        </div>
      )}

      {/* New vendor modal */}
      {showModal && <NewVendorModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ empty, onNew }: { empty: boolean; onNew: () => void }) {
  return (
    <div
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--white)",
        padding: "3rem 2rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.4rem",
          fontWeight: 300,
          color: "var(--charcoal)",
          margin: 0,
        }}
      >
        {empty
          ? "No vendors yet."
          : "No vendors match those filters."}
      </p>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--charcoal-muted)",
          marginTop: "0.6rem",
          marginBottom: "1.4rem",
        }}
      >
        {empty
          ? "Add your first to build your network."
          : "Try clearing the search or selecting a different category."}
      </p>
      {empty && (
        <button type="button" onClick={onNew} style={btnOlive}>
          + New Vendor
        </button>
      )}
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────────────────────

function VendorCard({ vendor }: { vendor: SerializedVendor }) {
  const location = [vendor.city, vendor.state].filter(Boolean).join(", ");
  return (
    <Link
      href={`/admin/vendors/${vendor.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border)",
          padding: "1.25rem 1.4rem",
          transition: "border-color 0.15s, transform 0.1s",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-strong)";
          e.currentTarget.style.transform = "translateY(-1px)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border)";
          e.currentTarget.style.transform = "none";
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          {CATEGORY_LABELS[vendor.category]}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h3
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "1.35rem",
              fontWeight: 400,
              margin: 0,
              color: "var(--charcoal)",
              flex: 1,
              lineHeight: 1.2,
            }}
          >
            {vendor.name}
          </h3>
          {vendor.isPreferred && (
            <span
              title="Preferred vendor"
              style={{
                fontSize: "0.9rem",
                color: "var(--olive)",
                lineHeight: 1,
              }}
              aria-label="Preferred"
            >
              ★
            </span>
          )}
        </div>

        <RatingDots rating={vendor.rating} />

        {location && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-light)",
              margin: 0,
            }}
          >
            {location}
          </p>
        )}

        <ReciprocityCell vendor={vendor} />
      </div>
    </Link>
  );
}

// ─── Reciprocity cell (also serves as the list "Reciprocity column") ───────────

function ReciprocityCell({ vendor }: { vendor: SerializedVendor }) {
  const sent = vendor.referralsSent;
  const received = vendor.referralsReceived;
  const imbalanced = isImbalanced(sent, received);
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
        paddingTop: "0.65rem",
        borderTop: "0.5px solid var(--border)",
        fontSize: "0.72rem",
        color: "var(--charcoal-muted)",
        marginTop: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <span style={{ color: "var(--charcoal-light)" }}>
          <strong style={{ color: "var(--charcoal)", fontWeight: 500 }}>
            {sent}
          </strong>{" "}
          sent /{" "}
          <strong style={{ color: "var(--charcoal)", fontWeight: 500 }}>
            {received}
          </strong>{" "}
          received
        </span>
        {imbalanced && <ImbalancePill />}
      </div>
      {vendor.lastReciprocatedAt && (
        <span style={{ fontSize: "0.68rem" }}>
          Last activity: {vendor.lastReciprocatedAt}
        </span>
      )}
    </div>
  );
}

export function ImbalancePill() {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.2rem 0.5rem",
        fontSize: "0.65rem",
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "#8B2E2E",
        background: "#FCEFEF",
        border: "0.5px solid #8B2E2E",
        whiteSpace: "nowrap",
      }}
    >
      Imbalanced
    </span>
  );
}

function RatingDots({ rating }: { rating: 1 | 2 | 3 | 4 | 5 | null }) {
  if (rating == null) {
    return (
      <p
        style={{
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          margin: 0,
        }}
      >
        Unrated
      </p>
    );
  }
  return (
    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: n <= rating ? "var(--olive)" : "transparent",
            border: "0.5px solid var(--olive)",
            display: "inline-block",
          }}
          aria-hidden
        />
      ))}
      <span
        style={{
          fontSize: "0.7rem",
          color: "var(--charcoal-muted)",
          marginLeft: "0.35rem",
        }}
      >
        {rating} / 5
      </span>
    </div>
  );
}

// ─── New Vendor Modal ──────────────────────────────────────────────────────────

function NewVendorModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    category: "VENUE" as VendorCategory,
    email: "",
    phone: "",
    website: "",
    instagramHandle: "",
    city: "",
    state: "",
    rating: "" as "" | "1" | "2" | "3" | "4" | "5",
    isPreferred: false,
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast("Vendor name is required");
      return;
    }
    startTransition(async () => {
      const result = await createVendor({
        name,
        category: form.category,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        instagramHandle: form.instagramHandle.trim() || undefined,
        city: form.city.trim() || undefined,
        state: form.state.trim() || undefined,
        rating: form.rating ? (Number(form.rating) as 1 | 2 | 3 | 4 | 5) : undefined,
        isPreferred: form.isPreferred,
      });
      if (result.success) {
        toast("Vendor added");
        onClose();
        router.refresh();
      } else {
        toast(result.error ?? "Failed to add vendor");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        zIndex: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--white)",
          border: "0.5px solid var(--border-strong)",
          padding: "1.8rem 2rem",
          width: "100%",
          maxWidth: "520px",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <p
          style={{
            fontSize: "0.6rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--olive)",
            margin: 0,
          }}
        >
          New Vendor
        </p>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.7rem",
            fontWeight: 300,
            margin: "0.3rem 0 1.4rem",
          }}
        >
          Add to network
        </h3>

        <div style={{ display: "grid", gap: "0.85rem" }}>
          <Field label="Name *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              required
              style={inputStyle}
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={(e) => update("category", e.target.value as VendorCategory)}
              style={inputStyle}
            >
              {VENDOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => update("phone", e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem" }}>
            <Field label="Website">
              <input
                type="url"
                value={form.website}
                onChange={(e) => update("website", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="Instagram">
              <input
                type="text"
                placeholder="@handle"
                value={form.instagramHandle}
                onChange={(e) => update("instagramHandle", e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.85rem" }}>
            <Field label="City">
              <input
                type="text"
                value={form.city}
                onChange={(e) => update("city", e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label="State">
              <input
                type="text"
                value={form.state}
                onChange={(e) => update("state", e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", alignItems: "end" }}>
            <Field label="Rating">
              <select
                value={form.rating}
                onChange={(e) => update("rating", e.target.value as typeof form.rating)}
                style={inputStyle}
              >
                <option value="">Unrated</option>
                <option value="1">1 / 5</option>
                <option value="2">2 / 5</option>
                <option value="3">3 / 5</option>
                <option value="4">4 / 5</option>
                <option value="5">5 / 5</option>
              </select>
            </Field>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.82rem",
                color: "var(--charcoal)",
                paddingBottom: "0.6rem",
              }}
            >
              <input
                type="checkbox"
                checked={form.isPreferred}
                onChange={(e) => update("isPreferred", e.target.checked)}
              />
              Preferred vendor
            </label>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.6rem",
            marginTop: "1.6rem",
          }}
        >
          <button type="button" onClick={onClose} style={btnOutline} disabled={isPending}>
            Cancel
          </button>
          <button type="submit" style={btnOlive} disabled={isPending}>
            {isPending ? "Saving…" : "Add Vendor"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "block",
          fontSize: "0.62rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.35rem",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.7rem 0.9rem",
  fontSize: "0.85rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOutline: React.CSSProperties = {
  padding: "0.85rem 2.2rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
