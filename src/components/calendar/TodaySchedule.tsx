"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyStates";
import { TextLink } from "@/components/TextLink";
import { formatTime, occurrencesBetween, roadmapDates, startOfDay } from "@/lib/calendar";
import { useLoadedData } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { eventStyles } from "./eventStyles";

/** Dashboard card: today's real events, in time order. */
export function TodaySchedule() {
  const { business, events } = useLoadedData();
  const today = todayISO();
  const items = occurrencesBetween(events, startOfDay(today), startOfDay(addDays(today, 1)), roadmapDates(business, null));
  const timed = items.filter((o) => !o.allDay).length;

  return (
    <Card
      title="Today's schedule"
      aside={
        items.length > 0 ? (
          <span className="text-sm text-muted">
            {timed} {timed === 1 ? "appointment" : "appointments"}
          </span>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <EmptyState
          className="mt-3"
          text="Nothing on your calendar today."
          action={
            <Button href="/calendar?add=today" size="sm" icon={<Plus size={16} aria-hidden="true" />}>
              Add an event
            </Button>
          }
        />
      ) : (
        <>
          <ul className="mt-2 mb-0 list-none p-0">
            {items.map((o, i) => {
              const s = eventStyles[o.event.type];
              return (
                <li key={o.key} className={i === items.length - 1 ? "pt-[11px]" : "border-b border-line-soft py-[11px]"}>
                  <Link href={o.link ?? "/calendar"} className="flex gap-3.5 rounded-lg text-ink no-underline hover:bg-paper">
                    <span className={`w-[72px] shrink-0 text-sm font-medium ${s.text}`}>
                      {o.allDay ? "All day" : formatTime(o.start)}
                    </span>
                    <span className={`min-w-0 flex-1 border-l-[3px] pl-2.5 ${s.stripe}`}>
                      <span className="block text-[15px] font-medium">{o.event.clientName ?? o.event.title}</span>
                      <span className="block text-sm text-muted">
                        {o.event.clientName ? o.event.title.replace(`, ${o.event.clientName}`, "") : o.event.location ?? ""}
                        {!o.allDay && ` · ${Math.round((o.end.getTime() - o.start.getTime()) / 60000)} min`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 mb-0 text-sm">
            <TextLink href="/calendar">Open calendar</TextLink>
          </p>
        </>
      )}
    </Card>
  );
}
