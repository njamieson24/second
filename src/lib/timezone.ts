// Time zone math with the built-in Intl API (no libraries). Works in the browser
// and on the server. Used by calendar.ts and demo-content.ts.

export type WallTime = { y: number; m: number; d: number; h: number; min: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    const options: Intl.DateTimeFormatOptions = {
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    try {
      f = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    } catch {
      f = new Intl.DateTimeFormat("en-US", options); // unknown zone: use this device's
    }
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall-clock date and time of `date` in `timeZone`. */
export function partsIn(date: Date, timeZone: string): WallTime & { s: number } {
  const map: Record<string, number> = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  return { y: map.year, m: map.month, d: map.day, h: map.hour % 24, min: map.minute, s: map.second };
}

/** The exact moment when the clock in `timeZone` shows the given date and time. */
export function zonedToDate(p: WallTime, timeZone: string): Date {
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min);
  const offsetAt = (t: number) => {
    const q = partsIn(new Date(t), timeZone);
    return Date.UTC(q.y, q.m - 1, q.d, q.h, q.min, q.s) - Math.floor(t / 1000) * 1000;
  };
  let t = wall - offsetAt(wall);
  const second = offsetAt(t); // re-check near daylight saving changes
  if (wall - second !== t) t = wall - second;
  return new Date(t);
}

/** YYYY-MM-DD for a moment in a time zone. */
export function dateKeyIn(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Add days to a YYYY-MM-DD key (no time zone involved). */
export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
