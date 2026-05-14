// app/admin/projects/[id]/WeatherCard.tsx
//
// Phase 3.6 — Overview-tab card showing the persisted forecast + sun-times
// snapshot for the upcoming shoot. Renders nothing when no snapshot is on
// file (admin override or 72h+ from shootDate or coords missing).
//
// Pure presentational component. No `"use client"` directive — when imported
// from a server parent it stays server, when imported from a client parent
// (e.g. `ProjectWorkspaceClient`'s OverviewTab) it bundles client-side. The
// interactive toggle lives in the `<IndoorToggle>` client child.

import { formatSunTimes, type SunTimes } from "@/lib/golden-hour";
import type { SerialWeatherSnapshot, SerialSunTimes } from "./page";
import { IndoorToggle } from "./IndoorToggle";

const CARD: React.CSSProperties = {
  border: "0.5px solid var(--border)",
  padding: "1.25rem 1.5rem",
  background: "var(--white)",
};

const EYEBROW: React.CSSProperties = {
  fontSize: "0.6rem",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--charcoal-muted)",
  fontFamily: "'Jost', sans-serif",
  fontWeight: 400,
};

const HEADING: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', serif",
  fontWeight: 300,
  fontSize: "1.45rem",
  letterSpacing: "0.01em",
  margin: "0 0 0.5rem 0",
  color: "var(--charcoal)",
};

const CHIP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.35rem",
  padding: "0.3rem 0.7rem",
  fontSize: "0.72rem",
  border: "0.5px solid var(--border-strong)",
  color: "var(--charcoal-light)",
  letterSpacing: "0.04em",
};

/** Re-hydrate ISO strings into Date objects so `formatSunTimes` can render. */
function sunFromIso(s: SerialSunTimes): SunTimes {
  const toDate = (v: string | null): Date =>
    v ? new Date(v) : new Date(Number.NaN);
  return {
    sunrise: toDate(s.sunrise),
    sunset: toDate(s.sunset),
    goldenHourMorningStart: toDate(s.goldenHourMorningStart),
    goldenHourMorningEnd: toDate(s.goldenHourMorningEnd),
    goldenHourEveningStart: toDate(s.goldenHourEveningStart),
    goldenHourEveningEnd: toDate(s.goldenHourEveningEnd),
    blueHourMorning: toDate(s.blueHourMorning),
    blueHourEvening: toDate(s.blueHourEvening),
    solarNoon: toDate(s.solarNoon),
  };
}

function fmtTemp(n: number): string {
  return `${Math.round(n)}°F`;
}

function fmtFetched(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function WeatherCard({
  projectId,
  snapshot,
  indoor,
}: {
  projectId: string;
  snapshot: SerialWeatherSnapshot | null;
  indoor: boolean;
}) {
  // Indoor override: short, action-only card.
  if (indoor) {
    return (
      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Weather</p>
        <h3 style={HEADING}>Indoor shoot</h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--charcoal-muted)",
            margin: "0 0 1rem 0",
          }}
        >
          Forecast updates are paused for this project. Toggle off if conditions matter.
        </p>
        <IndoorToggle projectId={projectId} indoor={indoor} />
      </div>
    );
  }

  // No snapshot yet: show a quiet "awaiting forecast" state with the toggle
  // so admins can pre-flag indoor before the 72h cron fires.
  if (!snapshot) {
    return (
      <div style={{ ...CARD, marginBottom: "1.5rem" }}>
        <p style={{ ...EYEBROW, margin: "0 0 0.5rem 0" }}>Weather</p>
        <h3 style={HEADING}>Forecast pending</h3>
        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--charcoal-muted)",
            margin: "0 0 1rem 0",
          }}
        >
          The cron writes a 72h outlook three days before the shoot and refines
          it at 24h. Add a shoot location with coordinates if you don&apos;t see
          updates roll in.
        </p>
        <IndoorToggle projectId={projectId} indoor={indoor} />
      </div>
    );
  }

  const horizonLabel =
    snapshot.forecastForHorizonHours === 24
      ? "24h outlook"
      : snapshot.forecastForHorizonHours === 72
      ? "72h outlook"
      : "Outlook";

  return (
    <div style={{ ...CARD, marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "0.5rem",
        }}
      >
        <p style={EYEBROW}>Weather · {horizonLabel}</p>
        {snapshot.fetchedAt && (
          <span style={{ fontSize: "0.7rem", color: "var(--charcoal-muted)" }}>
            Updated {fmtFetched(snapshot.fetchedAt)}
          </span>
        )}
      </div>

      <h3 style={HEADING}>
        {fmtTemp(snapshot.temp)}{" "}
        <em style={{ color: "var(--olive)", fontStyle: "italic", fontWeight: 300 }}>
          · {snapshot.conditions}
        </em>
        {snapshot.feelsLike != null && (
          <span
            style={{
              fontSize: "0.85rem",
              color: "var(--charcoal-muted)",
              marginLeft: "0.5rem",
              fontFamily: "'Jost', sans-serif",
            }}
          >
            feels {fmtTemp(snapshot.feelsLike)}
          </span>
        )}
      </h3>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          margin: "0.85rem 0 1rem 0",
        }}
      >
        {snapshot.precipChance != null && (
          <span style={CHIP}>Precip {Math.round(snapshot.precipChance)}%</span>
        )}
        {snapshot.windMph != null && (
          <span style={CHIP}>Wind {Math.round(snapshot.windMph)} mph</span>
        )}
        {snapshot.humidityPct != null && (
          <span style={CHIP}>Humidity {Math.round(snapshot.humidityPct)}%</span>
        )}
        {snapshot.isOutdoorFriendly === true && (
          <span style={{ ...CHIP, color: "var(--olive)", borderColor: "var(--olive)" }}>
            Outdoor-friendly
          </span>
        )}
        {snapshot.isOutdoorFriendly === false && (
          <span
            style={{
              ...CHIP,
              color: "var(--charcoal)",
              borderColor: "var(--border-strong)",
              background: "var(--olive-dim)",
            }}
          >
            Check conditions
          </span>
        )}
      </div>

      {snapshot.sunTimes && (
        <p
          style={{
            margin: "0 0 1rem 0",
            fontSize: "0.85rem",
            color: "var(--charcoal-light)",
            lineHeight: 1.5,
          }}
        >
          {formatSunTimes(sunFromIso(snapshot.sunTimes), "America/New_York")}
        </p>
      )}

      <IndoorToggle projectId={projectId} indoor={indoor} />
    </div>
  );
}
