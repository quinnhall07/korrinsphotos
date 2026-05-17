// lib/weather.ts
// Server-only Tomorrow.io forecast adapter.
//
// Endpoint: https://api.tomorrow.io/v4/timelines
// Docs:    https://docs.tomorrow.io/reference/post-timelines
//
// Best-effort: every error path returns `null` and logs, so callers can no-op
// gracefully when the API is down or unconfigured. Never throws.

const TOMORROW_IO_URL = "https://api.tomorrow.io/v4/timelines";
const REQUEST_TIMEOUT_MS = 8_000;

if (!process.env.TOMORROW_IO_API_KEY) {
  console.warn(
    "Missing TOMORROW_IO_API_KEY environment variable. Weather forecasts will return null."
  );
}

export interface WeatherSnapshot {
  fetchedAt: Date;
  temperatureF: number;
  feelsLikeF: number;
  conditions: string; // normalized vocabulary, see weatherCodeToCondition
  cloudCoverPct: number; // 0-100
  precipitationProbabilityPct: number;
  windSpeedMph: number;
  humidityPct: number;
  uvIndex: number;
  isOutdoorFriendly: boolean;
}

// Tomorrow.io weatherCode → human-readable condition.
// Full code reference: https://docs.tomorrow.io/reference/data-layers-weather-codes
function weatherCodeToCondition(code: number): string {
  switch (code) {
    case 1000:
      return "Clear";
    case 1100:
    case 1101:
      return "Partly Cloudy";
    case 1102:
    case 1001:
      return "Cloudy";
    case 2000:
    case 2100:
      return "Fog";
    case 4000:
    case 4200:
      return "Rain";
    case 4001:
      return "Rain";
    case 4201:
      return "Heavy Rain";
    case 5000:
    case 5100:
    case 5001:
      return "Snow";
    case 5101:
      return "Heavy Snow";
    case 6000:
    case 6001:
    case 6200:
    case 6201:
      return "Freezing Rain";
    case 7000:
    case 7101:
    case 7102:
      return "Ice Pellets";
    case 8000:
      return "Thunderstorm";
    default:
      return "Unknown";
  }
}

function isOutdoorFriendly(
  cloudCoverPct: number,
  precipitationProbabilityPct: number,
  windSpeedMph: number
): boolean {
  return (
    cloudCoverPct >= 10 &&
    cloudCoverPct <= 90 &&
    precipitationProbabilityPct < 30 &&
    windSpeedMph < 20
  );
}

// Pick the timeline interval whose startTime is closest to `at`.
type Interval = { startTime: string; values: Record<string, number | undefined> };

function pickClosestInterval(intervals: Interval[], at: Date): Interval | null {
  if (!intervals.length) return null;
  const target = at.getTime();
  let best = intervals[0];
  let bestDelta = Math.abs(new Date(best.startTime).getTime() - target);
  for (let i = 1; i < intervals.length; i++) {
    const delta = Math.abs(new Date(intervals[i].startTime).getTime() - target);
    if (delta < bestDelta) {
      best = intervals[i];
      bestDelta = delta;
    }
  }
  return best;
}

/**
 * Fetch a forecast snapshot for the given coordinates at (or nearest to) the
 * supplied time. Returns null on any failure — never throws.
 *
 * Uses an 8-second AbortController timeout. Best-effort: callers should treat
 * a null return as "weather unavailable" and continue.
 */
export async function fetchForecastSnapshot(opts: {
  latitude: number;
  longitude: number;
  at: Date;
}): Promise<WeatherSnapshot | null> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) return null;

  const { latitude, longitude, at } = opts;

  // Tomorrow.io accepts a `startTime`/`endTime` window. We request a ±1h window
  // around `at` at 1-hour resolution and snap to the closest interval client-side.
  const startTime = new Date(at.getTime() - 60 * 60_000).toISOString();
  const endTime = new Date(at.getTime() + 60 * 60_000).toISOString();

  const body = {
    location: [latitude, longitude],
    fields: [
      "temperature",
      "temperatureApparent",
      "weatherCode",
      "cloudCover",
      "precipitationProbability",
      "windSpeed",
      "humidity",
      "uvIndex",
    ],
    units: "imperial",
    timesteps: ["1h"],
    startTime,
    endTime,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${TOMORROW_IO_URL}?apikey=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(
        `Tomorrow.io request failed: ${res.status} ${res.statusText}`
      );
      return null;
    }

    const json = (await res.json()) as {
      data?: { timelines?: Array<{ intervals?: Interval[] }> };
    };

    const intervals = json.data?.timelines?.[0]?.intervals ?? [];
    const interval = pickClosestInterval(intervals, at);
    if (!interval) {
      console.error("Tomorrow.io response missing intervals");
      return null;
    }

    const v = interval.values;
    const temperatureF = Number(v.temperature ?? NaN);
    const feelsLikeF = Number(v.temperatureApparent ?? temperatureF);
    const weatherCode = Number(v.weatherCode ?? 0);
    const cloudCoverPct = Number(v.cloudCover ?? 0);
    const precipitationProbabilityPct = Number(v.precipitationProbability ?? 0);
    const windSpeedMph = Number(v.windSpeed ?? 0);
    const humidityPct = Number(v.humidity ?? 0);
    const uvIndex = Number(v.uvIndex ?? 0);

    if (Number.isNaN(temperatureF)) {
      console.error("Tomorrow.io response missing temperature");
      return null;
    }

    return {
      fetchedAt: new Date(),
      temperatureF,
      feelsLikeF,
      conditions: weatherCodeToCondition(weatherCode),
      cloudCoverPct,
      precipitationProbabilityPct,
      windSpeedMph,
      humidityPct,
      uvIndex,
      isOutdoorFriendly: isOutdoorFriendly(
        cloudCoverPct,
        precipitationProbabilityPct,
        windSpeedMph
      ),
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("Tomorrow.io request timed out after 8s");
    } else {
      console.error("Tomorrow.io fetch error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
