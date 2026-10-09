"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "../Button";
import { BriefCard } from "./BriefCard";
import type { ContentPost, ContentWeek } from "@/lib/content";
import type { ContentTone } from "@/lib/store";

const TONES: { id: ContentTone; label: string }[] = [
  { id: "warm", label: "Warm" },
  { id: "fun", label: "Fun" },
  { id: "professional", label: "Professional" },
];

/** "This week's ideas": 5 creative briefs, the caption tone, and "New ideas". */
export function IdeaList({
  week,
  loading,
  problem,
  highlightId,
  tone,
  renewing,
  onChange,
  onTone,
  onNewIdeas,
  onRetry,
}: {
  week: ContentWeek | null;
  loading: boolean;
  problem: string | null;
  highlightId: string | null;
  tone: ContentTone;
  renewing: boolean;
  onChange: (id: string, changes: Partial<ContentPost>) => void;
  onTone: (t: ContentTone) => void;
  onNewIdeas: () => void;
  onRetry: () => void;
}) {
  return (
    <section
      aria-labelledby="ideas-title"
      aria-busy={loading || renewing}
      className="on-dark flex flex-col gap-4 rounded-card bg-panel p-4 text-on-panel ring-1 ring-ink-line desk:p-7"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ideas-title" className="m-0 text-[22px] font-semibold tracking-[-0.4px]">
          This week&apos;s ideas
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-on-dark" id="tone-label">
            Caption tone
          </span>
          <div role="radiogroup" aria-labelledby="tone-label" className="flex gap-1 rounded-xl bg-ink-2 p-1">
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
      </div>

      {(loading || renewing) && (
        <div className="flex flex-col gap-3" role="status">
          <p className="m-0 flex items-center gap-2 text-[15px] text-on-dark">
            <Sparkles size={16} aria-hidden="true" className="text-panel-accent" />
            {renewing ? "Second is thinking of new ideas…" : "Second is planning this week's posts…"}
          </p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[120px] animate-pulse rounded-row bg-ink-2 motion-reduce:animate-none" aria-hidden="true" />
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
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-2 desk:gap-4">
            {week.ideas.map((idea) => (
              <BriefCard key={idea.id} post={idea} highlighted={idea.id === highlightId} onChange={(c) => onChange(idea.id, c)} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-on-dark">Copy puts the hook, caption and hashtags together, ready to paste.</span>
            {week.newIdeasLeft > 0 ? (
              <Button size="sm" variant="ghost-dark" weight="medium" icon={<RotateCcw size={15} aria-hidden="true" />} onClick={onNewIdeas}>
                New ideas ({week.newIdeasLeft} left)
              </Button>
            ) : (
              <span className="text-sm text-on-dark">You&apos;ve used this week&apos;s new ideas.</span>
            )}
          </div>
        </>
      )}
    </section>
  );
}
