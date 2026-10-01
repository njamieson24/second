export function ProgressBar({
  percent,
  tone = "sky",
  height = "sm",
  label,
  className = "",
}: {
  percent: number;
  /** mint = on dark backgrounds */
  tone?: "sky" | "mint";
  height?: "sm" | "md";
  label: string;
  className?: string;
}) {
  const track = tone === "mint" ? "bg-ink-track" : "bg-line-soft";
  const fill = tone === "mint" ? "bg-mint" : "bg-sky";
  const h = height === "sm" ? "h-2 rounded-[4px]" : "h-2.5 rounded-[5px]";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`${h} ${track} ${className}`}
    >
      <div className={`${h} ${fill} transition-[width] duration-500 ease-out motion-reduce:transition-none`} style={{ width: `${percent}%` }} />
    </div>
  );
}
