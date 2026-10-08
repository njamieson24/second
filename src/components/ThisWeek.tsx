"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { Button } from "./Button";
import { SampleTag } from "./EmptyStates";
import { NumberBadge } from "./NumberBadge";
import { useLoadedData } from "@/lib/data";
import { makeActionDraft, getWeekPlan, redoWeekPlan, saveActionDraft, setActionStatus } from "@/lib/store";
import { ACTION_LABELS, type ActionStatus, type PlanAction, type WeekPlan } from "@/lib/week";

/**
 * "This Week": 3 actions picked for this week, with Done, Skip and "Do it with Second".
 * Loads on its own: the rest of Home never waits for it.
 */
export function ThisWeek() {
  const { business } = useLoadedData();
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [sample, setSample] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [redoing, setRedoing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    getWeekPlan().then((r) => {
      if (!live) return;
      if (r.ok) {
        setPlan(r.plan);
        setSample(r.sample);
        setProblem(null);
      } else setProblem(r.message);
    });
    return () => {
      live = false;
    };
  }, [attempt]);

  async function redo() {
    setRedoing(true);
    setProblem(null);
    const r = await redoWeekPlan();
    setRedoing(false);
    if (r.ok) setPlan(r.plan);
    else setProblem(r.message);
  }

  const update = (id: string, change: Partial<PlanAction>) =>
    setPlan((p) => (p ? { ...p, actions: p.actions.map((a) => (a.id === id ? { ...a, ...change } : a)) } : p));

  const loading = !plan && !problem;
  const weekOf = plan
    ? new Date(`${plan.weekStart}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <section
      aria-labelledby="this-week-title"
      aria-busy={loading || redoing}
      className="on-dark flex flex-col gap-4 rounded-card bg-panel p-5 text-on-panel ring-1 ring-ink-line desk:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-panel-accent">
          This Week {sample && <SampleTag />}
        </span>
        {weekOf && <span className="text-[13px] text-muted-dark">Week of {weekOf}</span>}
      </div>
      <h2 id="this-week-title" className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.5px]">
        Here&apos;s your week, {business.ownerName}.
      </h2>

      {(loading || redoing) && (
        <div className="flex flex-col gap-3" role="status">
          <p className="m-0 flex items-center gap-2 text-[15px] text-on-dark">
            <Sparkles size={16} aria-hidden="true" className="text-panel-accent" />
            {redoing ? "Second is making a new plan…" : "Second is planning your week…"}
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-row bg-ink-2 motion-reduce:animate-none" aria-hidden="true" />
          ))}
        </div>
      )}

      {problem && !redoing && (
        <div className="flex flex-col items-start gap-3 rounded-row bg-ink-2 px-4 py-3.5" role="alert">
          <p className="m-0 text-[15px]">{problem}</p>
          {!plan && (
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          )}
        </div>
      )}

      {plan && !redoing && (
        <>
          <ol className="m-0 flex list-none flex-col gap-3 p-0">
            {plan.actions.map((a, i) => (
              <ActionRow key={a.id} n={i + 1} action={a} onChange={(c) => update(a.id, c)} />
            ))}
          </ol>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-dark">Done and Skip help Second plan next week.</span>
            {plan.redosLeft > 0 ? (
              <Button
                size="sm"
                variant="ghost-dark"
                weight="medium"
                icon={<RotateCcw size={15} aria-hidden="true" />}
                onClick={redo}
              >
                Redo this week&apos;s plan ({plan.redosLeft} left)
              </Button>
            ) : (
              <span className="text-sm text-muted-dark">You&apos;ve used this week&apos;s redos.</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function ActionRow({ n, action, onChange }: { n: number; action: PlanAction; onChange: (c: Partial<PlanAction>) => void }) {
  const [busy, setBusy] = useState<"draft" | "status" | "save" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [text, setText] = useState(action.draft ?? "");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const decided = action.status !== "open";

  async function setStatus(status: ActionStatus) {
    setBusy("status");
    if (await setActionStatus(action.id, status)) onChange({ status });
    else setProblem("We couldn't save that. Please try again.");
    setBusy(null);
  }

  async function draft() {
    setBusy("draft");
    setProblem(null);
    const r = await makeActionDraft(action.id);
    setBusy(null);
    if (r.ok) {
      setText(r.draft);
      onChange({ draft: r.draft });
      setOpen(true);
    } else setProblem(r.message);
  }

  async function save() {
    setBusy("save");
    if (await saveActionDraft(action.id, text)) onChange({ draft: text });
    else setProblem("We couldn't save your changes. Please try again.");
    setBusy(null);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setProblem("Your browser blocked copying. Select the text and copy it yourself.");
    }
  }

  const id = `draft-${action.id}`;
  return (
    <li className={`flex flex-col gap-3 rounded-row bg-ink-2 px-4 py-3.5 ${decided ? "opacity-75" : ""}`}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <NumberBadge n={n} tone={n === 1 ? "mint" : "sky-light"} />
        <div className="min-w-0 flex-1 basis-56">
          <div className="text-[13px] font-semibold text-panel-accent">{ACTION_LABELS[action.type]}</div>
          <div className={`text-base font-medium ${action.status === "done" ? "line-through decoration-1" : ""}`}>{action.title}</div>
          <div className="text-sm text-muted-dark">{action.why}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 desk:ml-[52px]">
        {decided ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-chip bg-mint-tint px-2.5 py-1 text-[13px] font-semibold text-mint-deep">
              {action.status === "done" ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : null}
              {action.status === "done" ? "Done" : "Skipped"}
            </span>
            <Button size="sm" variant="ghost-dark" weight="medium" icon={<Undo2 size={15} aria-hidden="true" />} onClick={() => setStatus("open")} disabled={busy !== null}>
              Undo
            </Button>
          </>
        ) : (
          <>
            {action.draft ? (
              <Button size="sm" variant="mint" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}>
                {open ? "Hide draft" : "See draft"}
              </Button>
            ) : (
              <Button size="sm" variant="mint" icon={<Sparkles size={15} aria-hidden="true" />} onClick={draft} disabled={busy !== null}>
                {busy === "draft" ? "Writing…" : "Do it with Second"}
              </Button>
            )}
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={() => setStatus("done")} disabled={busy !== null}>
              Done
            </Button>
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={() => setStatus("skipped")} disabled={busy !== null}>
              Skip
            </Button>
          </>
        )}
      </div>

      {open && action.draft !== null && !decided && (
        <div className="flex flex-col gap-2 desk:ml-[52px]">
          <label htmlFor={id} className="text-[13px] font-semibold text-on-dark">
            Draft from Second (you can edit it)
          </label>
          <textarea
            id={id}
            value={text}
            rows={Math.min(10, Math.max(4, text.split("\n").length + 1))}
            maxLength={3000}
            onChange={(e) => setText(e.target.value)}
            className="w-full resize-y rounded-row border border-ink-line bg-panel px-3.5 py-3 text-[15px] leading-normal text-on-panel"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="light" icon={copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
            {text !== action.draft && (
              <Button size="sm" variant="ghost-dark" weight="medium" onClick={save} disabled={busy !== null}>
                {busy === "save" ? "Saving…" : "Save changes"}
              </Button>
            )}
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={draft} disabled={busy !== null}>
              {busy === "draft" ? "Writing…" : "Write a new one"}
            </Button>
          </div>
          <p className="m-0 text-[13px] text-muted-dark">Copy it and send it yourself. Second never sends anything.</p>
        </div>
      )}
      {problem && <p className="m-0 text-sm desk:ml-[52px]">{problem}</p>}
    </li>
  );
}
