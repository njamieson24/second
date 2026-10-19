/** Page title row. `actions` wrap below the title on phones. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  align = "center",
  size = "md",
}: {
  eyebrow?: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  align?: "center" | "end";
  /** sm = 30px (Running tools), md = 32px (home pages), lg = 34px (Launch tools) */
  size?: "sm" | "md" | "lg";
}) {
  const titleSize =
    size === "lg"
      ? "text-[34px] tracking-[-0.8px]"
      : size === "md"
        ? "text-[32px] tracking-[-0.8px]"
        : "text-[30px] tracking-[-0.7px]";
  return (
    <div data-tour-header className={`flex flex-wrap gap-4 ${align === "end" ? "items-end" : "items-center"}`}>
      <div className="min-w-0 flex-1 basis-72">
        {eyebrow && <p className="m-0 text-sm text-muted">{eyebrow}</p>}
        <h1
          className={`m-0 leading-tight font-semibold ${titleSize} ${eyebrow ? (size === "lg" ? "mt-1.5" : "mt-0.5") : ""}`}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={`m-0 text-muted ${size === "lg" ? "mt-1.5 text-base" : "mt-1 text-[15px]"}`}>{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

/** Standard page padding and spacing between cards. */
export function PageBody({ gap = "lg", children }: { gap?: "md" | "lg"; children: React.ReactNode }) {
  return (
    <div className={`flex flex-col px-4 pt-5 pb-10 desk:px-10 desk:pt-8 ${gap === "lg" ? "gap-6" : "gap-[22px]"}`}>
      {children}
    </div>
  );
}
