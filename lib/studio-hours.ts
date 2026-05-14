// lib/studio-hours.ts
// Phase 13.2 — Pure isomorphic helper that decides whether a moment in
// time falls inside the studio's configured operating window.
//
// No Firestore, no Node-only APIs. Uses `Intl.DateTimeFormat` to project
// `now` into the configured timezone — that lets us reason about the
// "wall-clock" day-of-week and hour:minute in the studio's local zone
// without pulling in a tz library.
//
// Resolution order (first match wins):
//   1. Vacation window — STRICTLY closed for the whole range.
//   2. Holiday date — full day closed.
//   3. Day-of-week schedule — closed if `open`/`close` are null.
//   4. Time-of-day window — closed before `open` or at/after `close`.
//   5. Otherwise → OPEN.
//
// `nextOpenAt` walks forward up to 14 days looking for the next minute
// the studio is open according to the same rules. If nothing is found
// within the window, returns `null`.

import type { StudioHours, DayOfWeek } from "@/lib/db/admin-settings";

export type IsOpenReason =
  | "OPEN"
  | "OUT_OF_HOURS"
  | "DAY_CLOSED"
  | "HOLIDAY"
  | "VACATION";

export interface IsOpenResult {
  isOpen: boolean;
  reason: IsOpenReason;
  /** First moment we'll be open after `now` — null if not found within 14 days. */
  nextOpenAt: Date | null;
  /** Human label, e.g. "Monday at 9:00 AM". Empty string when `nextOpenAt` is null. */
  nextOpenLabel: string;
}

interface WallClock {
  /** "YYYY-MM-DD" in the configured timezone. */
  dateKey: string;
  /** 0–6, Sunday-indexed. */
  dayOfWeek: DayOfWeek;
  /** 0–23. */
  hour: number;
  /** 0–59. */
  minute: number;
}

/**
 * Project a UTC `Date` into the given IANA timezone and return its
 * wall-clock components. We use `Intl.DateTimeFormat` with `formatToParts`
 * because that's the only browser-and-node API that handles DST
 * transitions correctly without a third-party library.
 *
 * If `timezone` is invalid, Intl will throw — callers catch and fall
 * back to UTC.
 */
function wallClock(now: Date, timezone: string): WallClock {
  let parts: Intl.DateTimeFormatPart[];
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    parts = fmt.formatToParts(now);
  } catch {
    // Invalid tz — fall back to UTC parts. Still gives the caller a
    // usable answer; off-hours email is approximate anyway.
    const utc = new Date(now.toISOString());
    return {
      dateKey: utc.toISOString().slice(0, 10),
      dayOfWeek: utc.getUTCDay() as DayOfWeek,
      hour: utc.getUTCHours(),
      minute: utc.getUTCMinutes(),
    };
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hourStr = get("hour");
  const minuteStr = get("minute");
  const weekdayStr = get("weekday");

  // `hour12:false` in some engines emits "24" at midnight — normalise to "00".
  if (hourStr === "24") hourStr = "00";

  const WEEKDAY_MAP: Record<string, DayOfWeek> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    dateKey: `${year}-${month}-${day}`,
    dayOfWeek: (WEEKDAY_MAP[weekdayStr] ?? 0) as DayOfWeek,
    hour: parseInt(hourStr, 10) || 0,
    minute: parseInt(minuteStr, 10) || 0,
  };
}

/**
 * Parse a "HH:MM" string into a (hour, minute) pair. Invalid strings
 * return null so the caller can treat them as "closed".
 */
function parseTimeOfDay(s: string | null | undefined): { h: number; m: number } | null {
  if (!s) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return { h, m };
}

/** Compare two "HH:MM" times by absolute minutes. */
function minutesSinceMidnight(h: number, m: number): number {
  return h * 60 + m;
}

/**
 * Test if "YYYY-MM-DD" falls inside the inclusive [start, end] range.
 * Empty/null start or end → not in range.
 */
function dateKeyInRange(
  dateKey: string,
  start: string | null | undefined,
  end: string | null | undefined
): boolean {
  if (!start || !end) return false;
  // Lexicographic comparison works for ISO date keys.
  return dateKey >= start && dateKey <= end;
}

/**
 * Inner step: classify a wall-clock moment against the schedule. Returns
 * `OPEN` if the moment falls inside an open window, otherwise the most
 * specific closed-reason.
 */
function classify(wc: WallClock, hours: StudioHours): IsOpenReason {
  // 1. Vacation
  if (dateKeyInRange(wc.dateKey, hours.vacationStart, hours.vacationEnd)) {
    return "VACATION";
  }

  // 2. Holiday
  if (hours.holidayDates && hours.holidayDates.includes(wc.dateKey)) {
    return "HOLIDAY";
  }

  // 3. Day-of-week schedule
  const day = hours.weeklySchedule.find((d) => d.dayOfWeek === wc.dayOfWeek);
  if (!day) return "DAY_CLOSED";
  const open = parseTimeOfDay(day.open);
  const close = parseTimeOfDay(day.close);
  if (!open || !close) return "DAY_CLOSED";

  // 4. Time-of-day window. Open inclusive, close exclusive — at exactly
  // close time we report OUT_OF_HOURS.
  const cur = minutesSinceMidnight(wc.hour, wc.minute);
  const oMin = minutesSinceMidnight(open.h, open.m);
  const cMin = minutesSinceMidnight(close.h, close.m);
  if (cur < oMin || cur >= cMin) return "OUT_OF_HOURS";

  return "OPEN";
}

/**
 * Walk forward minute-by-minute (cheaply — we only sample candidate
 * boundaries) to find the next moment the studio is open.
 *
 * Strategy: for each of the next 14 days, check the day's `open` time. If
 * that day is open at all (not vacation/holiday/closed), the candidate
 * open moment is that day's open hh:mm. Build a Date that represents
 * that wall-clock moment in the configured timezone.
 *
 * Converting "wall-clock in tz" → UTC instant: use `Date.UTC` to make a
 * naive UTC Date, then measure the gap between that Date's projection
 * into the configured tz vs UTC, and apply the offset. This is the
 * standard "fake-tz" trick — it's approximate around DST transitions but
 * good enough for an off-hours auto-responder.
 */
function findNextOpen(now: Date, hours: StudioHours): Date | null {
  for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
    // Build a UTC anchor for `dayOffset` days from `now`, then re-project
    // into tz to learn what wall-clock date/day-of-week that lands on.
    const anchorUtc = new Date(now.getTime() + dayOffset * 86_400_000);
    const wc = wallClock(anchorUtc, hours.timezone);

    if (dateKeyInRange(wc.dateKey, hours.vacationStart, hours.vacationEnd)) continue;
    if (hours.holidayDates && hours.holidayDates.includes(wc.dateKey)) continue;

    const day = hours.weeklySchedule.find((d) => d.dayOfWeek === wc.dayOfWeek);
    if (!day) continue;
    const open = parseTimeOfDay(day.open);
    const close = parseTimeOfDay(day.close);
    if (!open || !close) continue;

    // The candidate open instant is "wc.dateKey at open.h:open.m" in tz.
    // For today (dayOffset 0), if we're already past open and still
    // within the window, OPEN is now (caller handles). If we're past
    // close, skip to tomorrow.
    if (dayOffset === 0) {
      const cur = minutesSinceMidnight(wc.hour, wc.minute);
      const cMin = minutesSinceMidnight(close.h, close.m);
      const oMin = minutesSinceMidnight(open.h, open.m);
      if (cur >= cMin) continue;       // past close → next day
      if (cur >= oMin) return now;     // we ARE open right now
    }

    return wallClockToInstant(wc.dateKey, open.h, open.m, hours.timezone);
  }
  return null;
}

/**
 * Convert a wall-clock "YYYY-MM-DD HH:MM" in `timezone` to a UTC Date.
 *
 * Approach: start with a UTC Date for that wall-clock value (pretending
 * it's UTC). Format that Date back through the tz formatter to discover
 * what the tz thinks the wall-clock is. The difference is the offset; we
 * apply it to get the real UTC instant. One iteration is exact except
 * exactly on DST transitions, where it's off by up to an hour — still
 * acceptable for an off-hours email.
 */
function wallClockToInstant(
  dateKey: string,
  hour: number,
  minute: number,
  timezone: string
): Date {
  // dateKey is "YYYY-MM-DD"
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1; // JS months 0-indexed
  const day = parseInt(dayStr, 10);

  // Pretend the wall-clock IS UTC; compute what tz says it would be.
  const asUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  const naive = new Date(asUtc);
  const wc = wallClock(naive, timezone);
  // wc now reflects "what would this UTC instant look like in tz" — the
  // delta between (hour:minute target) and (wc.hour:wc.minute) is the
  // offset we need to subtract.
  const targetMin = minutesSinceMidnight(hour, minute);
  const reportedMin = minutesSinceMidnight(wc.hour, wc.minute);
  // Cross-day handling: if reportedMin appears to wrap around midnight
  // relative to target (e.g. target 02:00, reported 21:00 of prev day),
  // normalise by adding/subtracting 24h worth of minutes based on the
  // dateKey shift.
  let deltaMin = targetMin - reportedMin;
  if (wc.dateKey < dateKey) deltaMin += 24 * 60;
  else if (wc.dateKey > dateKey) deltaMin -= 24 * 60;

  return new Date(asUtc + deltaMin * 60_000);
}

/**
 * Format a Date into "Monday at 9:00 AM" using the studio timezone.
 */
function formatNextOpenLabel(d: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    // Intl returns e.g. "Monday, 9:00 AM" — swap comma+space → " at ".
    return fmt.format(d).replace(/, /, " at ");
  } catch {
    return d.toUTCString();
  }
}

/**
 * Resolve whether the studio is currently open. The main exported entry
 * point — see file header for resolution order.
 */
export function isStudioOpen(hours: StudioHours, now: Date): IsOpenResult {
  const wc = wallClock(now, hours.timezone);
  const reason = classify(wc, hours);
  const isOpen = reason === "OPEN";

  let nextOpenAt: Date | null = null;
  let nextOpenLabel = "";

  if (isOpen) {
    nextOpenAt = now;
    nextOpenLabel = formatNextOpenLabel(now, hours.timezone);
  } else {
    nextOpenAt = findNextOpen(now, hours);
    nextOpenLabel = nextOpenAt
      ? formatNextOpenLabel(nextOpenAt, hours.timezone)
      : "";
  }

  return { isOpen, reason, nextOpenAt, nextOpenLabel };
}

/**
 * Human-readable reason string for the off-hours email body. Picks
 * different phrasing per `reason`.
 */
export function describeClosedReason(
  reason: IsOpenReason,
  hours: StudioHours
): string {
  switch (reason) {
    case "VACATION":
      if (hours.vacationEnd) {
        return `on vacation through ${hours.vacationEnd}`;
      }
      return "on vacation";
    case "HOLIDAY":
      return "closed for the holiday";
    case "DAY_CLOSED":
      return "closed for the day";
    case "OUT_OF_HOURS":
      return "past our studio hours";
    case "OPEN":
    default:
      return "";
  }
}
