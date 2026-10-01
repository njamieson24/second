"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { usePrefersReducedMotion } from "@/lib/motion";
import { SecondAvatar } from "./ChatBubble";

// The home page preview, acted out: Second drafted 3 things, they get approved
// one by one, then Second replies. Loops. Decorative only (aria-hidden).

const tasks = [
  { title: "Email 12 gyms about a chair massage day", detail: "Each email is written for you", action: "Review", done: "Sent" },
  { title: "Post 3 Instagram updates", detail: "Captions are ready", action: "See posts", done: "Posted" },
  { title: "Check in with 2 regulars", detail: "It's been 60 days", action: "Send", done: "Sent" },
];

// Each beat of the scene and how long it lasts (ms).
type Beat = { approved: number; pressing: number | null; typing: boolean; replied: boolean; ms: number };
const beats: Beat[] = [
  { approved: 0, pressing: null, typing: false, replied: false, ms: 1800 },
  { approved: 0, pressing: 0, typing: false, replied: false, ms: 320 },
  { approved: 1, pressing: null, typing: false, replied: false, ms: 900 },
  { approved: 1, pressing: 1, typing: false, replied: false, ms: 320 },
  { approved: 2, pressing: null, typing: false, replied: false, ms: 900 },
  { approved: 2, pressing: 2, typing: false, replied: false, ms: 320 },
  { approved: 3, pressing: null, typing: false, replied: false, ms: 800 },
  { approved: 3, pressing: null, typing: true, replied: false, ms: 1400 },
  { approved: 3, pressing: null, typing: false, replied: true, ms: 3600 },
];
const FINAL = beats.length - 1;

export function HomeDemo() {
  const [beat, setBeat] = useState(0);
  // People who ask for less motion see the finished scene, not a loop.
  const still = usePrefersReducedMotion();

  useEffect(() => {
    if (still) return;
    const timer = setTimeout(() => setBeat((b) => (b + 1) % beats.length), beats[beat].ms);
    return () => clearTimeout(timer);
  }, [beat, still]);

  const now = still ? beats[FINAL] : beats[beat];

  return (
    <div className="relative">
      <p className="sr-only">
        A preview of Second: it drafted three tasks for the week. Each one gets approved, and Second replies that
        they are all done.
      </p>

      {/* Soft, slowly drifting glow behind the card */}
      <div aria-hidden="true" className="pointer-events-none absolute -inset-10">
        <div className="absolute inset-0 animate-drift rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-mint)_35%,transparent),transparent)] blur-2xl motion-reduce:animate-none" />
        <div className="absolute inset-0 translate-x-1/4 animate-drift rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--color-sky)_28%,transparent),transparent)] blur-2xl [animation-delay:-9s] motion-reduce:animate-none" />
      </div>

      <div aria-hidden="true" className="relative flex flex-col gap-4">
        <div className="on-dark flex flex-col gap-3 rounded-card bg-panel p-5 text-on-panel shadow-xl ring-1 ring-ink-line">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-panel-accent">This week&apos;s game plan</span>
            <span className="text-[13px] text-muted-dark tabular-nums">
              {now.approved === 3 ? "All approved" : `${now.approved} of 3 approved`}
            </span>
          </div>
          <div className="text-[22px] leading-tight font-semibold tracking-[-0.4px]">
            {now.approved === 3 ? "Done. That was easy." : "I set up 3 moves for you"}
          </div>

          {tasks.map((task, i) => {
            const done = i < now.approved;
            const pressing = now.pressing === i;
            return (
              <div
                key={task.title}
                className={`flex items-center gap-4 rounded-row bg-ink-2 px-4 py-3.5 transition-colors ${
                  done && !still ? "animate-row-done" : ""
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full font-semibold transition-colors duration-300 ${
                    done ? "bg-mint text-mint-ink" : i === 0 ? "bg-mint text-mint-ink" : "bg-sky-light text-sky-deep"
                  }`}
                >
                  {done ? (
                    <Check key="check" size={18} strokeWidth={3} className="animate-pop-in motion-reduce:animate-none" />
                  ) : (
                    i + 1
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className={`text-base font-medium transition-opacity ${done ? "opacity-70" : ""}`}>{task.title}</div>
                  <div className="text-sm text-muted-dark">{done ? "Done" : task.detail}</div>
                </div>
                {done ? (
                  <span
                    key="done"
                    className="inline-flex min-h-10 animate-pop-in items-center gap-1.5 rounded-full bg-mint-tint px-3.5 text-sm font-semibold text-mint-deep motion-reduce:animate-none"
                  >
                    <Check size={15} strokeWidth={3} />
                    {task.done}
                  </span>
                ) : (
                  <span
                    className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-transform duration-150 ${
                      i === 0 ? "bg-mint text-mint-ink" : "border-[1.5px] border-ink-edge text-on-panel"
                    } ${pressing ? "scale-90 ring-4 ring-sky-light/40" : ""}`}
                  >
                    {task.action}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex min-h-[84px] max-w-[440px] items-start gap-3 self-end desk:-mr-6">
          <SecondAvatar />
          <div className="rounded-[6px_18px_18px_18px] border border-line bg-card px-4 py-3 text-base leading-normal shadow-sm">
            {now.typing ? (
              <span className="flex h-6 items-center gap-1.5 px-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-2 animate-typing rounded-full bg-muted"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            ) : now.replied ? (
              <span key="reply" className="block animate-fade-up motion-reduce:animate-none">
                All done! That&apos;s about 2 hours back in your pocket this week.
              </span>
            ) : (
              <span key="hello" className="block animate-fade-up motion-reduce:animate-none">
                Morning! I drafted 3 things for you this week. Want to take a look?
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
