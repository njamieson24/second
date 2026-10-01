// Small date helpers. Dates are stored as local YYYY-MM-DD strings.

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse YYYY-MM-DD as a local date (not UTC). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from today until `iso`. Negative if it has passed. */
export function daysUntil(iso: string): number {
  const today = parseISODate(todayISO());
  return Math.round((parseISODate(iso).getTime() - today.getTime()) / 86_400_000);
}

/** "Wednesday, September 30" */
export function longDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/** "January 6" or "Tuesday, January 6" */
export function dayLabel(iso: string, withWeekday = false): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: withWeekday ? "long" : undefined,
    month: "long",
    day: "numeric",
  });
}

/** "Sep 28" */
export function shortDay(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------- Months ("YYYY-MM") ----------

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  return monthKey(todayISO());
}

export function shiftMonth(key: string, by: number): string {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y, m - 1 + by, 1);
  return toISODate(date).slice(0, 7);
}

/** The `count` months ending with `key`, oldest first. */
export function monthsEnding(key: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(key, i - count + 1));
}

/** "September" / "Sep" */
export function monthName(key: string, style: "long" | "short" = "long"): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: style });
}
