"use client";

import { useEffect, useRef } from "react";
import { MapPin, Plus, Repeat } from "lucide-react";
import { formatTime, formatTimeRange, lanes, onDay, startOfDay, type Occurrence } from "@/lib/calendar";
import { parseISODate, todayISO } from "@/lib/dates";
import { eventStyles } from "./eventStyles";

const HOUR_PX = 52;
const DEFAULT_HOUR = 7;
const VISIBLE_HOURS = 14; // 7 AM to 9 PM before scrolling

type Handlers = {
  /** Tap an empty time or day */
  onAdd: (day: string, time?: string, allDay?: boolean) => void;
  /** Tap an event */
  onOpen: (occurrence: Occurrence) => void;
};

function hourLabel(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "Noon";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function dayName(day: string, style: "short" | "long" = "short"): string {
  return parseISODate(day).toLocaleDateString("en-US", { weekday: style });
}

function longDay(day: string): string {
  return parseISODate(day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function describe(o: Occurrence): string {
  const when = o.allDay ? "all day" : formatTimeRange(o.start, o.end);
  return `${o.event.title}, ${when}${o.event.repeatsWeekly ? ", repeats weekly" : ""}`;
}

/** A small event pill (month view, all-day row). */
function EventChip({ o, onOpen, showTime }: { o: Occurrence; onOpen: Handlers["onOpen"]; showTime?: boolean }) {
  const s = eventStyles[o.event.type];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(o);
      }}
      aria-label={describe(o)}
      className={`relative z-10 flex min-h-7 w-full items-center gap-1.5 truncate rounded-lg border-l-[3px] px-2 text-left text-[13px] font-medium ${s.fill} ${s.text} ${s.stripe} hover:brightness-95`}
    >
      {showTime && !o.allDay && <span className="shrink-0 font-normal opacity-80">{formatTime(o.start)}</span>}
      <span className="truncate">{o.event.title}</span>
    </button>
  );
}

// ---------- Week view ----------

export function WeekView({ days, occurrences, onAdd, onOpen }: Handlers & { days: string[]; occurrences: Occurrence[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const weekKey = days[0];

  // Open at the current time (this week) or the first event of the week, else 7 AM.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const now = new Date();
    let hour = DEFAULT_HOUR;
    if (days.includes(today)) hour = Math.max(0, now.getHours() - 1);
    else {
      const firstTimed = occurrences.filter((o) => !o.allDay).map((o) => o.start.getHours());
      if (firstTimed.length) hour = Math.max(0, Math.min(...firstTimed) - 1);
    }
    el.scrollTop = Math.min(hour, 24 - VISIBLE_HOURS) * HOUR_PX;
    // Only when the week changes, not on every edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const allDayRows = days.map((d) => onDay(occurrences, d).filter((o) => o.allDay));
  const hasAllDay = allDayRows.some((r) => r.length > 0);
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_PX;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      {/* Day names */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div />
        {days.map((d) => {
          const isToday = d === today;
          return (
            <div key={d} className="flex flex-col items-center gap-0.5 border-l border-line-soft py-2.5">
              <span className={`text-[13px] font-medium ${isToday ? "text-sky-ink" : "text-muted"}`}>{dayName(d)}</span>
              <span
                className={`flex size-9 items-center justify-center rounded-full text-[17px] font-semibold ${
                  isToday ? "bg-sky text-on-sky" : ""
                }`}
              >
                {parseISODate(d).getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-line">
        <div className="flex items-center justify-end pr-2 text-[12px] text-muted">All day</div>
        {days.map((d, i) => (
          <div key={d} className="relative flex min-h-11 flex-col gap-1 border-l border-line-soft p-1">
            <button
              type="button"
              onClick={() => onAdd(d, undefined, true)}
              aria-label={`Add an all-day event on ${longDay(d)}`}
              className="absolute inset-0 hover:bg-paper"
            />
            {allDayRows[i].map((o) => (
              <EventChip key={o.key} o={o} onOpen={onOpen} />
            ))}
            {!hasAllDay && <span className="sr-only">No all-day events</span>}
          </div>
        ))}
      </div>

      {/* Hours */}
      <div ref={scroller} className="overflow-y-auto" style={{ height: VISIBLE_HOURS * HOUR_PX }}>
        <div className="relative grid grid-cols-[60px_repeat(7,minmax(0,1fr))]" style={{ height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[12px] text-muted"
                style={{ top: h * HOUR_PX }}
                aria-hidden="true"
              >
                {h === 0 ? "" : hourLabel(h)}
              </div>
            ))}
          </div>
          {days.map((d) => {
            const dayOcc = onDay(occurrences, d).filter((o) => !o.allDay);
            const layout = lanes(dayOcc);
            const dayStart = startOfDay(d).getTime();
            return (
              <div key={d} className={`relative border-l border-line-soft ${d === today ? "bg-sky-tint/30" : ""}`}>
                {Array.from({ length: 24 }, (_, h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => onAdd(d, `${String(h).padStart(2, "0")}:00`)}
                    aria-label={`Add an event on ${longDay(d)} at ${hourLabel(h)}`}
                    className="block w-full border-t border-line-soft hover:bg-paper"
                    style={{ height: HOUR_PX }}
                  />
                ))}
                {dayOcc.map((o) => {
                  const s = eventStyles[o.event.type];
                  const startMin = Math.max(0, (o.start.getTime() - dayStart) / 60000);
                  const endMin = Math.min(24 * 60, (o.end.getTime() - dayStart) / 60000);
                  const height = Math.max(22, ((endMin - startMin) / 60) * HOUR_PX - 2);
                  const { lane, of } = layout.get(o.key) ?? { lane: 0, of: 1 };
                  return (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => onOpen(o)}
                      aria-label={describe(o)}
                      className={`absolute z-10 flex flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[13px] leading-tight shadow-sm ${s.fill} ${s.text} ${s.stripe} hover:brightness-95`}
                      style={{
                        top: (startMin / 60) * HOUR_PX + 1,
                        height,
                        left: `calc(${(lane / of) * 100}% + 2px)`,
                        width: `calc(${100 / of}% - 4px)`,
                      }}
                    >
                      <span className="truncate font-semibold">{o.event.title}</span>
                      {height > 34 && <span className="truncate opacity-80">{formatTimeRange(o.start, o.end)}</span>}
                      {height > 52 && o.event.location && <span className="truncate opacity-80">{o.event.location}</span>}
                    </button>
                  );
                })}
                {d === today && (
                  <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }} aria-hidden="true">
                    <div className="relative h-0.5 bg-sky">
                      <span className="absolute -top-[5px] -left-[5px] size-3 rounded-full bg-sky" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Month view ----------

export function MonthView({
  cells,
  month,
  occurrences,
  onAdd,
  onOpen,
  onShowDay,
}: Handlers & { cells: string[]; month: number; occurrences: Occurrence[]; onShowDay: (day: string) => void }) {
  const today = todayISO();
  return (
    <div className="overflow-hidden rounded-card border border-line bg-card">
      <div className="grid grid-cols-7 border-b border-line">
        {cells.slice(0, 7).map((d) => (
          <div key={d} className="py-2.5 text-center text-[13px] font-medium text-muted">
            {dayName(d)}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const date = parseISODate(d);
          const inMonth = date.getMonth() === month;
          const items = onDay(occurrences, d);
          const shown = items.slice(0, 3);
          const isToday = d === today;
          return (
            <div
              key={d}
              className={`relative flex min-h-[118px] flex-col gap-1 p-1.5 ${i % 7 ? "border-l border-line-soft" : ""} ${
                i >= 7 ? "border-t border-line-soft" : ""
              } ${inMonth ? "" : "bg-paper"}`}
            >
              <button
                type="button"
                onClick={() => onAdd(d)}
                aria-label={`Add an event on ${longDay(d)}`}
                className="absolute inset-0 hover:bg-paper/70"
              />
              <span
                className={`pointer-events-none relative flex size-7 items-center justify-center self-start rounded-full text-[14px] font-semibold ${
                  isToday ? "bg-sky text-on-sky" : inMonth ? "" : "text-muted"
                }`}
              >
                {date.getDate()}
              </span>
              {shown.map((o) => (
                <EventChip key={o.key} o={o} onOpen={onOpen} showTime />
              ))}
              {items.length > 3 && (
                <button
                  type="button"
                  onClick={() => onShowDay(d)}
                  className="relative z-10 min-h-7 self-start rounded-lg px-1.5 text-[13px] font-medium text-sky-ink hover:underline"
                >
                  +{items.length - 3} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Phone: a simple day-by-day list ----------

export function DayList({
  days,
  occurrences,
  onAdd,
  onOpen,
  skipEmpty,
}: Handlers & { days: string[]; occurrences: Occurrence[]; skipEmpty?: boolean }) {
  const today = todayISO();
  const shownDays = days.filter((d) => !skipEmpty || d === today || onDay(occurrences, d).length > 0);
  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {shownDays.map((d) => {
        const items = onDay(occurrences, d);
        const isToday = d === today;
        return (
          <li key={d} className="rounded-card border border-line bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 className={`m-0 text-[16px] font-semibold ${isToday ? "text-sky-ink" : ""}`}>
                {isToday ? "Today · " : ""}
                {parseISODate(d).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
              </h3>
              <button
                type="button"
                onClick={() => onAdd(d)}
                aria-label={`Add an event on ${longDay(d)}`}
                className="flex size-11 items-center justify-center rounded-full text-sky-ink hover:bg-sky-tint"
              >
                <Plus size={20} aria-hidden="true" />
              </button>
            </div>
            {items.length === 0 ? (
              <p className="m-0 text-[15px] text-muted">Nothing planned.</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {items.map((o) => {
                  const s = eventStyles[o.event.type];
                  return (
                    <li key={o.key}>
                      <button
                        type="button"
                        onClick={() => onOpen(o)}
                        className={`flex min-h-12 w-full items-start gap-3 rounded-row border-l-4 px-3.5 py-2.5 text-left ${s.fill} ${s.stripe}`}
                      >
                        <span className={`w-[76px] shrink-0 text-[14px] font-medium ${s.text}`}>
                          {o.allDay ? "All day" : formatTime(o.start)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[15px] font-semibold ${s.text}`}>{o.event.title}</span>
                          {(o.event.location || o.event.repeatsWeekly) && (
                            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
                              {o.event.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={13} aria-hidden="true" />
                                  {o.event.location}
                                </span>
                              )}
                              {o.event.repeatsWeekly && (
                                <span className="flex items-center gap-1">
                                  <Repeat size={13} aria-hidden="true" />
                                  Every week
                                </span>
                              )}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}
