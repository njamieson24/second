"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, RotateCcw } from "lucide-react";
import { AppShell, ModeOnly } from "@/components/AppShell";
import { FormMessage } from "@/components/AuthShell";
import { Button } from "@/components/Button";
import { ChatBubble } from "@/components/ChatBubble";
import { Chip } from "@/components/Chip";
import { SampleTag } from "@/components/EmptyStates";
import { CHAT_MAX_CHARS, NOTES_EVERY, type ChatProposal, type ChatRole } from "@/lib/chat";
import type { Mode } from "@/lib/mode";
import { useLoadedData } from "@/lib/data";
import { dayLabel } from "@/lib/dates";
import { chat, type ChatMessage } from "@/lib/demo-content";
import { formatMoney } from "@/lib/money";
import { approveProposal, getChatHistory, ignoreProposal, refreshNotes, sendChatMessage } from "@/lib/store";
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
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col px-4 pt-5 desk:min-h-screen desk:px-10 desk:pt-7">
        <div className="border-b border-line pb-[18px]">
          <h1 className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px]">Chat with Second</h1>
          <p className="mt-1 mb-0 text-[15px] text-muted">Ask anything, in your own words.</p>
        </div>
        <Conversation />
      </div>
    </AppShell>
  );
}

function Conversation() {
  const { account } = useLoadedData();
  return account?.kind === "demo" ? <DemoConversation /> : <LiveChat />;
}

// ---------- The real chat (logged-in accounts) ----------

type Shown = { id: string; role: ChatRole; content: string; proposals: ChatProposal[] };

const STARTERS: Record<Mode, string[]> = {
  launch: ["What's my next step?", "How much should I save before opening?", "Do I need an LLC?"],
  running: ["How am I doing this month?", "Should I raise my prices?", "How can I get more clients?"],
};

/** Plain text from Second, with "- " bullets shown as dots. */
function tidy(text: string): string {
  return text.replace(/\*\*/g, "").replace(/^[-*] /gm, "• ");
}

function LiveChat() {
  const { business, mode } = useLoadedData();
  const [messages, setMessages] = useState<Shown[]>([]);
  const [loading, setLoading] = useState<"loading" | "ready" | "failed">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<{ message: string; limit?: boolean; retry?: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sentThisVisit = useRef(0);

  useEffect(() => {
    let live = true;
    getChatHistory().then((result) => {
      if (!live) return;
      if (result.ok) {
        setMessages(result.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, proposals: m.proposals })));
        setLoading("ready");
        // Notes pass trigger 1: opening chat. The server skips it if nothing is new.
        if (result.messages.length) void refreshNotes();
      } else setLoading("failed");
    });
    return () => {
      live = false;
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, problem]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setProblem(null);
    setDraft("");
    setSending(true);
    const stamp = Date.now();
    const askId = `you-${stamp}`;
    const replyId = `reply-${stamp}`;
    setMessages((m) => [
      ...m,
      { id: askId, role: "user", content: message, proposals: [] },
      { id: replyId, role: "assistant", content: "", proposals: [] },
    ]);
    const result = await sendChatMessage(
      message,
      (piece) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + piece } : x))),
      (_messageId, proposals) => setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, proposals } : x))),
    );
    setSending(false);
    if (result.ok) {
      setRemaining(result.remaining);
      // Notes pass trigger 2: every few messages in one sitting.
      sentThisVisit.current += 1;
      if (sentThisVisit.current % NOTES_EVERY === 0) void refreshNotes();
    } else {
      // Nothing was saved: take the question and any half-reply back out, and offer to try again.
      setMessages((m) => m.filter((x) => x.id !== replyId && x.id !== askId));
      setProblem({ message: result.message, limit: result.limit, retry: result.limit ? undefined : message });
      if (result.limit) setRemaining(0);
      else setDraft(message);
    }
    inputRef.current?.focus();
  }

  const empty = loading === "ready" && messages.length === 0;
  const outOfMessages = remaining === 0 || Boolean(problem?.limit);

  let note = "Second can make mistakes. Check anything important.";
  if (sending) note = "Second is writing…";
  else if (outOfMessages) note = "That's all your messages for today. You can chat again in a few hours.";
  else if (remaining !== null && remaining > 0 && remaining <= 10)
    note = `${remaining} ${remaining === 1 ? "message" : "messages"} left today`;
  else if (draft.length > CHAT_MAX_CHARS - 200) note = `${CHAT_MAX_CHARS - draft.length} letters left`;

  return (
    <>
      <div
        className="mx-auto flex w-full max-w-[760px] grow flex-col gap-3.5 py-[22px]"
        role="log"
        aria-label="Conversation with Second"
        aria-busy={sending}
      >
        {loading === "loading" && <p className="m-0 text-[15px] text-muted">Loading your conversation…</p>}
        {loading === "failed" && (
          <FormMessage tone="error">We couldn&apos;t load your earlier messages. You can still ask something new.</FormMessage>
        )}
        {(empty || loading === "failed") && (
          <ChatBubble from="second">
            {`Hi ${business.ownerName}! I'm Second, your business partner. Ask me anything about your business, in your own words. No question is too small.`}
          </ChatBubble>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <ChatBubble key={m.id} from="user">
              {m.content}
            </ChatBubble>
          ) : (
            <ChatBubble
              key={m.id}
              from="second"
              extras={
                m.proposals.length > 0 && (
                  <div className="flex flex-col gap-2.5">
                    {m.proposals.map((p) => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        onChange={(status) =>
                          setMessages((all) =>
                            all.map((x) => ({ ...x, proposals: x.proposals.map((y) => (y.id === p.id ? { ...y, status } : y)) })),
                          )
                        }
                      />
                    ))}
                  </div>
                )
              }
            >
              {m.content ? tidy(m.content) : <WritingDots />}
            </ChatBubble>
          ),
        )}
        {problem && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-row border border-line-strong bg-card px-4 py-3.5 sm:ml-12">
            <p className="m-0 text-[15px] leading-normal">{problem.message}</p>
            {problem.retry && (
              <Button
                size="sm"
                variant="soft"
                weight="medium"
                icon={<RotateCcw size={16} aria-hidden="true" />}
                onClick={() => send(problem.retry ?? "")}
              >
                Try again
              </Button>
            )}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-[760px] bg-paper pt-2 pb-4 desk:pb-6">
        {empty && mode && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {STARTERS[mode].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="min-h-11 rounded-full border border-line-strong bg-card px-3.5 text-sm text-ink hover:border-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="flex items-end gap-2.5 rounded-hero border border-line-strong bg-card py-1.5 pr-1.5 pl-5 focus-within:border-sky focus-within:ring-2 focus-within:ring-sky"
        >
          <label htmlFor="message" className="sr-only">
            Message Second
          </label>
          <textarea
            id="message"
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={CHAT_MAX_CHARS}
            disabled={outOfMessages}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder={outOfMessages ? "You can chat again later today" : "Message Second"}
            className="field-sizing-content max-h-40 min-h-11 min-w-0 grow resize-none bg-transparent py-2.5 text-base leading-normal text-ink outline-none placeholder:text-muted disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            aria-label={sending ? "Second is writing" : "Send"}
            disabled={sending || !draft.trim() || outOfMessages}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sky text-on-sky hover:bg-sky-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowUp size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </form>
        <p className="mt-2 mb-0 min-h-5 text-center text-[13px] text-muted" aria-live="polite">
          {note}
        </p>
      </div>
    </>
  );
}

/** A suggested update. Only Approve changes anything, under the owner's own login. */
function ProposalCard({ proposal, onChange }: { proposal: ChatProposal; onChange: (status: ChatProposal["status"]) => void }) {
  const [busy, setBusy] = useState<"approve" | "ignore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "ignore") {
    setBusy(action);
    setError(null);
    const result = action === "approve" ? await approveProposal(proposal) : await ignoreProposal(proposal);
    setBusy(null);
    if (result.ok) onChange(result.status);
    else setError(result.message);
  }

  return (
    <div className="rounded-row border border-line bg-card px-4 py-3.5" role="group" aria-label="Suggested update">
      <div className="text-[13px] font-semibold text-sky-ink">Suggested update</div>
      <p className="mt-1 mb-0 text-[15px] leading-normal text-ink">{proposal.summary}</p>
      <div className="mt-3" aria-live="polite">
        {proposal.status === "pending" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide("approve")} disabled={busy !== null}>
              {busy === "approve" ? "Saving…" : "Approve"}
            </Button>
            <Button size="sm" variant="ghost" weight="medium" onClick={() => decide("ignore")} disabled={busy !== null}>
              Ignore
            </Button>
          </div>
        )}
        {proposal.status === "approved" && (
          <Chip tone="mint" className="inline-flex items-center gap-1">
            <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Updated
          </Chip>
        )}
        {proposal.status === "ignored" && <Chip tone="neutral">Ignored. Nothing changed.</Chip>}
        {proposal.status === "stale" && (
          <p className="m-0 text-sm text-muted">This can&apos;t be applied anymore, because it changed since. Nothing was changed.</p>
        )}
        {error && <p className="mt-2 mb-0 text-sm text-ink">{error}</p>}
      </div>
    </div>
  );
}

function WritingDots() {
  return (
    <span className="flex h-6 items-center gap-1.5" aria-label="Second is writing">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-2 animate-typing rounded-full bg-muted motion-reduce:animate-none"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}

// ---------- Try the demo: a sample conversation, read only ----------

function DemoConversation() {
  const { business, mode } = useLoadedData();
  const { messages } = chat[mode ?? "running"];
  return (
    <>
      <div className="mx-auto mt-4 w-full max-w-[760px]">
        <SampleTag />
      </div>
      <div
        className="mx-auto flex w-full max-w-[760px] grow flex-col gap-3.5 py-[22px]"
        role="log"
        aria-label="Sample conversation with Second"
      >
        {messages.map((msg, i) => (
          <Message key={i} msg={{ ...msg, text: withName(msg.text, business.ownerName) }} />
        ))}
      </div>
      <div className="sticky bottom-0 mx-auto w-full max-w-[760px] bg-paper pt-2 pb-4 desk:pb-6">
        <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0 text-[15px] leading-normal">
            This is a sample. Make a free account to chat with Second about your own business.
          </p>
          <Button href="/signup">Sign up to chat</Button>
        </div>
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
            <div
              key={opt.title}
              className={`min-h-[72px] rounded-[14px] bg-card px-3.5 py-3 text-left text-ink ${
                opt.selected ? "border-[1.5px] border-sky" : "border border-line-strong"
              }`}
            >
              <span className="block text-[15px] font-semibold">{opt.title}</span>
              <span className="block text-sm text-muted">{opt.detail}</span>
            </div>
          ))}
        </div>
      )}
      {msg.draft && (
        <div className="rounded-row border border-line bg-card px-4 py-3.5">
          <div className="text-[13px] font-semibold text-sky-ink">{msg.draft.label}</div>
          <p className="mt-1.5 mb-0 text-[15px] leading-normal text-ink">{msg.draft.text}</p>
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
  const { business, showSamples } = useLoadedData();
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
      aria-label="Your business"
      className="hidden w-[368px] shrink-0 flex-col gap-6 border-l border-line bg-card px-6 py-7 desk:flex"
    >
      {showSamples && (
        <section>
          <h2 className="m-0 mb-3 flex items-center justify-between text-base font-semibold">
            Second is on it <SampleTag />
          </h2>
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
      )}
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
        <p className="mt-3.5 mb-0 border-t border-line-soft pt-3 text-[13px] leading-normal text-muted">
          Second uses this, plus your money, roadmap and calendar, to answer.
        </p>
      </section>
    </aside>
  );
}
