"use client";

import { useEffect, useRef, useState } from "react";
import { Beer, Coffee, Croissant, Dumbbell, Hand, Truck, type LucideIcon } from "lucide-react";

// The "Second network" picture on the home page: six local businesses that start apart,
// then connect and light up, with small pulses moving along the lines.
// The motion lives in globals.css (.network-*). With "reduce motion" on, it shows the
// finished, connected picture and nothing moves.

export type NetworkBusiness = "gym" | "massage" | "cafe" | "bakery" | "brewery" | "truck";

/** Icon and name for each business. The collab cards use these too. */
export const NETWORK_BUSINESSES: Record<NetworkBusiness, { label: string; icon: LucideIcon }> = {
  gym: { label: "Gym", icon: Dumbbell },
  massage: { label: "Massage", icon: Hand },
  cafe: { label: "Café", icon: Coffee },
  bakery: { label: "Bakery", icon: Croissant },
  brewery: { label: "Brewery", icon: Beer },
  truck: { label: "Food truck", icon: Truck },
};

type Tone = "mint" | "sky";

// Positions on a 100 x 75 grid (the picture is 4:3). dx/dy = how far apart they start, in px.
const NODES: { id: NetworkBusiness; x: number; y: number; tone: Tone; dx: number; dy: number }[] = [
  { id: "gym", x: 17, y: 19, tone: "mint", dx: -26, dy: -18 },
  { id: "massage", x: 50, y: 11, tone: "mint", dx: 0, dy: -26 },
  { id: "cafe", x: 83, y: 19, tone: "sky", dx: 26, dy: -18 },
  { id: "bakery", x: 83, y: 53, tone: "sky", dx: 26, dy: 18 },
  { id: "truck", x: 50, y: 61, tone: "mint", dx: 0, dy: 26 },
  { id: "brewery", x: 17, y: 53, tone: "mint", dx: -26, dy: 18 },
];

// The three collabs (bold) plus a few quieter links between neighbors.
const LINKS: { from: NetworkBusiness; to: NetworkBusiness; tone: Tone; strong?: boolean }[] = [
  { from: "gym", to: "massage", tone: "mint", strong: true },
  { from: "cafe", to: "bakery", tone: "sky", strong: true },
  { from: "brewery", to: "truck", tone: "mint", strong: true },
  { from: "massage", to: "cafe", tone: "sky" },
  { from: "truck", to: "bakery", tone: "sky" },
  { from: "gym", to: "brewery", tone: "mint" },
  { from: "massage", to: "truck", tone: "sky" },
];

const at = (id: NetworkBusiness) => NODES.find((n) => n.id === id)!;

const dotTone: Record<Tone, string> = {
  mint: "border-mint-mark bg-mint-tint text-mint-deep network-glow-mint",
  sky: "border-sky bg-sky-tint text-sky-ink network-glow-sky",
};
const lineTone: Record<Tone, string> = { mint: "stroke-mint-mark", sky: "stroke-sky" };

export function NetworkGraphic({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // "shown" = finished picture (before the page's code runs, or with reduce motion on).
  const [state, setState] = useState<"shown" | "waiting" | "playing">("shown");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("playing");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    // Pull it apart only once we know we can put it back together.
    requestAnimationFrame(() => setState((s) => (s === "shown" ? "waiting" : s)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-state={state}
      role="img"
      aria-label="Six local businesses, like a gym and a massage studio, connected by their Seconds."
      className={`network relative aspect-[4/3] w-full overflow-hidden rounded-hero bg-ink-2 ring-1 ring-ink-line ${className}`}
    >
      <svg viewBox="0 0 100 75" className="absolute inset-0 size-full" aria-hidden="true">
        {LINKS.map((link, i) => {
          const a = at(link.from);
          const b = at(link.to);
          const delay = 700 + i * 140;
          return (
            <g key={`${link.from}-${link.to}`}>
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                pathLength={1}
                strokeWidth={link.strong ? 0.7 : 0.4}
                strokeLinecap="round"
                className={`network-line ${lineTone[link.tone]} ${link.strong ? "" : "opacity-50"}`}
                style={{ "--d": `${delay}ms` } as React.CSSProperties}
              />
              {link.strong && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  pathLength={1}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  className={`network-pulse ${lineTone[link.tone]}`}
                  style={{ "--p": `${i * 700}ms` } as React.CSSProperties}
                />
              )}
            </g>
          );
        })}
      </svg>

      {NODES.map((node, i) => {
        const { label, icon: Icon } = NETWORK_BUSINESSES[node.id];
        return (
          <div
            key={node.id}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${node.x}%`, top: `${(node.y / 75) * 100}%` }}
            aria-hidden="true"
          >
            <div
              className="network-node flex flex-col items-center gap-1"
              style={{ "--dx": `${node.dx}px`, "--dy": `${node.dy}px`, "--d": `${i * 60}ms` } as React.CSSProperties}
            >
              <span
                className={`network-dot flex size-11 items-center justify-center rounded-full border-2 sm:size-14 ${dotTone[node.tone]}`}
                style={{ "--lit": `${1500 + i * 120}ms` } as React.CSSProperties}
              >
                <Icon className="size-5 sm:size-6" aria-hidden="true" />
              </span>
              <span className="rounded-md bg-ink-2 px-1.5 text-[13px] font-medium whitespace-nowrap text-on-panel sm:text-sm">
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
