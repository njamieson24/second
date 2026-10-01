export function StatTile({
  label,
  value,
  note,
  noteGood,
  valueGood,
  inlineNote,
  size = "md",
  dark,
}: {
  label: string;
  value: string;
  note?: string;
  noteGood?: boolean;
  valueGood?: boolean;
  /** Put the note beside the number instead of below it */
  inlineNote?: boolean;
  size?: "md" | "lg";
  dark?: boolean;
}) {
  const noteClass = `text-[13px] ${dark ? "text-on-dark" : noteGood ? "font-medium text-mint-deep" : "text-muted"}`;
  const valueClass = `font-semibold leading-tight ${size === "lg" ? "text-4xl tracking-[-0.8px]" : "text-[30px]"} ${
    valueGood ? "text-mint-deep" : ""
  }`;

  return (
    <div
      className={`rounded-tile ${size === "lg" ? "px-[22px] py-5" : "px-5 py-[18px]"} ${
        dark ? "on-dark bg-panel text-on-panel ring-1 ring-ink-line" : "border border-line bg-card"
      }`}
    >
      <div className={`text-sm ${dark ? "font-medium text-panel-accent" : "text-muted"}`}>{label}</div>
      {inlineNote ? (
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <span className={valueClass}>{value}</span>
          {note && <span className={noteClass}>{note}</span>}
        </div>
      ) : (
        <>
          <div className={valueClass}>{value}</div>
          {note && <div className={noteClass}>{note}</div>}
        </>
      )}
    </div>
  );
}
