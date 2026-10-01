"use client";

import Link from "next/link";
import { Check, Sprout, Store } from "lucide-react";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useMode } from "@/lib/mode";

const choices = [
  {
    mode: "launch",
    title: "I'm just getting started",
    text: "I have an idea or I'm about to open. Help me set everything up the right way.",
    points: [
      "A step-by-step launch roadmap",
      "What to charge and how much to save",
      "Name, logo, and website",
      "Getting ready for your first clients",
    ],
    action: "Start my launch plan",
    href: "/start/setup",
  },
  {
    mode: "running",
    title: "My business is up and running",
    text: "I already have clients. Help me run things and grow.",
    points: ["A weekly game plan", "Finding new clients for you", "Tracking your money", "Social posts written for you"],
    action: "Set up my business",
    href: "/start/setup",
  },
] as const;

export default function StartPage() {
  const { setMode } = useMode();

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-4 py-10 desk:px-6 desk:py-12">
      <Link href="/" className="rounded-lg no-underline" aria-label="Second, home">
        <Logo size="lg" />
      </Link>
      <h1 className="mt-10 mb-0 text-center text-[34px] leading-tight font-semibold tracking-[-1px] desk:mt-14 desk:text-[44px] desk:tracking-[-1.2px]">
        Where are you in your business journey?
      </h1>
      <p className="mt-3 mb-0 text-center text-lg text-muted">
        Second works differently depending on where you are. Pick one to start.
      </p>

      <div className="mt-11 grid w-full max-w-[1040px] grid-cols-1 gap-6 desk:grid-cols-2">
        {choices.map((c) => {
          const dark = c.mode === "launch";
          const Icon = dark ? Sprout : Store;
          return (
            <section
              key={c.mode}
              className={`flex flex-col gap-[18px] rounded-hero p-7 desk:p-[34px] ${
                dark ? "on-dark border-2 border-mint bg-panel text-on-panel" : "border border-line bg-card text-ink"
              }`}
            >
              <div
                className={`flex size-[60px] items-center justify-center rounded-[18px] ${dark ? "bg-ink-line" : "bg-sky-tint"}`}
              >
                <Icon size={30} aria-hidden="true" className={dark ? "text-panel-accent" : "text-sky"} />
              </div>
              <div>
                <h2 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px] desk:text-[30px]">
                  {c.title}
                </h2>
                <p className={`mt-2 mb-0 text-[17px] leading-normal ${dark ? "text-on-dark" : "text-muted"}`}>{c.text}</p>
              </div>
              <ul className={`m-0 flex list-none flex-col gap-3 border-t py-[18px] pl-0 ${dark ? "border-ink-track" : "border-line"}`}>
                {c.points.map((p) => (
                  <li key={p} className="flex items-center gap-3 text-base">
                    <Check size={18} strokeWidth={2.6} aria-hidden="true" className={dark ? "text-panel-accent" : "text-sky"} />
                    {p}
                  </li>
                ))}
              </ul>
              <div>
                <Button href={c.href} variant={dark ? "mint" : "primary"} arrow onClick={() => setMode(c.mode)}>
                  {c.action}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-8 mb-0 text-center text-[15px] text-muted">
        You can switch anytime. When you launch, Second moves everything you built into Running mode.
      </p>

      <ThemeToggle tone="page" className="mt-8 w-[260px] max-w-full" />
    </div>
  );
}
