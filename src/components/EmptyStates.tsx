import { Sparkles } from "lucide-react";
import { Button } from "./Button";
import { Chip } from "./Chip";

/**
 * A section whose feature isn't built yet (it needs Second's AI).
 * One clean card: what Second will do here, and a "Coming soon" tag.
 */
export function ComingSoon({
  title,
  text,
  headingLevel = "h2",
  className = "",
}: {
  title: string;
  text: string;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const Heading = headingLevel;
  return (
    <section className={`flex flex-col items-start gap-3 rounded-card border border-dashed border-line-strong bg-card p-[22px] ${className}`}>
      <div className="flex w-full items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-sky-tint text-sky" aria-hidden="true">
          <Sparkles size={20} />
        </span>
        <Chip tone="neutral">Coming soon</Chip>
      </div>
      <Heading className="m-0 text-[17px] font-semibold">{title}</Heading>
      <p className="m-0 text-[15px] leading-normal text-muted">{text}</p>
    </section>
  );
}

/** Nothing here yet: one short sentence and a button to add the first item. */
export function EmptyState({
  text,
  action,
  className = "",
}: {
  text: string;
  /** The button, usually from <Button> */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-start gap-3 rounded-row bg-paper px-4 py-4 ${className}`}>
      <p className="m-0 text-[15px] leading-normal text-muted">{text}</p>
      {action}
    </div>
  );
}

/** A calm note laid over an empty chart, so it looks intentional, not broken. */
export function ChartEmptyNote({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <p className="m-0 max-w-[300px] rounded-row bg-card/90 px-4 py-3 text-center text-[15px] leading-normal text-muted shadow-sm">
        {text}
      </p>
    </div>
  );
}

/** Marks sample content (demo and demo data only). */
export function SampleTag() {
  return (
    <Chip tone="sky" size="sm">
      Sample
    </Chip>
  );
}

/** Shown on every page while someone is trying the demo. */
export function DemoBanner() {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-line bg-sky-tint px-4 py-2.5 text-center text-[15px] text-sky-ink"
    >
      <span>This is a demo. Sign up to start your own.</span>
      <Button href="/signup" size="sm">
        Sign up
      </Button>
    </div>
  );
}
