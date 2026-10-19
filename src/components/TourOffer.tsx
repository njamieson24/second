"use client";

import { useState, useSyncExternalStore } from "react";
import { Compass } from "lucide-react";
import { Button } from "./Button";
import { useTour } from "./Tour";
import type { Mode } from "@/lib/mode";
import { markTourOffered, wasTourOffered } from "@/lib/store";

/** First visit to Home: "New to Second? Take a 1-minute tour." Shown once on this device. */
export function TourOffer({ mode }: { mode: Mode }) {
  const { start } = useTour();
  // Read on this device only (the server can't know), so it never flashes during the first paint.
  const offered = useSyncExternalStore(
    () => () => {},
    () => wasTourOffered(),
    () => true,
  );
  const [hidden, setHidden] = useState(false);
  if (offered || hidden) return null;

  return (
    <section aria-labelledby="tour-offer-title" className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-card border border-line bg-sky-tint px-5 py-4 text-ink">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-sky" aria-hidden="true">
        <Compass size={22} />
      </span>
      <div className="min-w-0 flex-1 basis-60">
        <h2 id="tour-offer-title" className="m-0 text-[17px] font-semibold">
          New to Second? Take a 1-minute tour.
        </h2>
        <p className="m-0 mt-0.5 text-[15px] text-ink-soft">See what&apos;s on each page and how Second helps. You can find it in the menu any time.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setHidden(true);
            start(mode);
          }}
        >
          Start the tour
        </Button>
        <Button
          size="sm"
          variant="soft"
          weight="medium"
          onClick={() => {
            markTourOffered();
            setHidden(true);
          }}
        >
          Maybe later
        </Button>
      </div>
    </section>
  );
}
