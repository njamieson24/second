"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/Button";
import { Field, inputClass, MoneyInput } from "@/components/Field";
import {
  deleteFromHere,
  EVENT_TYPES,
  localDateTime,
  saveFromHere,
  timeValue,
  type Occurrence,
} from "@/lib/calendar";
import { dayLabel } from "@/lib/dates";
import { addEvent, deviceTimeZone, type EventType } from "@/lib/store";
import { eventStyles } from "./eventStyles";

/** What the dialog is for: a new event (with a starting day/time), or an existing one. */
export type EventTarget =
  | { mode: "new"; day: string; time?: string; allDay?: boolean }
  | { mode: "edit"; occurrence: Occurrence };

export function EventDialog({ target, onClose }: { target: EventTarget | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (target && !d.open) d.showModal();
    if (!target && d.open) d.close();
  }, [target]);

  const key = target ? (target.mode === "new" ? `new:${target.day}:${target.time}` : `edit:${target.occurrence.key}`) : "none";

  return (
    <dialog
      ref={ref}
      aria-labelledby="event-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto rounded-card border border-line bg-card p-0 text-ink backdrop:bg-black/50"
    >
      {target && <EventForm key={key} target={target} onClose={onClose} />}
    </dialog>
  );
}

function addHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function EventForm({ target, onClose }: { target: EventTarget; onClose: () => void }) {
  const editing = target.mode === "edit" ? target.occurrence : null;
  const event = editing?.event;
  const repeating = Boolean(event?.repeatsWeekly);

  const startTime = editing ? (editing.allDay ? "09:00" : timeValue(editing.start)) : (target.mode === "new" && target.time) || "09:00";
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<EventType>(event?.type ?? "appointment");
  const [allDay, setAllDay] = useState(editing ? editing.allDay : target.mode === "new" && Boolean(target.allDay));
  const [day, setDay] = useState(editing ? editing.firstDay : target.mode === "new" ? target.day : "");
  const [start, setStart] = useState(startTime);
  const [end, setEnd] = useState(editing && !editing.allDay ? timeValue(editing.end) : addHour(startTime));
  const [clientName, setClientName] = useState(event?.clientName ?? "");
  const [price, setPrice] = useState(event?.price ?? 0);
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [repeatsWeekly, setRepeatsWeekly] = useState(repeating);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) return setError("Please give it a name, like “Deep tissue, Alex T.”");
    if (!day) return setError("Please pick a day.");
    const startDate = localDateTime(day, start);
    const endDate = localDateTime(day, end);
    if (!allDay && endDate <= startDate) return setError("The end time needs to be after the start time.");

    const fields = {
      title: title.trim(),
      type,
      allDay,
      start: allDay ? day : startDate.toISOString(),
      end: allDay ? day : endDate.toISOString(),
      timeZone: event?.timeZone ?? deviceTimeZone(),
      clientName: type === "appointment" && clientName.trim() ? clientName.trim() : undefined,
      price: type === "appointment" && price > 0 ? price : undefined,
      location: location.trim() || undefined,
      notes: notes.trim() || undefined,
      repeatsWeekly,
    };
    setBusy(true);
    if (editing) await saveFromHere(editing, fields);
    else await addEvent(fields);
    onClose();
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    await deleteFromHere(editing);
    onClose();
  }

  const futureNote = repeating && editing && !editing.isFirst;

  return (
    <form onSubmit={save} className="flex flex-col gap-5 p-6" noValidate>
      <div className="flex items-center justify-between gap-3">
        <h2 id="event-dialog-title" className="m-0 text-[22px] font-semibold">
          {editing ? "Change this event" : "Add to your calendar"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-row border border-line-strong bg-paper px-4 py-3 text-[15px]">
          {error}
        </p>
      )}

      <Field label="What is it?">
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Like “Deep tissue, Alex T.”"
            autoFocus={!editing}
          />
        )}
      </Field>

      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-1.5 p-0 text-[15px] font-medium">Kind</legend>
        <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map((t) => {
            const on = type === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setType(t.id)}
                className={`flex min-h-12 items-center gap-2.5 rounded-row px-3.5 text-left text-[15px] ${
                  on ? `border-2 border-sky ${eventStyles[t.id].fill} font-medium` : "border border-line-strong bg-card hover:border-ink"
                }`}
              >
                <span className={`size-3 shrink-0 rounded-full ${eventStyles[t.id].dot}`} aria-hidden="true" />
                {t.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Day">
          {(id) => <input id={id} type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />}
        </Field>
        <label className="flex min-h-12 items-center gap-3 self-end rounded-row border border-line-strong bg-card px-4 text-[15px]">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="size-5 accent-sky"
          />
          All day
        </label>
      </div>

      {!allDay && (
        <div className="grid grid-cols-2 gap-4">
          <Field label="Starts">
            {(id) => (
              <input
                id={id}
                type="time"
                step={900}
                className={inputClass}
                value={start}
                onChange={(e) => {
                  setStart(e.target.value);
                  if (localDateTime(day || "2000-01-01", end) <= localDateTime(day || "2000-01-01", e.target.value)) {
                    setEnd(addHour(e.target.value));
                  }
                }}
              />
            )}
          </Field>
          <Field label="Ends">
            {(id) => (
              <input id={id} type="time" step={900} className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
            )}
          </Field>
        </div>
      )}

      {type === "appointment" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Client name (optional)">
            {(id) => (
              <input id={id} className={inputClass} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            )}
          </Field>
          <Field label="Price (optional)">
            {(id) => <MoneyInput id={id} value={price} onChange={setPrice} />}
          </Field>
        </div>
      )}

      <Field label="Where (optional)">
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Like “Home studio”"
          />
        )}
      </Field>

      <Field label="Notes (optional)">
        {(id) => (
          <textarea
            id={id}
            rows={3}
            className={`${inputClass} py-3 leading-normal`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </Field>

      <label className="flex min-h-12 items-center gap-3 rounded-row border border-line-strong bg-card px-4 text-[15px]">
        <input
          type="checkbox"
          checked={repeatsWeekly}
          onChange={(e) => setRepeatsWeekly(e.target.checked)}
          className="size-5 accent-sky"
        />
        Repeats every week{day ? ` on ${new Date(localDateTime(day, "12:00")).toLocaleDateString("en-US", { weekday: "long" })}s` : ""}
      </label>

      {futureNote && (
        <p className="m-0 rounded-row bg-sky-tint px-4 py-3 text-[15px] text-sky-ink">
          This repeats every week. Changes apply to {dayLabel(editing.seriesDate)} and every week after. Earlier ones
          stay as they were.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
        {editing &&
          (confirmDelete ? (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-row border border-line-strong bg-paper p-3" role="alert">
              <span className="mr-auto text-[15px] font-medium">
                {futureNote ? "Delete this one and all future ones?" : "Delete this event?"}
              </span>
              <Button size="sm" variant="dark" onClick={remove}>
                {busy ? "Deleting…" : "Yes, delete"}
              </Button>
              <Button size="sm" variant="ghost" weight="medium" onClick={() => setConfirmDelete(false)}>
                Keep it
              </Button>
            </div>
          ) : (
            <Button variant="ghost" weight="medium" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          ))}
        {!confirmDelete && (
          <div className="ml-auto flex gap-3">
            <Button variant="ghost" weight="medium" onClick={onClose}>
              Cancel
            </Button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-sky px-6 text-[15px] font-semibold text-on-sky hover:bg-sky-ink disabled:opacity-70"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
