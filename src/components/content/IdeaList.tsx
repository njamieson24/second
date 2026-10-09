"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { POST_STATUS_LABELS, POST_TYPE_LABELS, type ContentPost, type ContentWeek } from "@/lib/content";
import { dayLabel } from "@/lib/dates";
import type { ContentTone } from "@/lib/store";

const TONES: { id: ContentTone; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "fun", label: "Fun" },
  { id: "professional", label: "Professional" },
];

const statusTone = (s: ContentPost["status"]) => (s === "posted" || s === "ready" ? "mint" : s === "drafted" ? "sky" : "neutral");

/** "This week's ideas": 5 post ideas, the tone setting, and "New ideas". */
export function IdeaList({
  week,
  loading,
  problem,
  selectedId,
  tone,
  renewing,
  onSelect,
  onTone,
  onNewIdeas,
  onRetry,
}: {
  week: ContentWeek | null;
  loading: boolean;
  problem: string | null;
  selectedId: string | null;
  tone: ContentTone;
  renewing: boolean;
  onSelect: (id: string) => void;
  onTone: (t: ContentTone) => void;
  onNewIdeas: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="ideas-title"
      aria-busy={loading || renewing}
      className="on-dark flex flex-col gap-4 rounded-card bg-panel p-5 text-on-panel ring-1 ring-ink-line desk:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ideas-title" className="m-0 text-[22px] font-semibold tracking-[-0.4px]">
          This week&apos;s ideas
        </h2>
        <div role="radiogroup" aria-label="Caption tone" className="flex gap-1 rounded-xl bg-ink-2 p-1">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={tone === t.id}
              onClick={() => onTone(t.id)}
              className={`min-h-11 rounded-lg px-3 text-sm ${tone === t.id ? "bg-ink-line font-semibold text-on-panel" : "text-on-dark hover:text-on-panel"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {(loading || renewing) && (
        <div className="flex flex-col gap-3" role="status">
          <p className="m-0 flex items-center gap-2 text-[15px] text-on-dark">
            <Sparkles size={16} aria-hidden="true" className="text-panel-accent" />
            {renewing ? "Second is thinking of new ideas…" : "Second is thinking of post ideas…"}
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[64px] animate-pulse rounded-row bg-ink-2 motion-reduce:animate-none" aria-hidden="true" />
          ))}
        </div>
      )}

      {problem && !renewing && (
        <div className="flex flex-col items-start gap-3 rounded-row bg-ink-2 px-4 py-3.5" role="alert">
          <p className="m-0 text-[15px]">{problem}</p>
          {!week && (
            <Button size="sm" variant="ghost-dark" weight="medium" onClick={onRetry}>
              Try again
            </Button>
          )}
        </div>
      )}

      {week && !renewing && (
        <>
          <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 desk:grid-cols-2">
            {week.ideas.map((idea) => {
              const selected = idea.id === selectedId;
              return (
                <li key={idea.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(idea.id)}
                    aria-pressed={selected}
                    className={`flex h-full w-full flex-col items-start gap-1 rounded-row bg-ink-2 px-4 py-3.5 text-left ${selected ? "ring-2 ring-panel-accent" : "hover:ring-1 hover:ring-ink-edge"}`}
                  >
                    <span className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-panel-accent">
                        {idea.source === "this_week" ? "From This Week · " : ""}
                        {POST_TYPE_LABELS[idea.type]} · {dayLabel(idea.day, true).split(",")[0]}
                      </span>
                      <Chip tone={statusTone(idea.status)} size="sm">
                        {POST_STATUS_LABELS[idea.status]}
                      </Chip>
                    </span>
                    <span className="text-base font-medium">{idea.title}</span>
                    <span className="text-sm text-muted-dark">{idea.why}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-muted-dark">Tap an idea to write it and make the image.</span>
            {week.newIdeasLeft > 0 ? (
              <Button size="sm" variant="ghost-dark" weight="medium" icon={<RotateCcw size={15} aria-hidden="true" />} onClick={onNewIdeas}>
                New ideas ({week.newIdeasLeft} left)
              </Button>
            ) : (
              <span className="text-sm text-muted-dark">You&apos;ve used this week&apos;s new ideas.</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
