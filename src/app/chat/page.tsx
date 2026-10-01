"use client";

import { ArrowUp } from "lucide-react";
import { AppShell, ModeOnly } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ChatBubble } from "@/components/ChatBubble";
import type { Mode } from "@/lib/mode";
import { useLoadedData } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { chat, type ChatMessage } from "@/lib/mock-data";
import { formatMoney } from "@/lib/money";
import { withName } from "@/lib/text";

const modes: Mode[] = ["launch", "running"];

export default function ChatPage() {
  return (
    <AppShell
      mode="current"
      aside={modes.map((m) => (
        <ModeOnly key={m} mode={m}>
          <SidePanel mode={m} />
        </ModeOnly>
      ))}
    >
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 pt-5 pb-5 desk:min-h-screen desk:px-10 desk:py-7">
        <div className="border-b border-line pb-[18px]">
          <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px]">Chat with Second</h1>
          <p className="mt-1 mb-0 text-[15px] text-muted">Ask anything, or just tell Second what you want done.</p>
        </div>
        {modes.map((m) => (
          <ModeOnly key={m} mode={m}>
            <Conversation mode={m} />
          </ModeOnly>
        ))}
      </div>
    </AppShell>
  );
}

function Conversation({ mode }: { mode: Mode }) {
  const { messages, suggestions } = chat[mode];
  const { business } = useLoadedData();
  return (
    <>
      <div
        className="mx-auto flex w-full max-w-[760px] grow flex-col gap-3.5 py-[22px]"
        role="log"
        aria-label="Conversation with Second"
      >
        {messages.map((msg, i) => (
          <Message key={i} msg={{ ...msg, text: withName(msg.text, business.ownerName) }} />
        ))}
      </div>

      <div className="mx-auto w-full max-w-[760px]">
        <div className="mb-2.5 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="min-h-11 rounded-full border border-line-strong bg-card px-3.5 text-sm text-ink hover:border-ink"
            >
              {s}
            </button>
          ))}
        </div>
        <form className="flex items-center gap-2.5 rounded-hero border border-line-strong bg-card py-1.5 pr-1.5 pl-5 focus-within:border-sky focus-within:ring-2 focus-within:ring-sky">
          <label htmlFor={`message-${mode}`} className="sr-only">
            Message Second
          </label>
          <input
            id={`message-${mode}`}
            type="text"
            placeholder="Message Second"
            className="h-11 min-w-0 grow bg-transparent text-base text-ink outline-none placeholder:text-muted"
          />
          <button
            type="button"
            aria-label="Send"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky text-on-sky hover:bg-sky-ink"
          >
            <ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </form>
      </div>
    </>
  );
}

function Message({ msg }: { msg: ChatMessage }) {
  if (msg.from === "user") return <ChatBubble from="user">{msg.text}</ChatBubble>;

  const extras = (msg.options || msg.draft) && (
    <>
      {msg.options && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {msg.options.map((opt) => (
            <button
              key={opt.title}
              type="button"
              aria-pressed={opt.selected ?? false}
              className={`min-h-[72px] rounded-[14px] bg-card px-3.5 py-3 text-left text-ink ${
                opt.selected ? "border-[1.5px] border-sky" : "border border-line-strong hover:border-ink"
              }`}
            >
              <span className="block text-[15px] font-semibold">{opt.title}</span>
              <span className="block text-sm text-muted">{opt.detail}</span>
            </button>
          ))}
        </div>
      )}
      {msg.draft && (
        <div className="rounded-row border border-line bg-card px-4 py-3.5">
          <div className="text-[13px] font-semibold text-sky-ink">{msg.draft.label}</div>
          <p className="mt-1.5 mb-3 text-[15px] leading-normal text-ink">{msg.draft.text}</p>
          <div className="flex gap-2">
            <Button>Send reply</Button>
            <Button variant="ghost" weight="medium" pad="tight">
              Edit
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <ChatBubble from="second" extras={extras}>
      {msg.text}
    </ChatBubble>
  );
}

function SidePanel({ mode }: { mode: Mode }) {
  const { working } = chat[mode];
  const { business } = useLoadedData();
  const goal =
    mode === "launch" && business.openingDay
      ? `Open by ${dayLabel(business.openingDay)}`
      : (business.goalNote ?? `Take home ${formatMoney(business.payGoal)} a month`);
  const profile = [
    { label: "Type", value: business.typeLabel },
    { label: "Area", value: business.area },
    { label: "Services", value: business.services.map((s) => s.name).join(", ") },
    { label: "Goal", value: goal },
  ];
  return (
    <aside
      aria-label="What Second is doing"
      className="hidden w-[368px] shrink-0 flex-col gap-6 border-l border-line bg-card px-6 py-7 desk:flex"
    >
      <section>
        <h2 className="m-0 mb-3 text-base font-semibold">Second is on it</h2>
        <ul className="m-0 list-none p-0">
          {working.map((item, i) => (
            <li
              key={item.title}
              className={`flex gap-2.5 py-2.5 ${i < working.length - 1 ? "border-b border-line-soft" : ""}`}
            >
              <span
                className={`mt-[5px] size-2.5 shrink-0 rounded-full ${item.done ? "bg-mint" : "bg-sky"}`}
                aria-hidden="true"
              />
              <div>
                <div className="text-[15px]">{item.title}</div>
                <div className="text-[13px] text-muted">{item.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-[18px] bg-paper p-[18px]">
        <h2 className="m-0 mb-2.5 text-base font-semibold">Your business</h2>
        <dl className="m-0">
          {profile.map((row, i) => (
            <div key={row.label} className={i < profile.length - 1 ? "mb-2.5" : ""}>
              <dt className="text-sm text-muted">{row.label}</dt>
              <dd className="m-0 text-[15px]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </aside>
  );
}
