"use client";

import { useId, useState } from "react";

export const inputClass =
  "min-h-12 w-full rounded-row border border-line-strong bg-card px-4 text-base text-ink placeholder:text-muted focus:border-sky";

// Same look as inputClass, bigger, for headline numbers like "Your price"
const moneyLgClass =
  "min-h-14 w-full rounded-row border border-line-strong bg-card pr-4 pl-10 text-[28px] font-semibold text-ink focus:border-sky";

/** Label above an input, with optional help text. */
export function Field({
  label,
  help,
  labelHidden,
  children,
}: {
  label: string;
  help?: string;
  labelHidden?: boolean;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelHidden ? "sr-only" : "text-[15px] font-medium"}>
        {label}
      </label>
      {children(id)}
      {help && <p className="m-0 text-sm text-muted">{help}</p>}
    </div>
  );
}

/**
 * Dollar input. Keeps what the person typed while they type (so clearing the box
 * doesn't jump to 0), and sends a number up on every change.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  /** Accessible name when there is no visible <label> */
  label?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  // While typing, show exactly what was typed. Otherwise show the saved value,
  // so outside changes (like another tab) appear.
  const [typing, setTyping] = useState<string | null>(null);

  return (
    <div className={`relative ${className}`}>
      <span
        className={`pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted ${size === "lg" ? "text-2xl" : "text-base"}`}
        aria-hidden="true"
      >
        $
      </span>
      <input
        id={id}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        value={typing ?? String(value)}
        onFocus={() => setTyping(value === 0 ? "" : String(value))}
        onBlur={() => setTyping(null)}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/[^0-9.]/g, "");
          setTyping(cleaned);
          const parsed = Number.parseFloat(cleaned);
          onChange(Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0);
        }}
        className={`${size === "lg" ? moneyLgClass : `${inputClass} pl-8`} tabular-nums`}
      />
    </div>
  );
}
