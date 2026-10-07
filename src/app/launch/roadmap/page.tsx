"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CalendarPlus, Check, ExternalLink, Link2, PartyPopper } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { TextLink } from "@/components/TextLink";
import { TipCard } from "@/components/TipCard";
import { inputClass } from "@/components/Field";
import { useLoadedData, useRoadmap } from "@/lib/data";
import { dayLabel, todayISO } from "@/lib/dates";
import type { RoadmapProgress, RoadmapTask } from "@/lib/roadmap";
import { addEvent, completeTask, uncompleteTask, updateEvent, type CalendarEvent } from "@/lib/store";

export default function RoadmapPage() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <Roadmap />
    </Suspense>
  );
}

function Roadmap() {
  const roadmap = useRoadmap();
  const { events } = useLoadedData();
  // A task put on the calendar has an all-day deadline linked to it.
  const taskEvent = (taskId: string) => events.find((e) => e.roadmapTaskId === taskId);
  const params = useSearchParams();
  const router = useRouter();

  const requested = roadmap.stages.findIndex((s) => s.id === params.get("stage"));
  const stageIndex = requested >= 0 ? requested : roadmap.currentIndex;
  const stage = roadmap.stages[stageIndex];
  const doneHere = stage.tasks.filter((t) => roadmap.isDone(t.id)).length;
  const firstOpen = stage.tasks.find((t) => !roadmap.isDone(t.id));

  // Which task is expanded. Defaults to the one asked for, or the next one to do.
  const [openState, setOpen] = useState<{ stage: string; task: string | null } | null>(null);
  const openTask =
    openState?.stage === stage.id ? openState.task : (params.get("task") ?? firstOpen?.id ?? null);

  async function toggle(task: RoadmapTask) {
    if (roadmap.isDone(task.id)) {
      await uncompleteTask(task.id);
      return;
    }
    await completeTask(task.id);
    if (roadmap.doneCount + 1 === roadmap.total) {
      router.push("/launched");
      return;
    }
    const nextInStage = stage.tasks.find((t) => t.id !== task.id && !roadmap.isDone(t.id));
    setOpen({ stage: stage.id, task: nextInStage?.id ?? null });
  }

  const places = stage.tasks.filter((t) => t.link);

  return (
    <PageBody>
      <PageHeader
        size="lg"
        align="end"
        eyebrow={
          <>
            <TextLink href="/launch" className="font-normal">
              Launch plan
            </TextLink>{" "}
            / Step {stageIndex + 1} of {roadmap.stages.length}
          </>
        }
        title={stage.label}
        subtitle={stage.intro}
        actions={
          <Chip tone={doneHere === stage.tasks.length ? "mint" : "sky"}>
            {doneHere} of {stage.tasks.length} done
          </Chip>
        }
      />

      <StageTabs roadmap={roadmap} activeIndex={stageIndex} />

      <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {stage.tasks.map((task, i) => (
            <TaskCard
              key={task.id}
              n={i + 1}
              task={task}
              done={roadmap.isDone(task.id)}
              upNext={task.id === firstOpen?.id}
              open={openTask === task.id}
              onOpen={(open) => setOpen({ stage: stage.id, task: open ? task.id : null })}
              onToggle={() => toggle(task)}
              calendarEvent={taskEvent(task.id)}
            />
          ))}
        </ol>

        <div className="flex flex-col gap-5">
          <section className="on-dark rounded-card bg-panel p-[22px] text-on-panel ring-1 ring-ink-line">
            <h2 className="m-0 text-sm font-semibold text-panel-accent">Why this step matters</h2>
            <p className="mt-2 mb-0 text-[15px] leading-[1.55] text-on-dark">{stage.why}</p>
          </section>

          {places.length > 0 && (
            <Card title="Official places you'll use">
              <ul className="m-0 list-none p-0">
                {places.map((t, i) => (
                  <li key={t.id} className={i === places.length - 1 ? "" : "border-b border-line-soft"}>
                    <a
                      href={t.link!.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-2.5 py-1.5 text-[15px] text-ink no-underline hover:text-sky-ink hover:underline"
                    >
                      <Link2 size={18} className="shrink-0 text-sky" aria-hidden="true" />
                      {t.link!.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-3.5 mb-0 text-[13px] leading-[1.45] text-muted">
                Second explains and prepares. You stay in control, and nothing gets filed without you.
              </p>
            </Card>
          )}

          <Card title="Already open for business?">
            <p className="mt-1.5 mb-3 text-[15px] text-muted">
              You can move to Running mode any time. Everything you built comes with you.
            </p>
            <Button href="/launched" variant="ghost" weight="medium" icon={<PartyPopper size={18} aria-hidden="true" />}>
              I&apos;m open!
            </Button>
          </Card>

          <TipCard title="Stuck on something?">
            <p className="mt-1.5 mb-3 text-[15px] text-mint-heading">Ask in your own words. No question is too basic.</p>
            <Button href="/chat" variant="green">
              Ask Second
            </Button>
          </TipCard>
        </div>
      </div>
    </PageBody>
  );
}

function StageTabs({ roadmap, activeIndex }: { roadmap: RoadmapProgress; activeIndex: number }) {
  return (
    <nav aria-label="Launch stages" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="m-0 flex list-none gap-2 p-0">
        {roadmap.stages.map((stage, i) => {
          const active = i === activeIndex;
          const status = roadmap.statuses[i];
          return (
            <li key={stage.id} className="shrink-0">
              <Link
                href={`/launch/roadmap?stage=${stage.id}`}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] whitespace-nowrap no-underline ${
                  active ? "bg-ink text-paper" : "border border-line bg-card text-ink hover:border-ink"
                }`}
              >
                {status === "done" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-mint">
                    <Check size={13} strokeWidth={3} className="text-mint-ink" aria-hidden="true" />
                  </span>
                ) : (
                  <span
                    className={`flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                      active ? "bg-paper text-ink" : "bg-line-soft text-slate"
                    }`}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </span>
                )}
                {stage.label}
                {status === "done" && <span className="sr-only">, done</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function TaskCard({
  n,
  task,
  done,
  upNext,
  open,
  onOpen,
  onToggle,
  calendarEvent,
}: {
  n: number;
  task: RoadmapTask;
  done: boolean;
  upNext: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  onToggle: () => void;
  calendarEvent?: CalendarEvent;
}) {
  const panelId = `task-${task.id}`;
  return (
    <li id={task.id} className="flex scroll-mt-6 flex-col gap-4 rounded-card border border-line bg-card p-[22px]">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          aria-label={done ? `Mark not done: ${task.title}` : `Mark done: ${task.title}`}
          className={`flex size-11 shrink-0 items-center justify-center rounded-full font-semibold transition-colors ${
            done ? "bg-mint text-mint-ink" : "border-2 border-sky-tint bg-sky-tint text-sky-ink hover:border-sky"
          }`}
        >
          {done ? <Check size={22} strokeWidth={3} aria-hidden="true" /> : n}
        </button>
        <div className="min-w-0 flex-1">
          <h2 className={`m-0 text-lg font-semibold ${done ? "text-muted line-through decoration-1" : ""}`}>{task.title}</h2>
          <div className="text-sm text-muted">
            {task.detail} About {task.minutes} {task.minutes === 1 ? "minute" : "minutes"}.
          </div>
        </div>
        <div className="shrink-0">
          {done ? <Chip tone="mint">Done</Chip> : upNext ? <Chip tone="sky">Up next</Chip> : <Chip tone="neutral">Not started</Chip>}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpen(!open)}
        className="-my-1 min-h-11 self-start rounded-lg px-1 text-[15px] font-medium text-sky-ink hover:underline"
      >
        {open ? "Hide details" : "Show me how"}
      </button>

      {open && (
        <div id={panelId} className="flex flex-col gap-4">
          <p className="m-0 text-[15px] leading-normal text-ink-soft">{task.explainer}</p>

          {task.choices && (
            <div className="grid grid-cols-1 gap-3.5 desk:grid-cols-2">
              {task.choices.map((choice, i) => (
                <div
                  key={choice.name}
                  className={`rounded-[18px] p-[18px] ${i === 0 ? "border-2 border-sky" : "border border-line"}`}
                >
                  <h3 className="m-0 text-[17px] font-semibold">{choice.name}</h3>
                  <p className="mt-2 mb-0 text-[15px] leading-normal text-ink-soft">{choice.text}</p>
                  {choice.note && (
                    <div className="mt-2.5">
                      <Chip tone="sky">{choice.note}</Chip>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {task.secondsTake && (
            <div className="rounded-row bg-paper px-4 py-3.5 text-[15px] leading-normal text-ink-soft">
              <b className="font-semibold text-ink">Second&apos;s take:</b> {task.secondsTake}
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <Button variant={done ? "ghost" : "primary"} weight={done ? "medium" : "semibold"} onClick={onToggle}>
              {done ? "Mark as not done" : "Mark as done"}
            </Button>
            {task.action && (
              <Button href={task.action.href} variant="ghost" weight="medium">
                {task.action.label}
              </Button>
            )}
            {task.link && (
              <a
                href={task.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-ink px-5 text-[15px] font-medium text-ink no-underline hover:bg-ink hover:text-paper"
              >
                {task.link.label}
                <ExternalLink size={16} aria-hidden="true" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            <Button href="/chat" variant="ghost" weight="medium">
              Help me with this
            </Button>
          </div>

          {!done && <PutOnCalendar task={task} existing={calendarEvent} />}
        </div>
      )}
    </li>
  );
}

/** "Put it on my calendar": an all-day deadline for this task, linked back to it. */
function PutOnCalendar({ task, existing }: { task: RoadmapTask; existing?: CalendarEvent }) {
  const [picking, setPicking] = useState(false);
  const [day, setDay] = useState(existing?.start ?? todayISO());
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!day) return;
    setSaving(true);
    if (existing) await updateEvent(existing.id, { start: day, end: day });
    else {
      await addEvent({
        title: task.title,
        type: "deadline",
        allDay: true,
        start: day,
        end: day,
        source: "roadmap",
        roadmapTaskId: task.id,
      });
    }
    setSaving(false);
    setPicking(false);
  }

  if (!picking) {
    return existing ? (
      <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted">
        <CalendarPlus size={18} className="text-sky" aria-hidden="true" />
        On your calendar for {dayLabel(existing.start, true)}.
        <button type="button" onClick={() => setPicking(true)} className="min-h-11 font-medium text-sky-ink hover:underline">
          Change date
        </button>
        <TextLink href={`/calendar?date=${existing.start}`}>See calendar</TextLink>
      </p>
    ) : (
      <div>
        <Button variant="soft" weight="medium" icon={<CalendarPlus size={18} aria-hidden="true" />} onClick={() => setPicking(true)}>
          Put it on my calendar
        </Button>
      </div>
    );
  }

  const id = `due-${task.id}`;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-row bg-paper p-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-[15px] font-medium">
          When do you want this done?
        </label>
        <input id={id} type="date" value={day} onChange={(e) => setDay(e.target.value)} className={`${inputClass} w-auto`} />
      </div>
      <Button onClick={save}>{saving ? "Saving…" : "Save"}</Button>
      <Button variant="ghost" weight="medium" onClick={() => setPicking(false)}>
        Cancel
      </Button>
    </div>
  );
}
