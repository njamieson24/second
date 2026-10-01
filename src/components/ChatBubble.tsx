import { LogoMark } from "./Logo";

export function SecondAvatar() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-panel" aria-hidden="true">
      <LogoMark tone="dark" width={22} />
    </span>
  );
}

/** User = sky, right-aligned. Second = white card with the Second avatar, left. */
export function ChatBubble({
  from,
  children,
  extras,
}: {
  from: "user" | "second";
  children: React.ReactNode;
  /** Options or drafts shown under Second's message */
  extras?: React.ReactNode;
}) {
  if (from === "user") {
    return (
      <div className="ml-10 max-w-[554px] self-end rounded-[18px_6px_18px_18px] bg-sky px-4 py-3 text-base leading-normal text-on-sky">
        <span className="sr-only">You said: </span>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <SecondAvatar />
      <div className={`flex min-w-0 flex-col gap-2.5 ${extras ? "max-w-[560px]" : "max-w-[594px]"}`}>
        <div className="self-start rounded-[6px_18px_18px_18px] border border-line bg-card px-4 py-3 text-base leading-normal whitespace-pre-line">
          <span className="sr-only">Second said: </span>
          {children}
        </div>
        {extras}
      </div>
    </div>
  );
}
