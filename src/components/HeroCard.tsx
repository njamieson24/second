import { NumberBadge } from "./NumberBadge";

/** Dark card for the main plan: "This week's game plan" or "Your launch plan". */
export function HeroCard({
  eyebrow,
  meta,
  heading,
  gap = "md",
  children,
  tourId,
}: {
  eyebrow: string;
  meta?: string;
  heading: string;
  gap?: "sm" | "md";
  children: React.ReactNode;
  /** Marks this card for "Take a tour" (see src/lib/tour.ts) */
  tourId?: string;
}) {
  return (
    <section
      data-tour={tourId}
      className={`on-dark flex flex-col rounded-card bg-panel p-5 ring-1 ring-ink-line text-on-panel desk:p-7 ${gap === "sm" ? "gap-3.5" : "gap-4"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-panel-accent">{eyebrow}</span>
        {meta && <span className="text-[13px] text-muted-dark">{meta}</span>}
      </div>
      <h2 className="m-0 text-[26px] leading-tight font-semibold tracking-[-0.5px]">{heading}</h2>
      {children}
    </section>
  );
}

/** A numbered row inside a HeroCard. The action drops under the text on phones. */
export function HeroRow({
  n,
  badgeTone = "sky-light",
  title,
  detail,
  action,
}: {
  n: number;
  badgeTone?: "sky-light" | "mint";
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-row bg-ink-2 px-4 py-3.5">
      <NumberBadge n={n} tone={badgeTone} />
      <div className="min-w-0 flex-1 basis-48">
        <div className="text-base font-medium">{title}</div>
        <div className="text-sm text-muted-dark">{detail}</div>
      </div>
      <div className="shrink-0 max-desk:ml-[52px]">{action}</div>
    </div>
  );
}
