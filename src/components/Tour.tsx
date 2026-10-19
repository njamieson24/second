"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { Button } from "./Button";
import type { Mode } from "@/lib/mode";
import { markTourOffered } from "@/lib/store";
import { TOUR_STEPS, type TourStep } from "@/lib/tour";

// "Take a tour": walks through the real pages. Each step opens its page and points at one thing
// on it (see src/lib/tour.ts). The rest of the page is dimmed and can't be clicked until the tour
// ends, so a first-timer can't get lost halfway. Esc ends it; arrow keys go back and forth.

type TourApi = { start: (mode: Mode) => void; active: boolean };
const TourContext = createContext<TourApi>({ start: () => {}, active: false });
export const useTour = () => useContext(TourContext);

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const start = useCallback((mode: Mode) => {
    markTourOffered();
    setSteps(TOUR_STEPS[mode]);
    setIndex(0);
  }, []);
  return (
    <TourContext.Provider value={{ start, active: steps !== null }}>
      {children}
      {/* A fresh overlay for each step (key), so nothing from the last step carries over. */}
      {steps && <TourOverlay key={index} steps={steps} index={index} setIndex={setIndex} onEnd={() => setSteps(null)} />}
    </TourContext.Provider>
  );
}

type Box = { top: number; left: number; width: number; height: number };
const PAD = 8; // space around the highlighted thing
const GAP = 14; // space between it and the card

/** The visible element for a step: its data-tour target (or the page title if it's missing). */
function findTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  const visible = (el: Element | null) => (el instanceof HTMLElement && el.getClientRects().length > 0 ? el : null);
  if (step.target !== "page") {
    const found = visible(document.querySelector(`main [data-tour="${step.target}"]`));
    if (found) return found;
  }
  return visible(document.querySelector("main [data-tour-header]"));
}

function TourOverlay({
  steps,
  index,
  setIndex,
  onEnd,
}: {
  steps: TourStep[];
  index: number;
  setIndex: (i: number) => void;
  onEnd: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const step = steps[index];
  const last = index === steps.length - 1;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [searching, setSearching] = useState(true);
  const [cardSize, setCardSize] = useState({ width: 380, height: 220 });
  const [view, setView] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }));
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Open the step's page, then look for the thing to point at (pages load their data first).
  useEffect(() => {
    if (pathname !== step.path) {
      router.push(step.path);
      return;
    }
    let tries = 0;
    const timer = window.setInterval(() => {
      const el = findTarget(step);
      if (el || !step.target || ++tries > 40) {
        window.clearInterval(timer);
        if (el) {
          const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.6;
          el.scrollIntoView({ block: tall ? "start" : "center", behavior: reduce ? "auto" : "smooth" });
        }
        setTarget(el);
        setSearching(false);
      }
    }, 150);
    return () => window.clearInterval(timer);
  }, [step, pathname, router]);

  // Keep the highlight on the target as the page scrolls or resizes.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setView({ width: window.innerWidth, height: window.innerHeight });
        if (!target) return setBox(null);
        const r = target.getBoundingClientRect();
        setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const settle = window.setTimeout(measure, 450); // after a smooth scroll
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [target]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el) setCardSize({ width: el.offsetWidth, height: el.offsetHeight });
  }, [index, searching, view.width]);

  // Move keyboard focus to the new step's heading, so screen readers read it.
  useEffect(() => {
    if (!searching) headingRef.current?.focus();
  }, [index, searching]);

  const next = useCallback(() => {
    if (last) onEnd();
    else setIndex(index + 1);
  }, [last, onEnd, setIndex, index]);
  const back = useCallback(() => index > 0 && setIndex(index - 1), [index, setIndex]);

  // Esc ends the tour, arrows go back and forth, Tab stays inside the card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEnd();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") back();
      else if (e.key === "Tab" && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]")];
        if (!items.length) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
          e.preventDefault();
          first.focus();
        } else if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, onEnd]);

  // Where the card goes: on phones, along the bottom. On wider screens, below the highlight, or
  // above it, or in the corner if neither fits; with nothing to point at, in the middle.
  const phone = view.width < 900;
  let cardStyle: React.CSSProperties;
  if (phone) cardStyle = { left: 16, right: 16, bottom: 16 };
  else if (!box) cardStyle = { left: Math.max(16, (view.width - cardSize.width) / 2), top: Math.max(16, (view.height - cardSize.height) / 2) };
  else {
    const left = Math.min(Math.max(16, box.left), view.width - cardSize.width - 16);
    if (box.top + box.height + GAP + cardSize.height < view.height - 16) cardStyle = { left, top: box.top + box.height + GAP };
    else if (box.top - GAP - cardSize.height > 16) cardStyle = { left, top: box.top - GAP - cardSize.height };
    else cardStyle = { right: 24, bottom: 24 };
  }

  return (
    <>
      {/* Blocks clicks on the page while the tour runs. */}
      <div className={`fixed inset-0 z-[70] ${box ? "" : "bg-scrim"}`} aria-hidden="true" />
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[70] rounded-card shadow-[0_0_0_9999px_var(--color-scrim)] ring-2 ring-sky motion-safe:transition-all motion-safe:duration-300"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className="fixed z-[71] flex flex-col gap-3 rounded-card border border-line bg-card p-5 text-ink shadow-[0_12px_40px_rgb(0_0_0/0.18)] desk:w-[380px]"
        style={cardStyle}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-sky-ink">
            <Compass size={15} aria-hidden="true" /> Step {index + 1} of {steps.length}
          </span>
          <button
            type="button"
            onClick={onEnd}
            className="-mr-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted hover:bg-line-soft hover:text-ink"
          >
            <X size={15} aria-hidden="true" /> Skip tour
          </button>
        </div>
        <h2 id="tour-title" ref={headingRef} tabIndex={-1} className="m-0 text-[19px] leading-tight font-semibold outline-none">
          {step.title}
        </h2>
        <p id="tour-text" className="m-0 text-[15px] leading-normal text-ink-soft" aria-live="polite">
          {searching && pathname !== step.path ? "Opening the page…" : step.text}
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button size="sm" variant="soft" weight="medium" icon={<ArrowLeft size={15} aria-hidden="true" />} onClick={back} disabled={index === 0}>
            Back
          </Button>
          <Button size="sm" onClick={next}>
            {last ? "Finish" : index === 0 ? "Show me around" : "Next"}
            {!last && <ArrowRight size={15} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </>
  );
}
