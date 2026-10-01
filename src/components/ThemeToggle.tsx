"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const options: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "Auto", icon: Monitor },
];

const tones = {
  // On the sidebar panel
  panel: {
    track: "bg-ink-2",
    active: "bg-ink-line font-medium text-on-panel",
    idle: "text-on-dark hover:text-on-panel",
    icon: "text-panel-accent",
  },
  // On the page background (pages without a sidebar)
  page: {
    track: "border border-line bg-card",
    active: "bg-line-soft font-medium text-ink",
    idle: "text-muted hover:text-ink",
    icon: "text-sky",
  },
};

/** Light / Dark / Auto switch. */
export function ThemeToggle({ tone = "panel", className = "" }: { tone?: keyof typeof tones; className?: string }) {
  const { choice, setChoice } = useTheme();
  const t = tones[tone];

  return (
    <div role="group" aria-label="Screen colors" className={`flex gap-1 rounded-xl p-1 ${t.track} ${className}`}>
      {options.map(({ value, label, icon: Icon }) => {
        const active = choice === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setChoice(value)}
            title={value === "auto" ? "Match my phone or computer" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] transition-colors ${
              active ? t.active : t.idle
            }`}
          >
            <Icon size={16} aria-hidden="true" className={active ? t.icon : ""} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
