"use client";

// app/admin/locations/LocationsClientPage.tsx
// Client-side filter, sort, modal-driven creation, and card grid for the
// scouting database.

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { createLocation } from "./actions";
import type { LocationType, LocationRating } from "@/lib/db/locations";

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  OUTDOOR_PARK: "Outdoor — Park",
  OUTDOOR_BEACH: "Outdoor — Beach",
  OUTDOOR_FIELD: "Outdoor — Field",
  OUTDOOR_URBAN: "Outdoor — Urban",
  INDOOR_STUDIO: "Indoor — Studio",
  INDOOR_VENUE: "Indoor — Venue",
  INDOOR_HOME: "Indoor — Home",
  OTHER: "Other",
};

export interface SerializedLocation {
  id: string;
  name: string;
  type: LocationType;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  bestLightWindow: { startHour: number; endHour: number; notes?: string } | null;
  parkingNotes: string | null;
  permitRequired: boolean;
  permitCost: number | null;
  permitContact: string | null;
  accessibilityNotes: string | null;
  capacityMax: number | null;
  weatherDependent: boolean;
  rating: LocationRating | null;
  visitCount: number;
  lastVisited: string | null;
  sampleEventIds: string[];
  notes: string | null;
  tags: string[];
  createdAt: string;
}

type SortKey = "lastVisited" | "name" | "rating";

interface Props {
  locations: SerializedLocation[];
}

const TYPE_OPTIONS: { value: "ALL" | LocationType; label: string }[] = [
  { value: "ALL", label: "All types" },
  ...(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];

export function LocationsClientPage({ locations }: Props) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | LocationType>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("lastVisited");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = locations;
    if (typeFilter !== "ALL") {
      rows = rows.filter((l) => l.type === typeFilter);
    }
    if (term) {
      rows = rows.filter((l) => {
        const haystack = [l.name, l.city ?? "", l.state ?? "", l.address ?? ""]
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sortKey === "name") {
        return a.name.localeCompare(b.name);
      }
      if (sortKey === "rating") {
        return (b.rating ?? 0) - (a.rating ?? 0);
      }
      // lastVisited — newest first, nulls last
      const av = a.lastVisited ? new Date(a.lastVisited).getTime() : 0;
      const bv = b.lastVisited ? new Date(b.lastVisited).getTime() : 0;
      return bv - av;
    });
    return sorted;
  }, [locations, search, typeFilter, sortKey]);

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "2rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <p style={eyebrow}>Scouting Database</p>
          <h2 style={pageTitle}>Locations</h2>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--charcoal-muted)",
              marginTop: "0.4rem",
              letterSpacing: "0.04em",
            }}
          >
            {locations.length} location{locations.length === 1 ? "" : "s"} scouted
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={btnOlive}
        >
          + New location
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <input
          type="text"
          placeholder="Search by name, city, or address…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "ALL" | LocationType)}
          style={inputStyle}
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={inputStyle}
        >
          <option value="lastVisited">Sort: last visited</option>
          <option value="name">Sort: name</option>
          <option value="rating">Sort: rating</option>
        </select>
      </div>

      {/* Grid / Empty state */}
      {filtered.length === 0 ? (
        <EmptyState hasAny={locations.length > 0} />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {filtered.map((loc) => (
            <LocationCard key={loc.id} location={loc} />
          ))}
        </div>
      )}

      {modalOpen && (
        <NewLocationModal onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function LocationCard({ location }: { location: SerializedLocation }) {
  const cityLine = [location.city, location.state].filter(Boolean).join(", ");
  const latLng =
    typeof location.latitude === "number" && typeof location.longitude === "number"
      ? formatLatLng(location.latitude, location.longitude)
      : null;

  return (
    <Link
      href={`/admin/locations/${location.id}`}
      style={{
        display: "block",
        textDecoration: "none",
        color: "inherit",
        padding: "1.4rem",
        background: "var(--white)",
        border: "0.5px solid var(--border)",
        transition: "border-color var(--transition)",
      }}
    >
      <p style={{ ...eyebrow, marginBottom: "0.5rem" }}>
        {LOCATION_TYPE_LABELS[location.type]}
      </p>
      <h3
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.4rem",
          fontWeight: 300,
          lineHeight: 1.2,
          marginBottom: "0.5rem",
          color: "var(--charcoal)",
        }}
      >
        {location.name}
      </h3>
      {cityLine && (
        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--charcoal-light)",
            marginBottom: "0.6rem",
          }}
        >
          {cityLine}
        </p>
      )}

      <RatingDots rating={location.rating} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.9rem",
          fontSize: "0.72rem",
          color: "var(--charcoal-muted)",
          letterSpacing: "0.04em",
        }}
      >
        <span>
          {location.visitCount} visit{location.visitCount === 1 ? "" : "s"}
        </span>
        {latLng && <span style={{ fontFamily: "monospace" }}>{latLng}</span>}
      </div>

      {location.permitRequired && (
        <div style={{ marginTop: "0.8rem" }}>
          <span style={permitChip}>Permit required</span>
        </div>
      )}
    </Link>
  );
}

function RatingDots({ rating }: { rating: LocationRating | null }) {
  const r = rating ?? 0;
  return (
    <div style={{ display: "flex", gap: "0.25rem" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            display: "inline-block",
            width: "0.45rem",
            height: "0.45rem",
            borderRadius: "50%",
            background: n <= r ? "var(--olive)" : "var(--border-strong)",
          }}
        />
      ))}
    </div>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div
      style={{
        padding: "4rem 2rem",
        textAlign: "center",
        border: "0.5px dashed var(--border-strong)",
        background: "var(--white)",
      }}
    >
      <p style={{ ...eyebrow, marginBottom: "0.8rem" }}>
        {hasAny ? "No matches" : "Empty"}
      </p>
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "1.3rem",
          fontWeight: 300,
          color: "var(--charcoal)",
          lineHeight: 1.4,
          maxWidth: "32rem",
          margin: "0 auto",
        }}
      >
        {hasAny
          ? "No locations match the current filters."
          : "Build your scouting database — every location pays back the next time you book a shoot nearby."}
      </p>
    </div>
  );
}

// ─── New Location Modal ───────────────────────────────────────────────────────

function NewLocationModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("OUTDOOR_PARK");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [rating, setRating] = useState<string>("");
  const [permitRequired, setPermitRequired] = useState(false);
  const [weatherDependent, setWeatherDependent] = useState(false);
  const [notes, setNotes] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("Name is required");
      return;
    }

    startTransition(async () => {
      const result = await createLocation({
        name: name.trim(),
        type,
        ...(address.trim() ? { address: address.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(state.trim() ? { state: state.trim() } : {}),
        ...(latitude.trim() && !Number.isNaN(parseFloat(latitude))
          ? { latitude: parseFloat(latitude) }
          : {}),
        ...(longitude.trim() && !Number.isNaN(parseFloat(longitude))
          ? { longitude: parseFloat(longitude) }
          : {}),
        ...(rating ? { rating: Number(rating) as LocationRating } : {}),
        permitRequired,
        weatherDependent,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });

      if (result.success) {
        toast("Location added");
        onClose();
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,42,40,0.45)",
        zIndex: 8500,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "4rem 1.5rem",
        overflowY: "auto",
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: "var(--white)",
          width: "100%",
          maxWidth: "36rem",
          padding: "2rem",
          border: "0.5px solid var(--border-strong)",
        }}
      >
        <p style={eyebrow}>Scouting Database</p>
        <h3
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "1.8rem",
            fontWeight: 300,
            marginBottom: "1.5rem",
            marginTop: "0.3rem",
          }}
        >
          New location
        </h3>

        <Field label="Name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Hammonasset State Park"
            style={inputStyle}
            required
          />
        </Field>

        <Field label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LocationType)}
            style={inputStyle}
          >
            {(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
          <Field label="City">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="State">
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={inputStyle}
              maxLength={4}
            />
          </Field>
        </div>

        <Field label="Address">
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <Field label="Latitude">
            <input
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="34.7333"
              style={inputStyle}
              inputMode="decimal"
            />
          </Field>
          <Field label="Longitude">
            <input
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="-78.5333"
              style={inputStyle}
              inputMode="decimal"
            />
          </Field>
        </div>

        <Field label="Rating">
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            style={inputStyle}
          >
            <option value="">— No rating —</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </select>
        </Field>

        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            margin: "0.5rem 0 1rem",
            fontSize: "0.82rem",
            color: "var(--charcoal-light)",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <input
              type="checkbox"
              checked={permitRequired}
              onChange={(e) => setPermitRequired(e.target.checked)}
            />
            Permit required
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <input
              type="checkbox"
              checked={weatherDependent}
              onChange={(e) => setWeatherDependent(e.target.checked)}
            />
            Weather dependent
          </label>
        </div>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
          />
        </Field>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "0.75rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            style={btnOutline}
          >
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={btnOlive}>
            {isPending ? "Saving…" : "Save location"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label
        style={{
          display: "block",
          fontSize: "0.65rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.4rem",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLatLng(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const eyebrow: React.CSSProperties = {
  fontSize: "0.65rem",
  letterSpacing: "0.2em",
  textTransform: "uppercase",
  color: "var(--olive)",
  marginBottom: "0.3rem",
};

const pageTitle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontSize: "2rem",
  fontWeight: 300,
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
  padding: "0.85rem 1.6rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "var(--charcoal)",
  border: "0.5px solid var(--border-strong)",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};

const permitChip: React.CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.65rem",
  fontSize: "0.62rem",
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  background: "#FEF3C7",
  color: "#92400E",
};
