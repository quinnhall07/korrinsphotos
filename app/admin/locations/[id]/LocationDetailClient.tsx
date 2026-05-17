"use client";

// app/admin/locations/[id]/LocationDetailClient.tsx
// Two-column detail view with inline edit + delete. Receives a fully
// serialised location prop from its server-component parent.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/Toaster";
import { updateLocation, deleteLocation } from "../actions";
import type { LocationType, LocationRating, LightingWindow } from "@/lib/db/locations";

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

interface SerializedDetailLocation {
  id: string;
  name: string;
  type: LocationType;
  typeLabel: string;
  address: string | null;
  city: string | null;
  state: string | null;
  latitude: number | null;
  longitude: number | null;
  bestLightWindow: LightingWindow | null;
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
  notes: string | null;
  tags: string[];
  sampleEvents: { id: string; title: string }[];
  /**
   * Wave B Feature 2 — every project that has shot at this location, hydrated
   * from `sampleEventIds` via `listProjectsAtLocation`. Deduplicated per
   * project. Render with links to /admin/projects/{id}.
   */
  projectsAtLocation: {
    id: string;
    title: string;
    shootDate: string | null;
    status: string;
  }[];
}

export function LocationDetailClient({
  location,
}: {
  location: SerializedDetailLocation;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return isEditing ? (
    <EditView location={location} onCancel={() => setIsEditing(false)} />
  ) : (
    <ReadView location={location} onEdit={() => setIsEditing(true)} />
  );
}

// ─── Read view ────────────────────────────────────────────────────────────────

function ReadView({
  location,
  onEdit,
}: {
  location: SerializedDetailLocation;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        `Permanently delete "${location.name}"?\n\nThis only removes the scouting record — linked events are untouched. This cannot be undone.`
      )
    )
      return;

    startTransition(async () => {
      const result = await deleteLocation(location.id);
      if (result.success) {
        toast("Location deleted");
        router.push("/admin/locations");
      } else {
        toast(result.error);
      }
    });
  }

  const lightWindow = location.bestLightWindow
    ? formatLightWindow(location.bestLightWindow)
    : null;
  const latLng =
    location.latitude !== null && location.longitude !== null
      ? formatLatLng(location.latitude, location.longitude)
      : null;
  const cityLine = [location.city, location.state].filter(Boolean).join(", ");

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p style={eyebrow}>{location.typeLabel}</p>
          <h2 style={pageTitle}>{location.name}</h2>
          <RatingRow rating={location.rating} visitCount={location.visitCount} />
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button type="button" onClick={onEdit} style={btnOutline}>
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            style={btnDanger}
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1.5rem",
        }}
      >
        {/* Left column */}
        <section style={card}>
          <p style={eyebrow}>Location</p>
          <DataRow label="Address" value={location.address ?? "—"} />
          <DataRow label="City / State" value={cityLine || "—"} />
          <DataRow
            label="Coordinates"
            value={latLng ?? "—"}
            monospace={Boolean(latLng)}
          />
          <DataRow label="Best light" value={lightWindow ?? "—"} />
          <DataRow label="Parking" value={location.parkingNotes ?? "—"} />
          <DataRow
            label="Permit"
            value={
              location.permitRequired
                ? [
                    "Required",
                    location.permitCost !== null
                      ? `$${location.permitCost.toFixed(0)}`
                      : null,
                    location.permitContact ? `Contact: ${location.permitContact}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "Not required"
            }
          />
          <DataRow
            label="Accessibility"
            value={location.accessibilityNotes ?? "—"}
          />
          <DataRow
            label="Capacity"
            value={
              location.capacityMax !== null
                ? `Up to ${location.capacityMax}`
                : "—"
            }
          />
          <DataRow
            label="Weather"
            value={location.weatherDependent ? "Weather dependent" : "Indoor-safe"}
          />
        </section>

        {/* Right column */}
        <section style={card}>
          <p style={eyebrow}>Notes</p>
          <p
            style={{
              fontSize: "0.92rem",
              lineHeight: 1.7,
              color: "var(--charcoal-light)",
              whiteSpace: "pre-wrap",
              marginBottom: "1.5rem",
            }}
          >
            {location.notes ?? "No notes yet."}
          </p>

          <p style={eyebrow}>Tags</p>
          {location.tags.length === 0 ? (
            <p style={muted}>No tags</p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {location.tags.map((t) => (
                <span key={t} style={tagChip}>
                  {t}
                </span>
              ))}
            </div>
          )}

          <p style={{ ...eyebrow, marginTop: "1.5rem" }}>
            Used on projects ({location.projectsAtLocation.length})
          </p>
          {location.projectsAtLocation.length === 0 ? (
            <p style={muted}>
              No projects linked here yet. Projects auto-link when an admin picks
              this location in the workspace and the project moves to BOOKED.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {location.projectsAtLocation.map((p) => (
                <li key={p.id} style={{ marginBottom: "0.5rem" }}>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--charcoal)",
                      textDecoration: "underline",
                      textDecorationColor: "var(--border-strong)",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    {p.title}
                  </Link>
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.7rem",
                      color: "var(--charcoal-muted)",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {p.shootDate
                      ? new Date(p.shootDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                    {p.status ? ` · ${p.status.replace(/_/g, " ").toLowerCase()}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p style={{ ...eyebrow, marginTop: "1.5rem" }}>
            Sample shoots ({location.sampleEvents.length})
          </p>
          {location.sampleEvents.length === 0 ? (
            <p style={muted}>
              No shoots recorded here yet. Calls to{" "}
              <code style={inlineCode}>recordLocationVisit</code> will populate this list.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {location.sampleEvents.map((ev) => (
                <li key={ev.id} style={{ marginBottom: "0.4rem" }}>
                  <Link
                    href={`/admin/events/${ev.id}`}
                    style={{
                      fontSize: "0.85rem",
                      color: "var(--charcoal)",
                      textDecoration: "underline",
                      textDecorationColor: "var(--border-strong)",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    {ev.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <p style={{ ...eyebrow, marginTop: "1.5rem" }}>Last visited</p>
          <p style={muted}>
            {location.lastVisited
              ? new Date(location.lastVisited).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Never recorded"}
          </p>
        </section>
      </div>
    </>
  );
}

// ─── Edit view ────────────────────────────────────────────────────────────────

function EditView({
  location,
  onCancel,
}: {
  location: SerializedDetailLocation;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(location.name);
  const [type, setType] = useState<LocationType>(location.type);
  const [address, setAddress] = useState(location.address ?? "");
  const [city, setCity] = useState(location.city ?? "");
  const [stateCode, setStateCode] = useState(location.state ?? "");
  const [latitude, setLatitude] = useState(
    location.latitude !== null ? String(location.latitude) : ""
  );
  const [longitude, setLongitude] = useState(
    location.longitude !== null ? String(location.longitude) : ""
  );
  const [startHour, setStartHour] = useState(
    location.bestLightWindow?.startHour ?? ""
  );
  const [endHour, setEndHour] = useState(location.bestLightWindow?.endHour ?? "");
  const [lightNotes, setLightNotes] = useState(
    location.bestLightWindow?.notes ?? ""
  );
  const [parkingNotes, setParkingNotes] = useState(location.parkingNotes ?? "");
  const [permitRequired, setPermitRequired] = useState(location.permitRequired);
  const [permitCost, setPermitCost] = useState(
    location.permitCost !== null ? String(location.permitCost) : ""
  );
  const [permitContact, setPermitContact] = useState(location.permitContact ?? "");
  const [accessibilityNotes, setAccessibilityNotes] = useState(
    location.accessibilityNotes ?? ""
  );
  const [capacityMax, setCapacityMax] = useState(
    location.capacityMax !== null ? String(location.capacityMax) : ""
  );
  const [weatherDependent, setWeatherDependent] = useState(location.weatherDependent);
  const [rating, setRating] = useState(location.rating ? String(location.rating) : "");
  const [notes, setNotes] = useState(location.notes ?? "");
  const [tagsInput, setTagsInput] = useState(location.tags.join(", "));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast("Name is required");
      return;
    }

    startTransition(async () => {
      const lat = latitude.trim() ? parseFloat(latitude) : NaN;
      const lng = longitude.trim() ? parseFloat(longitude) : NaN;
      const sh = startHour !== "" ? Number(startHour) : NaN;
      const eh = endHour !== "" ? Number(endHour) : NaN;

      const bestLightWindow: LightingWindow | undefined =
        !Number.isNaN(sh) && !Number.isNaN(eh)
          ? {
              startHour: sh,
              endHour: eh,
              ...(lightNotes.trim() ? { notes: lightNotes.trim() } : {}),
            }
          : undefined;

      const result = await updateLocation(location.id, {
        name: name.trim(),
        type,
        ...(address.trim() ? { address: address.trim() } : { address: "" }),
        ...(city.trim() ? { city: city.trim() } : { city: "" }),
        ...(stateCode.trim() ? { state: stateCode.trim() } : { state: "" }),
        ...(Number.isNaN(lat) ? {} : { latitude: lat }),
        ...(Number.isNaN(lng) ? {} : { longitude: lng }),
        ...(bestLightWindow ? { bestLightWindow } : {}),
        ...(parkingNotes.trim()
          ? { parkingNotes: parkingNotes.trim() }
          : { parkingNotes: "" }),
        permitRequired,
        ...(permitCost.trim() && !Number.isNaN(parseFloat(permitCost))
          ? { permitCost: parseFloat(permitCost) }
          : {}),
        ...(permitContact.trim()
          ? { permitContact: permitContact.trim() }
          : { permitContact: "" }),
        ...(accessibilityNotes.trim()
          ? { accessibilityNotes: accessibilityNotes.trim() }
          : { accessibilityNotes: "" }),
        ...(capacityMax.trim() && !Number.isNaN(parseInt(capacityMax, 10))
          ? { capacityMax: parseInt(capacityMax, 10) }
          : {}),
        weatherDependent,
        ...(rating ? { rating: Number(rating) as LocationRating } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : { notes: "" }),
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });

      if (result.success) {
        toast("Location updated");
        onCancel();
        router.refresh();
      } else {
        toast(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <p style={eyebrow}>Editing</p>
          <h2 style={pageTitle}>{location.name}</h2>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            style={btnOutline}
          >
            Cancel
          </button>
          <button type="submit" disabled={isPending} style={btnOlive}>
            {isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: "1.5rem",
        }}
      >
        {/* Left column */}
        <section style={card}>
          <p style={eyebrow}>Location</p>

          <EditField label="Name *">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              required
            />
          </EditField>

          <EditField label="Type">
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
          </EditField>

          <EditField label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              style={inputStyle}
            />
          </EditField>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
            <EditField label="City">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={inputStyle}
              />
            </EditField>
            <EditField label="State">
              <input
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                style={inputStyle}
                maxLength={4}
              />
            </EditField>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <EditField label="Latitude">
              <input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={inputStyle}
                inputMode="decimal"
              />
            </EditField>
            <EditField label="Longitude">
              <input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={inputStyle}
                inputMode="decimal"
              />
            </EditField>
          </div>

          <p style={{ ...eyebrow, marginTop: "1rem" }}>Best light window</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <EditField label="Start hour (0-23)">
              <input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) =>
                  setStartHour(e.target.value === "" ? "" : Number(e.target.value))
                }
                style={inputStyle}
              />
            </EditField>
            <EditField label="End hour (0-23)">
              <input
                type="number"
                min={0}
                max={23}
                value={endHour}
                onChange={(e) =>
                  setEndHour(e.target.value === "" ? "" : Number(e.target.value))
                }
                style={inputStyle}
              />
            </EditField>
          </div>
          <EditField label="Light notes">
            <input
              value={lightNotes}
              onChange={(e) => setLightNotes(e.target.value)}
              placeholder="e.g. trees block harsh sun in summer"
              style={inputStyle}
            />
          </EditField>

          <EditField label="Parking notes">
            <textarea
              value={parkingNotes}
              onChange={(e) => setParkingNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </EditField>

          <EditField label="Accessibility notes">
            <textarea
              value={accessibilityNotes}
              onChange={(e) => setAccessibilityNotes(e.target.value)}
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </EditField>

          <EditField label="Capacity (max group size)">
            <input
              value={capacityMax}
              onChange={(e) => setCapacityMax(e.target.value)}
              style={inputStyle}
              inputMode="numeric"
            />
          </EditField>
        </section>

        {/* Right column */}
        <section style={card}>
          <p style={eyebrow}>Permit & weather</p>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
              marginBottom: "0.8rem",
            }}
          >
            <input
              type="checkbox"
              checked={permitRequired}
              onChange={(e) => setPermitRequired(e.target.checked)}
            />
            Permit required
          </label>

          <EditField label="Permit cost (USD)">
            <input
              value={permitCost}
              onChange={(e) => setPermitCost(e.target.value)}
              style={inputStyle}
              inputMode="decimal"
              disabled={!permitRequired}
            />
          </EditField>

          <EditField label="Permit contact">
            <input
              value={permitContact}
              onChange={(e) => setPermitContact(e.target.value)}
              style={inputStyle}
              disabled={!permitRequired}
            />
          </EditField>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--charcoal-light)",
              margin: "1rem 0",
            }}
          >
            <input
              type="checkbox"
              checked={weatherDependent}
              onChange={(e) => setWeatherDependent(e.target.checked)}
            />
            Weather dependent
          </label>

          <EditField label="Rating">
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
          </EditField>

          <EditField label="Tags (comma-separated)">
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. wildflowers, golden hour, dog-friendly"
              style={inputStyle}
            />
          </EditField>

          <EditField label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </EditField>
        </section>
      </div>
    </form>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function DataRow({
  label,
  value,
  monospace,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(8rem, 10rem) 1fr",
        gap: "1rem",
        padding: "0.7rem 0",
        borderBottom: "0.5px solid var(--border)",
      }}
    >
      <span
        style={{
          fontSize: "0.65rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.85rem",
          color: "var(--charcoal)",
          fontFamily: monospace ? "monospace" : undefined,
          lineHeight: 1.5,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "0.9rem" }}>
      <label
        style={{
          display: "block",
          fontSize: "0.65rem",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--charcoal-muted)",
          marginBottom: "0.35rem",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function RatingRow({
  rating,
  visitCount,
}: {
  rating: LocationRating | null;
  visitCount: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        marginTop: "0.5rem",
      }}
    >
      <div style={{ display: "flex", gap: "0.3rem" }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            style={{
              display: "inline-block",
              width: "0.55rem",
              height: "0.55rem",
              borderRadius: "50%",
              background: n <= (rating ?? 0) ? "var(--olive)" : "var(--border-strong)",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "0.72rem", color: "var(--charcoal-muted)", letterSpacing: "0.04em" }}>
        {visitCount} visit{visitCount === 1 ? "" : "s"}
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLatLng(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

function formatLightWindow(w: LightingWindow): string {
  const base = `Best light: ${formatHour(w.startHour)} – ${formatHour(w.endHour)}`;
  return w.notes ? `${base} (${w.notes})` : base;
}

function formatHour(h: number): string {
  if (!Number.isFinite(h)) return "—";
  const hour = ((h % 24) + 24) % 24;
  const period = hour >= 12 ? "PM" : "AM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${period}`;
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
  margin: 0,
};

const card: React.CSSProperties = {
  background: "var(--white)",
  padding: "1.6rem",
  border: "0.5px solid var(--border)",
};

const muted: React.CSSProperties = {
  fontSize: "0.82rem",
  color: "var(--charcoal-muted)",
  lineHeight: 1.6,
};

const tagChip: React.CSSProperties = {
  display: "inline-block",
  padding: "0.25rem 0.65rem",
  fontSize: "0.7rem",
  letterSpacing: "0.06em",
  background: "var(--olive-dim)",
  color: "var(--charcoal)",
};

const inlineCode: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.78rem",
  background: "var(--olive-dim)",
  padding: "0.05rem 0.3rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.65rem 0.85rem",
  fontSize: "0.85rem",
  border: "0.5px solid var(--border)",
  background: "var(--white)",
  color: "var(--charcoal)",
  fontFamily: "'Jost', sans-serif",
  outline: "none",
};

const btnOlive: React.CSSProperties = {
  padding: "0.85rem 2rem",
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

const btnDanger: React.CSSProperties = {
  padding: "0.85rem 1.6rem",
  fontSize: "0.72rem",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  background: "none",
  color: "#991B1B",
  border: "0.5px solid #FCA5A5",
  cursor: "pointer",
  fontFamily: "'Jost', sans-serif",
};
