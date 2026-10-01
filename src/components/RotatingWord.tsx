"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/** Rolls through a list of words, one at a time. Screen readers get the whole list once. */
export function RotatingWord({ words, every = 2200 }: { words: string[]; every?: number }) {
  const [index, setIndex] = useState(0);
  const still = usePrefersReducedMotion();

  useEffect(() => {
    if (still) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), every);
    return () => clearInterval(timer);
  }, [still, words.length, every]);

  return (
    <>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden="true" className="relative inline-flex overflow-hidden align-bottom">
        <span key={index} className="inline-block animate-word-in motion-reduce:animate-none">
          {words[index]}
        </span>
      </span>
    </>
  );
}
