type LogoTone = "light" | "dark" | "mint";

// Circle = the owner, ring = their Second. The ring is drawn twice so a gap
// in the background color shows where it crosses the circle.
const tones: Record<LogoTone, { circle: string; gap: string; ring: string }> = {
  light: { circle: "fill-sky", gap: "stroke-paper", ring: "stroke-mint" },
  dark: { circle: "fill-panel-mark", gap: "stroke-panel", ring: "stroke-mint" },
  mint: { circle: "fill-sky", gap: "stroke-mint-tint", ring: "stroke-mint-mark" },
};

export function LogoMark({ tone = "light", width = 38 }: { tone?: LogoTone; width?: number }) {
  const t = tones[tone];
  return (
    <svg width={width} height={(width * 56) / 88} viewBox="0 0 88 56" aria-hidden="true" className="shrink-0">
      <circle cx="28" cy="28" r="24" className={t.circle} />
      <circle cx="60" cy="28" r="21" fill="none" strokeWidth="12" className={t.gap} />
      <circle cx="60" cy="28" r="21" fill="none" strokeWidth="6" className={t.ring} />
    </svg>
  );
}

export function Logo({ tone = "light", size = "md" }: { tone?: "light" | "dark"; size?: "md" | "lg" }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark tone={tone} width={size === "lg" ? 40 : 38} />
      <span
        className={`font-semibold tracking-[-0.5px] ${size === "lg" ? "text-[26px]" : "text-[25px]"} ${
          tone === "dark" ? "text-on-panel" : "text-ink"
        }`}
      >
        second
      </span>
    </span>
  );
}
