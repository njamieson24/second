import Link from "next/link";
import { ArrowRight } from "lucide-react";

export type ButtonVariant =
  | "primary" // sky, the main action on light
  | "mint" // highlight action on panels
  | "green" // action on mint tip cards
  | "ghost" // outlined, on light
  | "ghost-dark" // outlined, on panels
  | "dark" // ink fill, on light (flips to a light fill in dark mode)
  | "light" // high-contrast fill, on panels
  | "soft"; // white with a soft border

const variants: Record<ButtonVariant, string> = {
  primary: "bg-sky text-on-sky hover:bg-sky-ink",
  mint: "bg-mint text-mint-ink hover:brightness-95",
  green: "bg-mint-deep text-on-green hover:bg-mint-heading",
  ghost: "border-[1.5px] border-ink text-ink hover:bg-ink hover:text-paper",
  "ghost-dark": "border-[1.5px] border-ink-edge text-on-panel hover:border-on-panel",
  dark: "bg-ink text-paper hover:bg-ink-soft",
  light: "bg-on-panel text-panel hover:opacity-90",
  soft: "border border-line-strong bg-card text-ink hover:border-ink",
};

type ButtonProps = {
  variant?: ButtonVariant;
  /** lg = 16px text and 48px tall (page-level calls to action), md = 15px, sm = 14px */
  size?: "lg" | "md" | "sm";
  /** Side padding: tight 18px, normal 20px, wide 22px, loose 24px. Defaults by size. */
  pad?: "tight" | "normal" | "wide" | "loose";
  weight?: "semibold" | "medium" | "normal";
  href?: string;
  icon?: React.ReactNode;
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  "aria-label"?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  pad,
  weight = "semibold",
  href,
  icon,
  arrow,
  className = "",
  children,
  onClick,
  ...rest
}: ButtonProps) {
  const classes = [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-center no-underline transition-colors",
    { lg: "min-h-12 text-base", md: "min-h-11 text-[15px]", sm: "min-h-11 text-sm" }[size],
    { tight: "px-[18px]", normal: "px-5", wide: "px-[22px]", loose: "px-6" }[
      pad ?? ({ lg: "loose", md: "normal", sm: "tight" } as const)[size]
    ],
    weight === "semibold" ? "font-semibold" : weight === "medium" ? "font-medium" : "font-normal",
    variants[variant],
    className,
  ].join(" ");

  const content = (
    <>
      {icon}
      {children}
      {arrow && <ArrowRight size={18} aria-hidden="true" />}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} onClick={onClick} {...rest}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} onClick={onClick} {...rest}>
      {content}
    </button>
  );
}
