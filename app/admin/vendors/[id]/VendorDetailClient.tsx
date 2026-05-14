"use client";

// app/admin/vendors/[id]/VendorDetailClient.tsx
// Interactive vendor detail. Inline edit form, preferred toggle, reciprocity
// counters, delete-with-confirm. Receives serialised props from page.tsx.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import {
  deleteVendor,
  incrementReferralReceived,
  incrementReferralSent,
  updateVendor,
} from "../actions";
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

export interface SerializedVendorDetail {
  id: string;
  name: string;
  category: VendorCategory;
  email: string | null;
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  isPreferred: boolean;
  referralsSent: number;
  referralsReceived: number;
  lastWorkedWith: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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

export function VendorDetailClient({ vendor }: { vendor: SerializedVendorDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);

  function togglePreferred() {
    startTransition(async () => {
      const result = await updateVendor(vendor.id, {
        isPreferred: !vendor.isPreferred,
      });
      if (result.success) {
        toast(vendor.isPreferred ? "Removed from preferred" : "Marked preferred");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to update");
      }
    });
  }

  function handleSent() {
    startTransition(async () => {
      const result = await incrementReferralSent(vendor.id);
      if (result.success) {
        toast("Referral sent recorded");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to record");
      }
    });
  }

  function handleReceived() {
    startTransition(async () => {
      const result = await incrementReferralReceived(vendor.id);
      if (result.success) {
        toast("Referral received recorded");
        router.refresh();
      } else {
        toast(result.error ?? "Failed to record");
      }
    });
  }

  function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${vendor.name}"?\n\nThis cannot be undone. All notes, tags, and reciprocity counters will be lost.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteVendor(vendor.id);
      if (result.success) {
        toast("Vendor deleted");
        router.push("/admin/vendors");
      } else {
        toast(result.error ?? "Failed to delete");
      }
    });
  }

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1.5rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--olive)",
              margin: 0,
            }}
          >
            {CATEGORY_LABELS[vendor.category]}
          </p>
          <h2
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "2.2rem",
              fontWeight: 300,
              margin: "0.3rem 0 0.5rem",
            }}
          >
            {vendor.name}
          </h2>
          <RatingDots rating={vendor.rating} />
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={togglePreferred}
            disabled={isPending}
            style={vendor.isPreferred ? btnOlive : btnOutline}
          >
            {vendor.isPreferred ? "★ Preferred" : "☆ Mark Preferred"}
          </button>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            disabled={isPending}
            style={btnOutline}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {editing ? (
        <EditForm vendor={vendor} onDone={() => setEditing(false)} />
      ) : (
        <ReadOnlyView vendor={vendor} />
      )}

      {/* Reciprocity actions */}
      <div
        style={{
          border: "0.5px solid var(--border)",
          background: "var(--white)",
          padding: "1.4rem 1.5rem",
          marginTop: "1.5rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "var(--charcoal-muted)",
              margin: 0,
            }}
          >
            Reciprocity
          </p>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
              margin: "0.3rem 0 0",
            }}
          >
            Sent: <strong>{vendor.referralsSent}</strong> · Received:{" "}
            <strong>{vendor.referralsReceived}</strong>
            {vendor.lastWorkedWith && ` · Last worked ${vendor.lastWorkedWith}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleSent}
            disabled={isPending}
            style={btnOutline}
          >
            + Sent referral
          </button>
          <button
            type="button"
            onClick={handleReceived}
            disabled={isPending}
            style={btnOutline}
          >
            + Received referral
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div
        style={{
          border: "0.5px solid #FCA5A5",
          background: "#FEF2F2",
          padding: "1.4rem 1.5rem",
          marginTop: "2rem",
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#991B1B",
              margin: 0,
            }}
          >
            Danger Zone
          </p>
          <p
            style={{
              fontSize: "0.82rem",
              color: "#7F1D1D",
              margin: "0.3rem 0 0",
            }}
          >
            Permanently remove this vendor from your network.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          style={btnDanger}
        >
          Delete Vendor
        </button>
      </div>
    </>
  );
}

// ─── Read-only two-column view ─────────────────────────────────────────────────

function ReadOnlyView({ vendor }: { vendor: SerializedVendorDetail }) {
  const location = [vendor.city, vendor.state].filter(Boolean).join(", ");
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
        gap: "1.5rem",
      }}
    >
      {/* Left column: contact + map placeholder */}
      <section style={panelStyle}>
        <PanelHeader>Contact</PanelHeader>
        <DefList>
          <DT>Email</DT>
          <DD>
            {vendor.email ? (
              <a href={`mailto:${vendor.email}`} style={linkStyle}>
                {vendor.email}
              </a>
            ) : (
              "—"
            )}
          </DD>
          <DT>Phone</DT>
          <DD>
            {vendor.phone ? (
              <a href={`tel:${vendor.phone}`} style={linkStyle}>
                {vendor.phone}
              </a>
            ) : (
              "—"
            )}
          </DD>
          <DT>Website</DT>
          <DD>
            {vendor.website ? (
              <a href={vendor.website} target="_blank" rel="noreferrer" style={linkStyle}>
                {vendor.website}
              </a>
            ) : (
              "—"
            )}
          </DD>
          <DT>Instagram</DT>
          <DD>{vendor.instagramHandle ?? "—"}</DD>
          <DT>Address</DT>
          <DD>{vendor.address ?? "—"}</DD>
          <DT>Location</DT>
          <DD>{location || "—"}</DD>
        </DefList>

        <div style={{ marginTop: "1.25rem" }}>
          <PanelHeader>Map</PanelHeader>
          <div
            style={{
              border: "0.5px dashed var(--border-strong)",
              padding: "1.2rem",
              textAlign: "center",
              background: "rgba(107,120,69,0.04)",
              color: "var(--charcoal-muted)",
              fontSize: "0.82rem",
            }}
          >
            {vendor.latitude != null && vendor.longitude != null ? (
              <>
                <p style={{ margin: 0 }}>
                  {vendor.latitude.toFixed(5)}, {vendor.longitude.toFixed(5)}
                </p>
                <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem" }}>
                  Map preview unavailable — Maps integration pending.
                </p>
              </>
            ) : (
              <p style={{ margin: 0, fontSize: "0.78rem" }}>
                No coordinates on file. Add lat / lng to enable map preview.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Right column: notes + tags */}
      <section style={panelStyle}>
        <PanelHeader>Notes</PanelHeader>
        <pre
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "0.85rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.65,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "rgba(42,42,40,0.02)",
            border: "0.5px solid var(--border)",
            padding: "0.9rem 1rem",
            margin: 0,
            minHeight: "120px",
          }}
        >
          {vendor.notes.trim() || "No notes yet."}
        </pre>

        <div style={{ marginTop: "1.25rem" }}>
          <PanelHeader>Tags</PanelHeader>
          {vendor.tags.length === 0 ? (
            <p
              style={{
                fontSize: "0.8rem",
                color: "var(--charcoal-muted)",
                margin: 0,
              }}
            >
              No tags.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {vendor.tags.map((t) => (
                <span
                  key={t}
                  style={{
                    padding: "0.3rem 0.7rem",
                    fontSize: "0.7rem",
                    letterSpacing: "0.06em",
                    background: "var(--olive-dim)",
                    color: "var(--charcoal)",
                    border: "0.5px solid var(--border)",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--charcoal-muted)",
            marginTop: "1.25rem",
            marginBottom: 0,
          }}
        >
          Added {vendor.createdAt} · Updated {vendor.updatedAt}
        </p>
      </section>
    </div>
  );
}

// ─── Inline edit form ──────────────────────────────────────────────────────────

function EditForm({
  vendor,
  onDone,
}: {
  vendor: SerializedVendorDetail;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: vendor.name,
    category: vendor.category,
    email: vendor.email ?? "",
    phone: vendor.phone ?? "",
    website: vendor.website ?? "",
    instagramHandle: vendor.instagramHandle ?? "",
    address: vendor.address ?? "",
    city: vendor.city ?? "",
    state: vendor.state ?? "",
    latitude: vendor.latitude != null ? String(vendor.latitude) : "",
    longitude: vendor.longitude != null ? String(vendor.longitude) : "",
    rating: vendor.rating ? String(vendor.rating) : "",
    notes: vendor.notes,
    tags: vendor.tags.join(", "),
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lat = form.latitude.trim() ? Number(form.latitude) : undefined;
    const lng = form.longitude.trim() ? Number(form.longitude) : undefined;
    if (form.latitude.trim() && !Number.isFinite(lat)) {
      toast("Latitude must be a number");
      return;
    }
    if (form.longitude.trim() && !Number.isFinite(lng)) {
      toast("Longitude must be a number");
      return;
    }

    startTransition(async () => {
      const result = await updateVendor(vendor.id, {
        name: form.name,
        category: form.category,
        email: form.email,
        phone: form.phone,
        website: form.website,
        instagramHandle: form.instagramHandle,
        address: form.address,
        city: form.city,
        state: form.state,
        latitude: lat,
        longitude: lng,
        rating: form.rating ? (Number(form.rating) as 1 | 2 | 3 | 4 | 5) : undefined,
        notes: form.notes,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (result.success) {
        toast("Vendor updated");
        onDone();
        router.refresh();
      } else {
        toast(result.error ?? "Failed to update");
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        ...panelStyle,
        display: "grid",
        gap: "0.85rem",
      }}
    >
      <PanelHeader>Edit Vendor</PanelHeader>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.85rem" }}>
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
      </div>

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
            value={form.instagramHandle}
            onChange={(e) => update("instagramHandle", e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Address">
        <input
          type="text"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          style={inputStyle}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "0.85rem" }}>
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
        <Field label="Lat">
          <input
            type="text"
            inputMode="decimal"
            value={form.latitude}
            onChange={(e) => update("latitude", e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Lng">
          <input
            type="text"
            inputMode="decimal"
            value={form.longitude}
            onChange={(e) => update("longitude", e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Rating">
        <select
          value={form.rating}
          onChange={(e) => update("rating", e.target.value)}
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

      <Field label="Tags (comma-separated)">
        <input
          type="text"
          value={form.tags}
          onChange={(e) => update("tags", e.target.value)}
          placeholder="luxury, downtown, fast-turnaround"
          style={inputStyle}
        />
      </Field>

      <Field label="Notes">
        <textarea
          rows={6}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "'Jost', sans-serif" }}
        />
      </Field>

      <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
        <button type="button" onClick={onDone} style={btnOutline} disabled={isPending}>
          Cancel
        </button>
        <button type="submit" style={btnOlive} disabled={isPending}>
          {isPending ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}

// ─── Small primitives ──────────────────────────────────────────────────────────

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: "0.62rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: "var(--charcoal-muted)",
        margin: "0 0 0.85rem",
      }}
    >
      {children}
    </p>
  );
}

function DefList({ children }: { children: React.ReactNode }) {
  return (
    <dl
      style={{
        display: "grid",
        gridTemplateColumns: "110px 1fr",
        rowGap: "0.55rem",
        columnGap: "1rem",
        fontSize: "0.85rem",
        margin: 0,
      }}
    >
      {children}
    </dl>
  );
}

function DT({ children }: { children: React.ReactNode }) {
  return (
    <dt
      style={{
        fontSize: "0.7rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: "var(--charcoal-muted)",
        margin: 0,
      }}
    >
      {children}
    </dt>
  );
}

function DD({ children }: { children: React.ReactNode }) {
  return (
    <dd
      style={{
        color: "var(--charcoal-light)",
        margin: 0,
        wordBreak: "break-word",
      }}
    >
      {children}
    </dd>
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

function RatingDots({ rating }: { rating: 1 | 2 | 3 | 4 | 5 | null }) {
  if (rating == null) {
    return (
      <p
        style={{
          fontSize: "0.78rem",
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
            width: "9px",
            height: "9px",
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
          fontSize: "0.75rem",
          color: "var(--charcoal-muted)",
          marginLeft: "0.35rem",
        }}
      >
        {rating} / 5
      </span>
    </div>
  );
}

// ─── Shared styles ─────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  padding: "1.4rem 1.5rem",
};

const linkStyle: React.CSSProperties = {
  color: "var(--olive)",
  textDecoration: "none",
  borderBottom: "0.5px solid rgba(107,120,69,0.4)",
};

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
  padding: "0.7rem 1.6rem",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "var(--olive)",
  color: "var(--white)",
  border: "none",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnOutline: React.CSSProperties = {
  padding: "0.7rem 1.6rem",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const btnDanger: React.CSSProperties = {
  padding: "0.7rem 1.6rem",
  fontSize: "0.7rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#991B1B",
  background: "none",
  border: "0.5px solid #FCA5A5",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
