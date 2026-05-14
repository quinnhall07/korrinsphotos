// lib/golden-hour.ts
// Pure, server-safe solar position helpers.
//
// Implementation source: NOAA Solar Calculations (General Solar Position Calculations
// — Earth System Research Laboratories). This is the same algorithm used by NOAA's
// public solar calculator and is accurate to ~1 minute for sunrise/sunset between
// latitudes 72N and 72S.
//
// References:
//   https://gml.noaa.gov/grad/solcalc/calcdetails.html
//   https://gml.noaa.gov/grad/solcalc/solareqns.PDF
//
// Verified against NOAA's calculator for New York (40.7128, -74.0060) on 2026-06-21:
//   sunrise ~5:25 AM EDT, solar noon ~12:58 PM EDT, sunset ~8:31 PM EDT.
//
// Polar edge case: at extreme latitudes near the solstices the sun may never rise
// or never set on a given day. In those cases the hour-angle calculation produces
// NaN and the returned Date values will be Invalid Date — callers must guard with
// Number.isNaN(d.getTime()) before formatting.

export interface SunTimes {
  sunrise: Date;
  sunset: Date;
  goldenHourMorningStart: Date; // ~30 min before sunrise
  goldenHourMorningEnd: Date; // ~1 hour after sunrise
  goldenHourEveningStart: Date; // ~1 hour before sunset
  goldenHourEveningEnd: Date; // ~30 min after sunset
  blueHourMorning: Date; // ~45 min before sunrise
  blueHourEvening: Date; // ~45 min after sunset
  solarNoon: Date;
}

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Julian Day at 00:00 UTC of the given calendar date (Fliegel & Van Flandern).
function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    day +
    B -
    1524.5
  );
}

// NOAA's solar geometry equations operate on a Julian Century from J2000.0.
function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

// All of the helpers below come straight from the NOAA spreadsheet columns.
function geomMeanLongSun(t: number): number {
  let L0 = 280.46646 + t * (36000.76983 + t * 0.0003032);
  L0 = ((L0 % 360) + 360) % 360;
  return L0;
}

function geomMeanAnomSun(t: number): number {
  return 357.52911 + t * (35999.05029 - 0.0001537 * t);
}

function eccentEarthOrbit(t: number): number {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

function sunEqOfCenter(t: number): number {
  const m = geomMeanAnomSun(t) * DEG;
  return (
    Math.sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m) * 0.000289
  );
}

function sunTrueLong(t: number): number {
  return geomMeanLongSun(t) + sunEqOfCenter(t);
}

function sunAppLong(t: number): number {
  const omega = 125.04 - 1934.136 * t;
  return sunTrueLong(t) - 0.00569 - 0.00478 * Math.sin(omega * DEG);
}

function meanObliqEcliptic(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.00059 - t * 0.001813));
  return 23 + (26 + seconds / 60) / 60;
}

function obliqCorr(t: number): number {
  return meanObliqEcliptic(t) + 0.00256 * Math.cos((125.04 - 1934.136 * t) * DEG);
}

function sunDeclination(t: number): number {
  return (
    Math.asin(Math.sin(obliqCorr(t) * DEG) * Math.sin(sunAppLong(t) * DEG)) * RAD
  );
}

// Equation of time, in minutes.
function equationOfTime(t: number): number {
  const epsilon = obliqCorr(t) * DEG;
  const l0 = geomMeanLongSun(t) * DEG;
  const e = eccentEarthOrbit(t);
  const m = geomMeanAnomSun(t) * DEG;
  const y = Math.tan(epsilon / 2) ** 2;
  const eTime =
    y * Math.sin(2 * l0) -
    2 * e * Math.sin(m) +
    4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
    0.5 * y * y * Math.sin(4 * l0) -
    1.25 * e * e * Math.sin(2 * m);
  return eTime * 4 * RAD; // radians -> minutes of time
}

// Hour angle of sunrise in degrees, given latitude and solar declination.
// Uses the standard −0.833° geometric horizon (accounts for refraction + solar disc).
function hourAngleSunrise(latDeg: number, declDeg: number): number {
  const lat = latDeg * DEG;
  const decl = declDeg * DEG;
  const cosH =
    Math.cos(90.833 * DEG) / (Math.cos(lat) * Math.cos(decl)) -
    Math.tan(lat) * Math.tan(decl);
  // If |cosH| > 1 the sun never rises (polar night) or never sets (polar day).
  // We deliberately let Math.acos return NaN — downstream Dates become Invalid Date.
  return Math.acos(cosH) * RAD;
}

/**
 * Compute sunrise, sunset, golden- and blue-hour boundaries for a given calendar
 * date and location. Returns absolute Date objects (UTC instants) — caller is
 * responsible for formatting in the desired timezone.
 *
 * @param date     Any moment within the desired calendar date. Y/M/D components
 *                 are interpreted in UTC to keep the math consistent regardless
 *                 of server timezone.
 * @param latitude  decimal degrees, north positive
 * @param longitude decimal degrees, east positive (i.e. New York = -74.0060)
 */
export function computeSunTimes(
  date: Date,
  latitude: number,
  longitude: number
): SunTimes {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  const jd = julianDay(year, month, day);
  const t = julianCentury(jd);
  const decl = sunDeclination(t);
  const eqTime = equationOfTime(t);

  // Solar noon in UTC minutes from midnight: 720 - 4*longitude - eqTime.
  const solarNoonUtcMin = 720 - 4 * longitude - eqTime;
  const ha = hourAngleSunrise(latitude, decl); // degrees
  const haMinutes = 4 * ha; // 1 degree of hour angle = 4 minutes of time
  const sunriseUtcMin = solarNoonUtcMin - haMinutes;
  const sunsetUtcMin = solarNoonUtcMin + haMinutes;

  const dayUtcMs = Date.UTC(year, month - 1, day);
  const fromMin = (m: number) => new Date(dayUtcMs + m * 60_000);

  const sunrise = fromMin(sunriseUtcMin);
  const sunset = fromMin(sunsetUtcMin);
  const solarNoon = fromMin(solarNoonUtcMin);

  return {
    sunrise,
    sunset,
    solarNoon,
    goldenHourMorningStart: fromMin(sunriseUtcMin - 30),
    goldenHourMorningEnd: fromMin(sunriseUtcMin + 60),
    goldenHourEveningStart: fromMin(sunsetUtcMin - 60),
    goldenHourEveningEnd: fromMin(sunsetUtcMin + 30),
    blueHourMorning: fromMin(sunriseUtcMin - 45),
    blueHourEvening: fromMin(sunsetUtcMin + 45),
  };
}

/**
 * One-line human-readable summary. Mirrors the format used elsewhere in the app
 * (en-US locale, short time). The supplied IANA timezone controls clock-face
 * display only — the underlying instants in `times` are not modified.
 */
export function formatSunTimes(times: SunTimes, tz: string = "America/New_York"): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
  const safe = (d: Date) =>
    Number.isNaN(d.getTime()) ? "—" : fmt.format(d);

  return [
    `Sunrise ${safe(times.sunrise)}`,
    `Golden hour ${safe(times.goldenHourEveningStart)}–${safe(times.goldenHourEveningEnd)}`,
    `Sunset ${safe(times.sunset)}`,
  ].join(" · ");
}
