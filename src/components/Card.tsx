type CardProps = {
  title?: React.ReactNode;
  /** Chip, link, or note shown to the right of the title */
  aside?: React.ReactNode;
  padding?: "md" | "lg";
  className?: string;
  children?: React.ReactNode;
};

export function CardTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`m-0 text-[17px] font-semibold ${className}`}>{children}</h2>;
}

export function Card({ title, aside, padding = "md", className = "", children }: CardProps) {
  return (
    <section
      className={`rounded-card border border-line bg-card ${padding === "md" ? "p-[22px]" : "px-6 py-[22px]"} ${className}`}
    >
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3">
          {title && <CardTitle>{title}</CardTitle>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label on the left, value on the right, divider under each row but the last. */
export function ListRow({
  children,
  last,
  className = "",
}: {
  children: React.ReactNode;
  last?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 text-[15px] ${
        last ? "pt-2.5" : "border-b border-line-soft py-2.5"
      } ${className}`}
    >
      {children}
    </div>
  );
}
