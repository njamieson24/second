"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AddMoneyDialog } from "@/components/AddMoneyDialog";
import { Button } from "@/components/Button";
import { DayList, MonthView, WeekView } from "@/components/calendar/CalendarViews";
import { EventDialog, type EventTarget } from "@/components/calendar/EventDialog";
import type { PaidFrom } from "@/components/money/QuickIncome";
import { eventStyles } from "@/components/calendar/eventStyles";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { EVENT_TYPES, monthGrid, occurrencesBetween, roadmapDates, startOfDay, weekDays, type Occurrence } from "@/lib/calendar";
import { capital, familyOf } from "@/lib/business-kinds";
import { useLoadedData, useRoadmap } from "@/lib/data";
import { addDays, parseISODate, todayISO } from "@/lib/dates";

type View = "week" | "month";

export default function CalendarPage() {
  return (
    <AppShell mode="current">
      {/* useSearchParams needs a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <Calendar />
      </Suspense>
    </AppShell>
  );
}

function rangeLabel(view: View, days: string[], anchor: Date): string {
  if (view === "month") return anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const first = parseISODate(days[0]);
  const last = parseISODate(days[6]);
  const sameMonth = first.getMonth() === last.getMonth();
  const a = first.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const b = last.toLocaleDateString("en-US", sameMonth ? { day: "numeric" } : { month: "long", day: "numeric" });
  return `${a} to ${b}, ${last.getFullYear()}`;
}

function Calendar() {
  const { business, events } = useLoadedData();
  const roadmap = useRoadmap();
  const params = useSearchParams();
  const router = useRouter();
  const view: View = params.get("view") === "month" ? "month" : "week";
  const [anchor, setAnchor] = useState(() => startOfDay(params.get("date") ?? todayISO()));
  // /calendar?add=today opens the form for today (from the dashboard).
  const [paid, setPaid] = useState<PaidFrom | null>(null);
  const [target, setTarget] = useState<EventTarget | null>(() =>
    params.get("add") === "today" ? { mode: "new", day: todayISO(), time: "09:00" } : null,
  );

  const days = view === "week" ? weekDays(anchor) : monthGrid(anchor);
  const from = startOfDay(days[0]);
  const to = startOfDay(addDays(days[days.length - 1], 1));
  const extras = roadmapDates(business, business.launchedAt ? null : roadmap);
  const occurrences = occurrencesBetween(events, from, to, extras);
  const monthDays = view === "month" ? days.filter((d) => parseISODate(d).getMonth() === anchor.getMonth()) : days;

  const setView = (v: View) => router.replace(`/calendar?view=${v}`, { scroll: false });
  const move = (step: number) => {
    const next = new Date(anchor);
    if (view === "week") next.setDate(next.getDate() + 7 * step);
    else next.setMonth(next.getMonth() + step, 1);
    setAnchor(next);
  };
  const open = (o: Occurrence) => (o.link ? router.push(o.link) : setTarget({ mode: "edit", occurrence: o }));
  const add = (day: string, time?: string, allDay?: boolean) => setTarget({ mode: "new", day, time: time ?? "09:00", allDay });

  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Calendar"
        subtitle={rangeLabel(view, days, anchor)}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full border border-line-strong bg-card p-1">
              <button
                type="button"
                onClick={() => move(-1)}
                aria-label={view === "week" ? "Previous week" : "Previous month"}
                className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setAnchor(startOfDay(todayISO()))}
                className="min-h-11 rounded-full px-3 text-[15px] font-medium hover:bg-line-soft"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => move(1)}
                aria-label={view === "week" ? "Next week" : "Next month"}
                className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            <div role="radiogroup" aria-label="Show" className="flex gap-1 rounded-full bg-line-soft p-1">
              {(["week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={`min-h-11 rounded-full px-4 text-[15px] ${
                    view === v ? "bg-card font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {v === "week" ? "Week" : "Month"}
                </button>
              ))}
            </div>
            <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => add(todayISO())}>
              Add event
            </Button>
          </>
        }
      />

      <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-[14px] text-muted" aria-label="Colors">
        {EVENT_TYPES.map((t) => (
          <li key={t.id} className="flex items-center gap-2">
            <span className={`size-3 rounded-full ${eventStyles[t.id].dot}`} aria-hidden="true" />
            {t.label}
          </li>
        ))}
      </ul>

      {/* Desktop: grids. Phones: a simple day-by-day list. */}
      <div className="hidden desk:block">
        {view === "week" ? (
          <WeekView days={days} occurrences={occurrences} onAdd={add} onOpen={open} />
        ) : (
          <MonthView
            cells={days}
            month={anchor.getMonth()}
            occurrences={occurrences}
            onAdd={add}
            onOpen={open}
            onShowDay={(d) => {
              setAnchor(startOfDay(d));
              setView("week");
            }}
          />
        )}
      </div>
      <div className="desk:hidden">
        <DayList days={monthDays} occurrences={occurrences} onAdd={add} onOpen={open} skipEmpty={view === "month"} />
      </div>

      <EventDialog
        target={target}
        onClose={() => setTarget(null)}
        onGotPaid={(p) => {
          setTarget(null);
          setPaid(p);
        }}
      />
      <AddMoneyDialog kind={paid ? "income" : null} incomeCategory={capital(familyOf(business.type).words.visit)} paid={paid ?? undefined} onClose={() => setPaid(null)} />
    </PageBody>
  );
}
