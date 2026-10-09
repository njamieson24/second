"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "../Card";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, type ContentPost } from "@/lib/content";
import { monthGrid, weekDays } from "@/lib/calendar";
import { todayISO } from "@/lib/dates";

export type CalendarView = "week" | "month";

const statusClass: Record<ContentPost["status"], string> = {
  idea: "border-gray-stripe bg-line-soft text-slate",
  drafted: "border-sky bg-sky-tint text-sky-ink",
  ready: "border-mint-deep bg-mint-tint text-mint-deep",
  posted: "border-mint-deep bg-mint-deep text-on-green",
};

/** The days shown for a view around `anchor` (YYYY-MM-DD). */
export function calendarDays(view: CalendarView, anchor: string): string[] {
  const d = new Date(`${anchor}T12:00:00`);
  return view === "week" ? weekDays(d) : monthGrid(d);
}

/** Planned posts by day, with their status. Tap a post to open it in the editor. */
export function ContentCalendar({
  view,
  anchor,
  posts,
  selectedId,
  onView,
  onAnchor,
  onSelect,
}: {
  view: CalendarView;
  anchor: string;
  posts: ContentPost[];
  selectedId: string | null;
  onView: (v: CalendarView) => void;
  onAnchor: (key: string) => void;
  onSelect: (id: string) => void;
}) {
  const days = calendarDays(view, anchor);
  const today = todayISO();
  const anchorDate = new Date(`${anchor}T12:00:00`);
  const month = anchorDate.getMonth();
  const shift = (n: number) => {
    const d = new Date(anchorDate);
    if (view === "week") d.setDate(d.getDate() + 7 * n);
    else d.setMonth(d.getMonth() + n, 1);
    onAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };
  const title =
    view === "week"
      ? `${new Date(`${days[0]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} to ${new Date(`${days[6]}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : anchorDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const postedThisView = posts.filter((p) => p.status === "posted" && days.includes(p.day)).length;

  return (
    <Card
      title="Content calendar"
      aside={
        <div role="radiogroup" aria-label="Calendar view" className="flex gap-1 rounded-xl bg-line-soft p-1">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => onView(v)}
              className={`min-h-11 rounded-lg px-3.5 text-sm ${view === v ? "bg-card font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              {v === "week" ? "Week" : "Month"}
            </button>
          ))}
        </div>
      }
    >
      <div className="mt-3 mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label={view === "week" ? "Previous week" : "Previous month"} className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft">
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span className="min-w-36 text-center text-[15px] font-medium">{title}</span>
          <button type="button" onClick={() => shift(1)} aria-label={view === "week" ? "Next week" : "Next month"} className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft">
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
        <span className="text-sm text-muted">
          Posted {postedThisView} {postedThisView === 1 ? "time" : "times"} {view === "week" ? "this week" : "this month"}
        </span>
      </div>

      <ul className="m-0 mb-3 flex list-none flex-wrap gap-3 p-0 text-[13px] text-muted" aria-label="What the colors mean">
        {(Object.keys(statusClass) as ContentPost["status"][]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-full border ${statusClass[s]}`} aria-hidden="true" />
            {POST_STATUS_LABELS[s]}
          </li>
        ))}
      </ul>

      <div className={`grid gap-1.5 ${view === "week" ? "grid-cols-1 sm:grid-cols-7" : "grid-cols-7"}`}>
        {days.map((day) => {
          const dayPosts = posts.filter((p) => p.day === day);
          const d = new Date(`${day}T12:00:00`);
          const outside = view === "month" && d.getMonth() !== month;
          return (
            <div
              key={day}
              className={`flex flex-col gap-1 rounded-row border p-1.5 ${view === "week" ? "min-h-24" : "min-h-20"} ${day === today ? "border-sky" : "border-line-soft"} ${outside ? "opacity-50" : ""}`}
            >
              <span className={`text-xs ${day === today ? "font-semibold text-sky-ink" : "text-muted"}`}>
                {view === "week" ? d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }) : d.getDate()}
              </span>
              {dayPosts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-label={`${p.title}, ${POST_STATUS_LABELS[p.status]}, ${POST_TYPE_LABELS[p.type]}`}
                  className={`min-h-9 truncate rounded-lg border-l-4 px-1.5 py-1 text-left text-xs font-medium ${statusClass[p.status]} ${p.id === selectedId ? "ring-2 ring-sky" : ""}`}
                >
                  {view === "week" ? p.title : POST_TYPE_LABELS[p.type]}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
