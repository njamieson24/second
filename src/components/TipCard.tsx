import { LogoMark } from "./Logo";

/** Mint card for Second's advice. "heading" for cards with actions, "eyebrow" for short tips. */
export function TipCard({
  title,
  style = "heading",
  withMark,
  className = "",
  children,
}: {
  title: string;
  style?: "heading" | "eyebrow";
  withMark?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-card bg-mint-tint p-[22px] text-mint-heading ${className}`}>
      {style === "heading" ? (
        <div className="flex items-center gap-2">
          {withMark && <LogoMark tone="mint" width={30} />}
          <h2 className="m-0 text-[17px] font-semibold text-mint-heading">{title}</h2>
        </div>
      ) : (
        <h2 className="m-0 text-sm font-semibold text-mint-deep">{title}</h2>
      )}
      {children}
    </section>
  );
}
