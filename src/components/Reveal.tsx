"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Eases its content up into view the first time it scrolls onto the screen.
 * Content is visible by default (before the page's code loads, and for anything
 * already on screen), so nothing can get stuck hidden.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"shown" | "waiting" | "revealed">("shown");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setState("revealed");
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    // Hide it only once we know we can reveal it again.
    requestAnimationFrame(() => setState((s) => (s === "shown" ? "waiting" : s)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,translate] duration-700 ease-out ${
        state === "waiting" ? "translate-y-6 opacity-0" : "translate-y-0 opacity-100"
      } ${className}`}
      style={{ transitionDelay: state === "revealed" ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
