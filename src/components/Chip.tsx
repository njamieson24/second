import type { ChipTone } from "@/lib/mock-data";

const tones: Record<ChipTone, string> = {
  mint: "bg-mint-tint text-mint-deep",
  sky: "bg-sky-tint text-sky-ink",
  neutral: "bg-line-soft text-slate",
};

/** Status pill. mint = done/good, sky = ready/draft, neutral = not started. */
export function Chip({
  tone = "sky",
  size = "md",
  weight = "semibold",
  className = "",
  children,
}: {
  tone?: ChipTone;
  size?: "md" | "sm";
  weight?: "semibold" | "medium" | "normal";
  className?: string;
  children: React.ReactNode;
}) {
  const sizing = size === "md" ? "rounded-chip px-2.5 py-1 text-[13px]" : "rounded-lg px-2 py-0.5 text-xs";
  const w = weight === "semibold" ? "font-semibold" : weight === "medium" ? "font-medium" : "font-normal";
  return (
    <span className={`inline-block whitespace-nowrap leading-tight ${sizing} ${w} ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
