// lib/date.ts
// Centralized date formatting utilities

export type TimestampLike = {
  toDate?: () => Date;
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && "toDate" in value) {
    const date = (value as TimestampLike).toDate?.();
    return date instanceof Date ? date : null;
  }
  return null;
}

export function formatDisplayDate(value: unknown): string | null {
  const date = toDate(value);
  return date
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
}

export function formatDateInput(value: unknown): string | null {
  const date = toDate(value);
  return date ? date.toISOString().slice(0, 10) : null;
}

export function formatDateTime(value: unknown): string | null {
  const date = toDate(value);
  return date
    ? date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
}
