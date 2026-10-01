import Link from "next/link";
import { Check } from "lucide-react";
import type { StageStatus } from "@/lib/roadmap";

type Stage = { label: string; status: StageStatus; href?: string };

/** Circles joined by a line: done = mint check, current = sky ring, upcoming = gray outline. */
export function RoadmapStepper({ stages }: { stages: Stage[] }) {
  const doneCount = stages.filter((s) => s.status === "done").length;
  const progress = stages.length > 1 ? doneCount / (stages.length - 1) : 0;

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="relative flex min-w-[630px] justify-between pt-1.5 pb-1">
        <span aria-hidden="true" className="absolute top-[23px] right-[45px] left-[45px] h-[3px] bg-ink-track" />
        <span
          aria-hidden="true"
          className="absolute top-[23px] left-[45px] h-[3px] bg-mint"
          style={{ width: `calc((100% - 90px) * ${progress})` }}
        />
        <ol className="contents">
          {stages.map((stage) => {
            const body = (
              <>
                {stage.status === "done" && (
                  <span className="flex size-[34px] items-center justify-center rounded-full bg-mint">
                    <Check size={18} strokeWidth={3} className="text-mint-ink" aria-hidden="true" />
                  </span>
                )}
                {stage.status === "current" && (
                  <span className="flex size-[34px] items-center justify-center rounded-full border-[3px] border-sky-light bg-ink-2">
                    <span className="size-3 rounded-full bg-sky-light" />
                  </span>
                )}
                {stage.status === "upcoming" && (
                  <span className="size-[34px] rounded-full border-2 border-ink-ring bg-panel" />
                )}
                <span
                  className={`text-[13px] leading-[1.25] ${
                    stage.status === "upcoming"
                      ? "text-ink-faint"
                      : stage.status === "current"
                        ? "font-semibold text-on-panel"
                        : "text-on-panel"
                  }`}
                >
                  {stage.label}
                  <span className="sr-only">
                    {stage.status === "done" ? ", done" : stage.status === "current" ? ", you are here" : ""}
                  </span>
                </span>
              </>
            );
            const itemClass = "relative z-10 flex w-[90px] flex-col items-center gap-2 text-center";
            return (
              <li key={stage.label} className="list-none" aria-current={stage.status === "current" ? "step" : undefined}>
                {stage.href ? (
                  <Link href={stage.href} className={`${itemClass} rounded-xl no-underline`}>
                    {body}
                  </Link>
                ) : (
                  <div className={itemClass}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
