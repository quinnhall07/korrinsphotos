// lib/csv.ts
// Minimal CSV serialisation helpers for /admin/exports.
//
// Pure / isomorphic — safe to import from server routes, server actions, or
// (theoretically) client code. No I/O, no SDKs.
//
// Wave 11 — used by every route under `app/api/exports/*` so escaping rules
// stay consistent. The existing `/api/expenses/export` route ships its own
// inlined helper for back-compat — do NOT rewire it through this module
// without also re-validating its QuickBooks-Self-Employed format.

/**
 * Escape one cell for CSV output.
 *
 * Rules (RFC 4180 + the bare minimum to please Excel / Numbers / Sheets):
 *   - `null` and `undefined` become the empty string.
 *   - Booleans / numbers stringify naturally.
 *   - If the stringified value contains a comma, double-quote, CR, or LF,
 *     wrap the whole cell in double-quotes and double any internal quote.
 *   - Otherwise the value is returned verbatim.
 */
export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : String(value);
  if (
    str.includes(",") ||
    str.includes("\"") ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a CSV body from a header row and an iterable of data rows.
 *
 * Each cell is escaped with `escapeCsv`. Lines are joined with `\n` and a
 * trailing newline is appended so concatenation is friendly.
 */
export function rowsToCsv(
  headers: string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | boolean | null | undefined>>,
): string {
  const head = headers.map(escapeCsv).join(",");
  const body = rows.map((r) => r.map(escapeCsv).join(",")).join("\n");
  return rows.length === 0 ? `${head}\n` : `${head}\n${body}\n`;
}

/**
 * Build the standard `Content-Disposition` value for a date-stamped CSV
 * download. `name` is the bare filename (no extension); the helper appends
 * the current UTC date and `.csv`.
 */
export function csvFilename(name: string, now: Date = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${name}-${yyyy}-${mm}-${dd}.csv`;
}
