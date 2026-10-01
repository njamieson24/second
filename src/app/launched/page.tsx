"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/Button";
import { LogoMark } from "@/components/Logo";
import { useAppData } from "@/lib/data";
import { launchDay } from "@/lib/mock-data";
import { graduate } from "@/lib/store";

// Decorative confetti dots: [left %, top px, size px, color]
const confetti: [number, number, number, string][] = [
  [12, 60, 14, "bg-mint"],
  [22, 150, 10, "bg-sky-light"],
  [80, 70, 16, "bg-mint"],
  [88, 170, 10, "bg-sky-light"],
  [30, 40, 8, "bg-on-panel"],
  [70, 130, 12, "bg-sun"],
  [8, 210, 9, "bg-sun"],
  [92, 260, 12, "bg-mint"],
  [60, 30, 9, "bg-sky-light"],
  [40, 190, 7, "bg-mint"],
];

export default function LaunchedPage() {
  const data = useAppData();
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const name = data?.business?.ownerName;

  async function goToDashboard() {
    setMoving(true);
    await graduate();
    document.documentElement.dataset.mode = "running";
    router.push(data?.business ? "/app" : "/start");
  }

  return (
    <div className="on-dark relative flex min-h-screen flex-col items-center overflow-hidden bg-panel px-4 py-14 text-on-panel desk:px-6">
      {confetti.map(([left, top, size, color], i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`absolute rounded-full ${color}`}
          style={{ left: `${left}%`, top, width: size, height: size }}
        />
      ))}

      <div className="relative">
        <LogoMark tone="dark" width={120} />
      </div>
      <h1 className="relative mt-7 mb-0 text-center text-[40px] leading-tight font-bold tracking-[-1.2px] desk:text-[56px] desk:tracking-[-1.8px]">
        You&apos;re open for business!
      </h1>
      <p className="relative mt-3 mb-0 text-center text-[19px] text-on-dark">
        Congrats{name ? `, ${name}` : ""}. Second is switching you from Launch mode to Running mode.
      </p>

      <div className="relative mt-11 grid w-full max-w-[980px] grid-cols-1 gap-6 desk:grid-cols-2">
        <section className="rounded-card bg-ink-2 p-[26px]">
          <h2 className="m-0 text-sm font-semibold text-panel-accent">Moving over with you</h2>
          <CheckList items={launchDay.movingOver} checkClass="text-panel-accent" />
        </section>
        <section className="rounded-card bg-paper p-[26px] text-ink dark:bg-card">
          <h2 className="m-0 text-sm font-semibold text-sky">New in Running mode</h2>
          <CheckList items={launchDay.newInRunning} checkClass="text-sky" />
        </section>
      </div>

      <div className="relative mt-9 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={goToDashboard}
          disabled={moving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-mint px-5 text-[15px] font-semibold text-mint-ink hover:brightness-95"
        >
          {moving ? "Moving you over…" : "Take me to my dashboard"}
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <Button href="/launch" variant="ghost-dark">
          Stay in Launch mode a bit longer
        </Button>
      </div>
    </div>
  );
}

function CheckList({ items, checkClass }: { items: string[]; checkClass: string }) {
  return (
    <ul className="mt-2 mb-0 list-none p-0">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-3 py-2.5 text-base">
          <Check size={18} strokeWidth={2.6} aria-hidden="true" className={`shrink-0 ${checkClass}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}
