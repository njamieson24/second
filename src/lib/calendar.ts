// Calendar logic: time zones, weekly repeats, "this and all future" changes,
// and the roadmap dates that appear automatically. No saving here: changes go
// through store.ts (addEvent / updateEvent / deleteEvent).
//
// Time zones: timed events are exact moments, shown in THIS device's time zone
// (the JavaScript Date methods). Weekly repeats are counted in the zone the event
// was made in, so "Tuesdays at 10 AM" stays 10 AM across daylight saving changes.
// All-day events are plain dates and never shift.

import { addDays, parseISODate, toISODate } from "./dates";
import type { RoadmapProgress } from "./roadmap";
import { addEvent, deleteEvent, updateEvent, type Business, type CalendarEvent, type EventType } from "./store";
import { dateKeyIn, partsIn, zonedToDate } from "./timezone";

// ---------- Time zone helpers (shared with the server) ----------

export { dateKeyIn, partsIn, zonedToDate } from "./timezone";

/** Midnight at the start of a YYYY-MM-DD day, on this device. */
export function startOfDay(key: string): Date {
  return parseISODate(key);
}

/** A timed start/end on this device, from a date key and "HH:MM". */
export function localDateTime(key: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = parseISODate(key);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** "HH:MM" on this device. */
export function timeValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// ---------- Display ----------

/** "10 AM" or "10:30 AM" */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} to ${formatTime(end)}`;
}

export const EVENT_TYPES: { id: EventType; label: string; short: string }[] = [
  { id: "appointment", label: "Client appointment", short: "Appointment" },
  { id: "business", label: "Business event", short: "Event" },
  { id: "deadline", label: "Deadline", short: "Deadline" },
  { id: "reminder", label: "Reminder", short: "Reminder" },
];

export function typeLabel(type: EventType): string {
  return EVENT_TYPES.find((t) => t.id === type)?.label ?? type;
}

// ---------- Occurrences (repeats expanded) ----------

export type Occurrence = {
  /** Unique per occurrence (event id + date) */
  key: string;
  event: CalendarEvent;
  allDay: boolean;
  start: Date;
  end: Date;
  /** First and last day it covers, YYYY-MM-DD on this device (inclusive) */
  firstDay: string;
  lastDay: string;
  /** This occurrence's date in the event's own time zone (used to split repeats) */
  seriesDate: string;
  /** True for the first time a repeating event happens (or any non-repeating event) */
  isFirst: boolean;
  /** Made automatically from the roadmap: tap opens this page instead of editing */
  link?: string;
};

const WEEK = 7 * 24 * 60 * 60 * 1000;

function occurrencesOf(event: CalendarEvent, from: Date, to: Date, link?: string): Occurrence[] {
  const out: Occurrence[] = [];
  const maxRepeats = event.repeatsWeekly ? 520 : 1; // up to 10 years of weeks

  if (event.allDay) {
    const spanDays = Math.max(
      0,
      Math.round((parseISODate(event.end).getTime() - parseISODate(event.start).getTime()) / 86_400_000),
    );
    const firstK = event.repeatsWeekly
      ? Math.max(0, Math.floor((from.getTime() - parseISODate(event.start).getTime()) / WEEK) - 1)
      : 0;
    for (let k = firstK; k < maxRepeats; k++) {
      const day = addDays(event.start, 7 * k);
      if (event.repeatUntil && day > event.repeatUntil) break;
      const startD = parseISODate(day);
      if (startD >= to) break;
      const lastDay = addDays(day, spanDays);
      const endD = parseISODate(addDays(lastDay, 1));
      if (endD > from) {
        out.push({ key: `${event.id}:${day}`, event, allDay: true, start: startD, end: endD, firstDay: day, lastDay, seriesDate: day, isFirst: k === 0, link });
      }
    }
    return out;
  }

  const base = new Date(event.start);
  const duration = Math.max(0, new Date(event.end).getTime() - base.getTime());
  const wall = partsIn(base, event.timeZone);
  const baseDay = dateKeyIn(base, event.timeZone);
  const firstK = event.repeatsWeekly ? Math.max(0, Math.floor((from.getTime() - base.getTime()) / WEEK) - 1) : 0;
  for (let k = firstK; k < maxRepeats; k++) {
    const seriesDate = addDays(baseDay, 7 * k);
    if (event.repeatUntil && seriesDate > event.repeatUntil) break;
    const [y, m, d] = seriesDate.split("-").map(Number);
    const start = k === 0 ? base : zonedToDate({ y, m, d, h: wall.h, min: wall.min }, event.timeZone);
    if (start >= to) break;
    const end = new Date(start.getTime() + duration);
    if (end > from || (duration === 0 && start >= from)) {
      out.push({
        key: `${event.id}:${seriesDate}`,
        event,
        allDay: false,
        start,
        end,
        firstDay: toISODate(start),
        lastDay: toISODate(new Date(Math.max(start.getTime(), end.getTime() - 1))),
        seriesDate,
        isFirst: k === 0,
        link,
      });
    }
  }
  return out;
}

/** Every occurrence between `from` and `to`, in time order (all-day first on each day). */
export function occurrencesBetween(
  events: CalendarEvent[],
  from: Date,
  to: Date,
  extras: { event: CalendarEvent; link: string }[] = [],
): Occurrence[] {
  return [
    ...events.flatMap((e) => occurrencesOf(e, from, to)),
    ...extras.flatMap((x) => occurrencesOf(x.event, from, to, x.link)),
  ].sort((a, b) =>
    a.firstDay !== b.firstDay
      ? a.firstDay < b.firstDay
        ? -1
        : 1
      : a.allDay !== b.allDay
        ? a.allDay
          ? -1
          : 1
        : a.start.getTime() - b.start.getTime(),
  );
}

/** Occurrences that touch a given day (YYYY-MM-DD on this device). */
export function onDay(occurrences: Occurrence[], day: string): Occurrence[] {
  return occurrences.filter((o) => o.firstDay <= day && o.lastDay >= day);
}

// ---------- Roadmap dates (made automatically, not saved) ----------

/**
 * Opening day, plus one all-day deadline for each unfinished roadmap stage,
 * spaced evenly from when the person signed up to their opening day. Only shown
 * once opening day is set. They move automatically if opening day changes.
 */
export function roadmapDates(business: Business, roadmap: RoadmapProgress | null): { event: CalendarEvent; link: string }[] {
  if (!business.openingDay) return [];
  const base = {
    allDay: true,
    timeZone: "UTC",
    repeatsWeekly: false,
    source: "roadmap" as const,
  };
  const items: { event: CalendarEvent; link: string }[] = [
    {
      event: {
        ...base,
        id: "roadmap-opening-day",
        title: "Your opening day",
        type: "business",
        start: business.openingDay,
        end: business.openingDay,
      },
      link: business.launchedAt ? "/app" : "/launch",
    },
  ];
  if (business.launchedAt || !roadmap) return items;

  const from = toISODate(new Date(business.createdAt));
  const span = Math.max(
    0,
    Math.round((parseISODate(business.openingDay).getTime() - parseISODate(from).getTime()) / 86_400_000),
  );
  const count = roadmap.stages.length;
  roadmap.stages.forEach((stage, i) => {
    if (i === count - 1) return; // the last stage is opening day itself
    if (roadmap.statuses[i] === "done") return;
    const day = addDays(from, Math.round((span * (i + 1)) / count));
    items.push({
      event: {
        ...base,
        id: `roadmap-stage-${stage.id}`,
        title: `Finish: ${stage.label}`,
        type: "deadline",
        start: day,
        end: day,
      },
      link: `/launch/roadmap?stage=${stage.id}`,
    });
  });
  return items;
}

// ---------- "This and all future" changes ----------

export type EventChanges = Partial<Omit<CalendarEvent, "id">>;

/**
 * Save changes made to one occurrence. For a repeating event (and not its first
 * time), this applies to this one and all future ones: the old series ends the
 * day before, and a new series starts here. Past ones stay as they were.
 */
export async function saveFromHere(occurrence: Occurrence, changes: EventChanges): Promise<void> {
  const event = occurrence.event;
  if (!event.repeatsWeekly || occurrence.isFirst) {
    await updateEvent(event.id, changes);
    return;
  }
  await updateEvent(event.id, { repeatUntil: addDays(occurrence.seriesDate, -1) });
  const { id: _old, ...rest } = event;
  void _old;
  await addEvent({ ...rest, ...changes });
}

/** Delete one occurrence and all future ones (or the whole event if it's the first). */
export async function deleteFromHere(occurrence: Occurrence): Promise<void> {
  const event = occurrence.event;
  if (!event.repeatsWeekly || occurrence.isFirst) {
    await deleteEvent(event.id);
    return;
  }
  await updateEvent(event.id, { repeatUntil: addDays(occurrence.seriesDate, -1) });
}

// ---------- Grids ----------

/** Sunday at the start of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

/** The 7 day keys of the week containing `date`. */
export function weekDays(date: Date): string[] {
  const start = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** 6 weeks of day keys covering the month of `date`. */
export function monthGrid(date: Date): string[] {
  const start = weekStart(new Date(date.getFullYear(), date.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => toISODate(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
}

/** Side-by-side lanes for timed events that overlap on one day. */
export function lanes(dayOccurrences: Occurrence[]): Map<string, { lane: number; of: number }> {
  const timed = dayOccurrences.filter((o) => !o.allDay).sort((a, b) => a.start.getTime() - b.start.getTime());
  const result = new Map<string, { lane: number; of: number }>();
  let group: Occurrence[] = [];
  let groupEnd = 0;
  let laneEnds: number[] = [];
  const close = () => {
    const of = Math.max(1, laneEnds.length);
    group.forEach((o) => {
      const r = result.get(o.key)!;
      result.set(o.key, { ...r, of });
    });
    group = [];
    laneEnds = [];
  };
  for (const o of timed) {
    const s = o.start.getTime();
    const e = Math.max(o.end.getTime(), s + 15 * 60 * 1000);
    if (group.length && s >= groupEnd) close();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else laneEnds[lane] = e;
    result.set(o.key, { lane, of: 1 });
    group.push(o);
    groupEnd = Math.max(groupEnd, e);
  }
  close();
  return result;
}
