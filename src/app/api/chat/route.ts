// Chat with Second. Runs on the SERVER only.
//
// - ANTHROPIC_API_KEY is read here and nowhere else. It never goes to the browser
//   and is never logged.
// - Only logged-in people: the request carries their login token, and every database
//   read and write is made AS that person with the public key (row level security).
// - Protects the credits: capped reply length, only the last CHAT_HISTORY messages from the
//   last CHAT_HISTORY_HOURS are sent (older ones live on as notes), and a daily limit per
//   person (CHAT_DAILY_LIMIT, default 50 in 24 hours).
// - Second can SUGGEST changes with tools (src/lib/chat-tools.ts). Suggestions are checked and
//   saved as cards; nothing is changed until the owner taps Approve (store.ts does the writing).
// - Every reply is saved with its token counts, so costs show in the database.
//
// POST { message, timeZone }  ->  a stream of ChatStreamEvent, one JSON object per line.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  CHAT_DAILY_LIMIT,
  CHAT_HISTORY,
  CHAT_HISTORY_HOURS,
  CHAT_MAX_CHARS,
  NOTES_IN_CONTEXT,
  type BusinessNote,
  type ChatProposal,
  type ChatStreamEvent,
  type ProposalStatus,
} from "@/lib/chat";
import { businessContext, notesContext, proposalsContext, SECOND_PERSONA } from "@/lib/chat-context";
import { checkToolCall, PROPOSAL_TOOLS, TOOL_RULES } from "@/lib/chat-tools";
import { toBusiness, toEvent, toMoneyPlan, toTransaction, type BusinessRow, type EventRow, type MoneyPlanRow, type TransactionRow } from "@/lib/db-rows";
import type { Mode } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
// Models that think before answering: give them a little more room and keep effort low for chat.
const THINKING_MODELS = ["claude-sonnet-5-5", "claude-sonnet-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"];
// Models that support Anthropic's built-in backup when they decline a question.
const FALLBACK_MODELS = ["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"];

const BUSY = "Second is a bit busy right now. Please try again in a minute.";
const NOT_SET_UP = "Chat with Second isn't working right now. We're on it. Please try again later.";

const MAX_PROPOSALS = 2;

function historyHours(): number {
  const n = Number.parseFloat(process.env.CHAT_HISTORY_HOURS ?? "");
  return Number.isFinite(n) && n > 0 ? n : CHAT_HISTORY_HOURS;
}

function dailyLimit(): number {
  const n = Number.parseInt(process.env.CHAT_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : CHAT_DAILY_LIMIT;
}

function validTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || tz.length > 64) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}

/** A finished answer that isn't a stream (errors before we start). */
function reply(status: number, event: ChatStreamEvent) {
  return new Response(JSON.stringify(event) + "\n", {
    status,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Turn an API error into a kind message, and log only what kind of error it was. */
function friendly(error: unknown, model: string): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error(`chat: Anthropic refused the API key (${error.status}). Check ANTHROPIC_API_KEY.`);
    return NOT_SET_UP;
  }
  if (error instanceof Anthropic.NotFoundError) {
    console.error(`chat: model not found: ${model}. Check CLAUDE_MODEL.`);
    return NOT_SET_UP;
  }
  if (error instanceof Anthropic.RateLimitError) {
    console.error("chat: Anthropic rate limit (429)");
    return BUSY;
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error("chat: Anthropic said the request was invalid (400)");
    return "Something went wrong with that message. Please try again, or try asking it a different way.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    console.error("chat: couldn't reach Anthropic");
    return BUSY;
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`chat: Anthropic error ${error.status ?? ""}`);
    return BUSY; // 500s and 529 "overloaded"
  }
  console.error("chat: unexpected error", error instanceof Error ? error.name : typeof error);
  return "Something went wrong. Please try again in a minute.";
}

function timeLabel(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply(500, { type: "error", message: NOT_SET_UP });

  // ---------- Who is asking ----------
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return reply(401, { type: "error", message: "Please log in to chat with Second." });
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return reply(401, { type: "error", message: "Please log in again to chat with Second." });

  // ---------- What they asked ----------
  const body = (await request.json().catch(() => ({}))) as { message?: unknown; timeZone?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return reply(400, { type: "error", message: "Please type a message first." });
  if (message.length > CHAT_MAX_CHARS)
    return reply(400, { type: "error", message: `That's a long one! Please keep messages under ${CHAT_MAX_CHARS} letters.` });
  const timeZone = validTimeZone(body.timeZone);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("chat: ANTHROPIC_API_KEY is not set on the server");
    return reply(500, { type: "error", message: NOT_SET_UP });
  }

  // ---------- Their data, the daily limit, and recent history (all read AS them) ----------
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const limit = dailyLimit();
  const historySince = new Date(now.getTime() - historyHours() * 3_600_000).toISOString();
  const [biz, tasks, plan, txs, evs, history, today, notesRes, cardsRes] = await Promise.all([
    db.from("businesses").select("*").eq("user_id", user.id).maybeSingle(),
    db.from("roadmap_tasks").select("task_id").eq("user_id", user.id),
    db.from("money_plans").select("*").eq("user_id", user.id).maybeSingle(),
    db.from("transactions").select("*").eq("user_id", user.id),
    db.from("events").select("*").eq("user_id", user.id),
    db
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .gte("created_at", historySince)
      .order("created_at", { ascending: false })
      .limit(CHAT_HISTORY),
    db
      .from("chat_messages")
      .select("created_at", { count: "exact" })
      .eq("user_id", user.id)
      .eq("role", "user")
      .gte("created_at", dayAgo)
      .order("created_at", { ascending: true })
      .limit(1),
    db.from("business_notes").select("id, note, created_at, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(NOTES_IN_CONTEXT),
    db.from("chat_proposals").select("summary, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);
  if (history.error || today.error) {
    console.error("chat: chat_messages table problem", history.error?.code ?? today.error?.code);
    return reply(500, { type: "error", message: NOT_SET_UP });
  }
  const business = toBusiness(biz.data as BusinessRow | null);
  if (!business) return reply(400, { type: "error", message: "Please finish setting up your business first, then come back to chat." });

  const usedToday = today.count ?? 0;
  if (usedToday >= limit) {
    const oldest = today.data?.[0]?.created_at as string | undefined;
    const reset = oldest ? new Date(new Date(oldest).getTime() + 86_400_000) : new Date(now.getTime() + 86_400_000);
    return reply(429, {
      type: "error",
      limit: true,
      message: `You've used today's ${limit} messages with Second. You can chat again after ${timeLabel(reset, timeZone)}.`,
    });
  }

  // ---------- Build the request ----------
  const mode: Mode = (biz.data as { mode?: Mode } | null)?.mode === "running" ? "running" : "launch";
  const events = ((evs.data ?? []) as EventRow[]).map(toEvent);
  const { text: context, refs } = businessContext({
    business,
    mode,
    completedTaskIds: (tasks.data ?? []).map((t) => t.task_id as string),
    moneyPlan: toMoneyPlan(plan.data as MoneyPlanRow | null),
    transactions: ((txs.data ?? []) as TransactionRow[]).map(toTransaction),
    events,
    timeZone,
    now,
  });
  // Memory tables are optional: if they're missing (memory.sql not run yet), chat still works.
  const notes: BusinessNote[] = notesRes.error
    ? []
    : (notesRes.data ?? []).map((n) => ({ id: n.id, note: n.note, createdAt: n.created_at, updatedAt: n.updated_at }));
  const recentCards = cardsRes.error ? [] : ((cardsRes.data ?? []) as { summary: string; status: ProposalStatus }[]).reverse();
  const memoryReady = !notesRes.error && !cardsRes.error;

  const past = ((history.data ?? []) as { role: "user" | "assistant"; content: string }[]).reverse();
  while (past.length && past[0].role !== "user") past.shift(); // the conversation must start with them
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...past.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  const model = process.env.CLAUDE_MODEL?.trim() || DEFAULT_MODEL;
  const thinks = THINKING_MODELS.includes(model);
  const fallback = FALLBACK_MODELS.includes(model);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 55_000 });

  const stream = anthropic.beta.messages.stream({
    model,
    max_tokens: thinks ? 1500 : 600,
    system: [
      { type: "text", text: memoryReady ? `${SECOND_PERSONA}\n\n${TOOL_RULES}` : SECOND_PERSONA },
      { type: "text", text: [context, notesContext(notes), proposalsContext(recentCards)].filter(Boolean).join("\n\n") },
    ],
    ...(memoryReady ? { tools: PROPOSAL_TOOLS } : {}),
    messages,
    ...(thinks ? { output_config: { effort: "low" as const } } : {}),
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  const userAt = now.toISOString();
  const encoder = new TextEncoder();

  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let text = "";
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            text += event.delta.text;
            send({ type: "text", text: event.delta.text });
          }
        }
        const final = await stream.finalMessage();

        // Suggested updates: check each one; only good ones become cards.
        const replyId = randomUUID();
        const cards: ChatProposal[] = [];
        if (final.stop_reason !== "max_tokens" && final.stop_reason !== "refusal") {
          for (const block of final.content) {
            if (block.type !== "tool_use" || cards.length >= MAX_PROPOSALS) continue;
            const checked = checkToolCall(block.name, block.input, { business, events, refs, timeZone, now });
            if (checked && !cards.some((c) => c.summary === checked.summary))
              cards.push({ ...checked, id: randomUUID(), messageId: replyId, status: "pending" });
          }
        }
        const usedTools = final.content.some((b) => b.type === "tool_use");
        if (usedTools && !text.trim()) {
          text = cards.length
            ? "Here's what I can update for you. Nothing changes until you tap Approve."
            : "I wasn't able to set that up. Could you tell me again, a little differently?";
          send({ type: "text", text });
        } else if (usedTools && cards.length === 0) {
          const note = "\n\n(I couldn't set up that change. You can also do it yourself in Settings or the Calendar.)";
          text += note;
          send({ type: "text", text: note });
        }

        if (final.stop_reason === "max_tokens") {
          const note = "\n\n(I stopped there to keep things short. Ask me to keep going.)";
          text += note;
          send({ type: "text", text: note });
        }
        if (final.stop_reason === "refusal" && !text.trim()) {
          text = "I'm not able to help with that one. Is there something else about your business I can help with?";
          send({ type: "text", text });
        }
        if (!text.trim()) throw new Error("empty reply");

        const { error } = await db.from("chat_messages").insert([
          { id: randomUUID(), user_id: user.id, role: "user", content: message, created_at: userAt },
          {
            id: replyId,
            user_id: user.id,
            role: "assistant",
            content: text,
            // Both rows need every column: a bulk insert fills missing ones with null, not the default.
            created_at: new Date().toISOString(),
            model: final.model,
            input_tokens: final.usage.input_tokens,
            output_tokens: final.usage.output_tokens,
            cache_read_tokens: final.usage.cache_read_input_tokens ?? 0,
            cache_write_tokens: final.usage.cache_creation_input_tokens ?? 0,
            stop_reason: final.stop_reason,
          },
        ]);
        if (error) console.error("chat: couldn't save the messages", error.code);
        if (!error && cards.length) {
          const { error: cardError } = await db.from("chat_proposals").insert(
            cards.map((c) => ({ id: c.id, user_id: user.id, message_id: replyId, kind: c.change.kind, details: c.change, summary: c.summary })),
          );
          if (cardError) console.error("chat: couldn't save suggestion cards", cardError.code);
          else send({ type: "proposals", messageId: replyId, proposals: cards });
        }
        send({ type: "done", remaining: Math.max(0, limit - usedToday - 1) });
      } catch (error) {
        send({ type: "error", message: friendly(error, model) });
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort(); // they left the page: stop paying for a reply nobody will read
    },
  });

  return new Response(body$, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
