// lib/domain/weather-snapshots.ts
//
// Phase 3.6 — Weather + golden-hour snapshot refresh.
//
// Server-only orchestrator. Walks every project whose status is in the
// pre-shoot / post-shoot lifecycle window (BOOKED, SHOOT_READY, IN_EDITING)
// and refreshes `project.weatherSnapshot` at two horizons:
//
//   - 72h pre-shoot — coarse outlook, written when the project is more than
//     24h from shootDate but no more than 72h.
//   - 24h pre-shoot — fine-grained outlook, written when shootDate is within
//     24h (and has not already passed).
//
// Idempotent: each pass only writes when the existing snapshot wasn't already
// written by the same pass (compares `forecastForHorizonHours`).
//
// Best-effort: any per-project failure (missing coords, Tomorrow.io error,
// bad shoot date) is logged and skipped — the cron worker must keep walking.

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  type ProjectDoc,
  type SunTimesSnapshot,
  type WeatherSnapshot,
  updateProject,
} from "@/lib/db/projects";
import { computeSunTimes } from "@/lib/golden-hour";
import { fetchForecastSnapshot } from "@/lib/weather";

const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

type RefreshHorizon = 72 | 24;

export interface RefreshWeatherSnapshotsSummary {
  refreshed: number;
  skipped: number;
  errors: number;
}

/**
 * Decide whether a project is due for a refresh and which horizon (72h or
 * 24h) should write the snapshot. Returns null when the project is outside
 * the refresh window or the existing snapshot already covers this horizon.
 */
function pickRefreshHorizon(
  shootMs: number,
  nowMs: number,
  existing: WeatherSnapshot | undefined
): RefreshHorizon | null {
  const delta = shootMs - nowMs;
  if (delta <= 0) return null; // shoot already happened
  if (delta <= TWENTY_FOUR_HOURS_MS) {
    if (existing?.forecastForHorizonHours === 24) return null;
    return 24;
  }
  if (delta <= SEVENTY_TWO_HOURS_MS) {
    if (existing?.forecastForHorizonHours === 72) return null;
    return 72;
  }
  return null;
}

/** Serialize one `Date` to ISO, or `null` if it's an Invalid Date. */
function dateToIsoOrNull(d: Date): string | null {
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildSunTimes(shootDate: Date, lat: number, lon: number): SunTimesSnapshot {
  const sun = computeSunTimes(shootDate, lat, lon);
  return {
    sunrise: dateToIsoOrNull(sun.sunrise),
    sunset: dateToIsoOrNull(sun.sunset),
    goldenHourMorningStart: dateToIsoOrNull(sun.goldenHourMorningStart),
    goldenHourMorningEnd: dateToIsoOrNull(sun.goldenHourMorningEnd),
    goldenHourEveningStart: dateToIsoOrNull(sun.goldenHourEveningStart),
    goldenHourEveningEnd: dateToIsoOrNull(sun.goldenHourEveningEnd),
    blueHourMorning: dateToIsoOrNull(sun.blueHourMorning),
    blueHourEvening: dateToIsoOrNull(sun.blueHourEvening),
    solarNoon: dateToIsoOrNull(sun.solarNoon),
  };
}

/**
 * Walk every project in the pre/post-shoot lifecycle window and refresh the
 * weather snapshot when due. Called from the daily cron in
 * `app/api/cron/run-tasks/route.ts`.
 *
 * Errors are caught per-project so one bad row cannot poison the sweep.
 * Returns counters for cron-response visibility.
 */
export async function refreshWeatherSnapshotsDue(
  now: number = Date.now()
): Promise<RefreshWeatherSnapshotsSummary> {
  const summary: RefreshWeatherSnapshotsSummary = {
    refreshed: 0,
    skipped: 0,
    errors: 0,
  };

  // Query the relevant lifecycle window. We can't combine `where in` with
  // `where != null` cleanly (Firestore disallows multiple inequality filters),
  // so filter shootDate / indoor in-memory.
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await adminDb
      .collection("projects")
      .where("status", "in", ["BOOKED", "SHOOT_READY", "IN_EDITING"])
      .get();
  } catch (err) {
    console.error("[weather-snapshots] project query failed", err);
    return summary;
  }

  for (const doc of snap.docs) {
    const project = { id: doc.id, ...(doc.data() as Omit<ProjectDoc, "id">) };

    try {
      if (project.weatherSnapshotIndoor === true) {
        summary.skipped++;
        continue;
      }

      const shootTimestamp = project.shootDate;
      if (!shootTimestamp) {
        summary.skipped++;
        continue;
      }

      // shootDate is a Firestore Timestamp; tolerate the rare case where a
      // doc was hand-edited and a plain Date or ISO string snuck through.
      let shootDate: Date;
      if (shootTimestamp instanceof Timestamp) {
        shootDate = shootTimestamp.toDate();
      } else if (typeof (shootTimestamp as { toDate?: () => Date }).toDate === "function") {
        shootDate = (shootTimestamp as { toDate: () => Date }).toDate();
      } else {
        summary.skipped++;
        continue;
      }

      const shootMs = shootDate.getTime();
      if (Number.isNaN(shootMs)) {
        summary.skipped++;
        continue;
      }

      const horizon = pickRefreshHorizon(shootMs, now, project.weatherSnapshot);
      if (horizon === null) {
        summary.skipped++;
        continue;
      }

      const lat = project.shootLocation?.lat;
      const lon = project.shootLocation?.lng;
      if (typeof lat !== "number" || typeof lon !== "number") {
        summary.skipped++;
        continue;
      }

      const forecast = await fetchForecastSnapshot({
        latitude: lat,
        longitude: lon,
        at: shootDate,
      });
      if (!forecast) {
        // Tomorrow.io unavailable or API key missing — silent skip.
        summary.skipped++;
        continue;
      }

      const sunTimes = buildSunTimes(shootDate, lat, lon);

      const snapshot: WeatherSnapshot = {
        temp: forecast.temperatureF,
        feelsLike: forecast.feelsLikeF,
        conditions: forecast.conditions,
        precipChance: forecast.precipitationProbabilityPct,
        windMph: forecast.windSpeedMph,
        humidityPct: forecast.humidityPct,
        isOutdoorFriendly: forecast.isOutdoorFriendly,
        fetchedAt: Timestamp.fromDate(forecast.fetchedAt),
        forecastForHorizonHours: horizon,
        sunTimes,
      };

      await updateProject(project.id, { weatherSnapshot: snapshot });
      summary.refreshed++;
    } catch (err) {
      console.error("[weather-snapshots] refresh failed", project.id, err);
      summary.errors++;
    }
  }

  return summary;
}
