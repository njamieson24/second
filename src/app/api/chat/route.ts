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
// - Second can look up real local businesses on the map and their public emails (the same code,
//   caps and caches as the Outreach page; src/lib/chat-outreach.ts has the tools and checks).
//   Picks come back by result ID, are checked, and become cards built from the map data.
//   Nothing is ever sent. A message has a time budget, so a slow map never hangs the chat.
// - Every reply is saved with its token counts, so costs show in the database.
//
// POST { message, timeZone }  ->  a stream of ChatStreamEvent, one JSON object per line.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  type BusinessCard,
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
import {
  asksAboutBusinesses,
  wantsSearch,
  CHAT_OUTREACH_RULES,
  CHAT_RESULTS_SHOWN,
  checkFindArgs,
  checkPicks,
  clean,
  EMAIL_TOOL,
  FIND_TOOL,
  PICKS_TOOL,
  recentCardsBlock,
  resultsBlock,
  type Labeled,
  type Pick,
} from "@/lib/chat-outreach";
import { categoryLabel } from "@/lib/outreach";
import { checkWebsites, findEmailForLead, runSearch, toLead, type LeadRow } from "@/lib/outreach-server";
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
const PROPOSAL_NAMES = new Set(PROPOSAL_TOOLS.map((t) => t.name));

// Time budget for one message (the route may run 60 seconds): the map search must finish by
// 30 seconds in, website checks by 45, and the whole reply by about 50.
const SEARCH_BY_MS = 30_000;
const WEBSITES_BY_MS = 45_000;
const REPLY_BY_MS = 50_000;

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
  // The time budget counts from the start of the request (that's what maxDuration counts).
  const started = Date.now();
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
  const [biz, tasks, plan, txs, evs, history, today, notesRes, cardsRes, recentRes] = await Promise.all([
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
    // Business cards from the last week, so "find the email for the gym" works later.
    db
      .from("chat_business_cards")
      .select("lead_id, distance_mi, outreach_leads(*)")
      .eq("user_id", user.id)
      .gte("created_at", new Date(now.getTime() - 7 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(12),
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

  // Finding businesses: needs outreach.sql + chat-outreach.sql. Search only when they ask about
  // local businesses, partners or collabs (this message or their last one).
  const outreachReady = !recentRes.error;
  const lastAsk = [...past].reverse().find((m) => m.role === "user")?.content ?? "";
  const searchAllowed = outreachReady && asksAboutBusinesses(message, lastAsk);
  const recent: Labeled[] = [];
  for (const row of (recentRes.data ?? []) as unknown as { lead_id: string; distance_mi: number | null; outreach_leads: LeadRow | null }[]) {
    if (!row.outreach_leads || recent.some((r) => r.lead.id === row.lead_id) || recent.length >= 9) continue;
    recent.push({ label: `P${recent.length + 1}`, lead: { ...toLead(row.outreach_leads), distanceMi: row.distance_mi } });
  }
  const emailAllowed = outreachReady && (searchAllowed || recent.length > 0);
  const tools: Anthropic.Beta.BetaTool[] = [
    ...(memoryReady ? PROPOSAL_TOOLS : []),
    ...(searchAllowed ? [FIND_TOOL] : []),
    ...(emailAllowed ? [EMAIL_TOOL] : []),
  ];
  const rules = [SECOND_PERSONA, memoryReady ? TOOL_RULES : "", outreachReady ? CHAT_OUTREACH_RULES : ""].filter(Boolean).join("\n\n");
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: rules },
    { type: "text", text: [context, notesContext(notes), proposalsContext(recentCards), recentCardsBlock(recent)].filter(Boolean).join("\n\n") },
  ];
  const timeLeft = () => started + REPLY_BY_MS - Date.now();
  const base = {
    model,
    system,
    ...(thinks ? { output_config: { effort: "low" as const } } : {}),
    ...(fallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  };

  // "Could you find me a business to partner with?": search first (thinking models can't be forced).
  const mustSearch = searchAllowed && !thinks && wantsSearch(message);
  const stream = anthropic.beta.messages.stream({
    ...base,
    max_tokens: thinks ? 1500 : 600,
    ...(tools.length ? { tools } : {}),
    ...(mustSearch ? { tool_choice: { type: "tool" as const, name: FIND_TOOL.name } } : {}),
    messages,
  });

  const userAt = now.toISOString();
  const encoder = new TextEncoder();

  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      let text = "";
      const say = (piece: string) => {
        text += piece;
        send({ type: "text", text: piece });
      };
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      const count = (m: Anthropic.Beta.BetaMessage) => {
        usage.input += m.usage.input_tokens;
        usage.output += m.usage.output_tokens;
        usage.cacheRead += m.usage.cache_read_input_tokens ?? 0;
        usage.cacheWrite += m.usage.cache_creation_input_tokens ?? 0;
      };
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") say(event.delta.text);
        }
        let final: Anthropic.Beta.BetaMessage = await stream.finalMessage();
        count(final);
        const allBlocks: Anthropic.Beta.BetaContentBlock[] = [...final.content];

        // ---------- Tools that look things up (map search, email) ----------
        let searched: Labeled[] | null = null; // this message's results, B1, B2...
        let searchNote = "";
        let picks: Pick[] = [];
        const uses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
        if (final.stop_reason === "tool_use" && uses.some((u) => !PROPOSAL_NAMES.has(u.name))) {
          const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
          let emailCalls = 0;
          for (const use of uses) {
            const result = (content: string, isError = false): Anthropic.Beta.BetaToolResultBlockParam => ({ type: "tool_result", tool_use_id: use.id, content, ...(isError ? { is_error: true } : {}) });
            if (PROPOSAL_NAMES.has(use.name)) {
              results.push(result("Shown to the owner as a suggestion card. Nothing changes until they tap Approve."));
            } else if (use.name === FIND_TOOL.name) {
              if (!searchAllowed) results.push(result("Only search when they ask about local businesses, partners or collabs.", true));
              else if (searched) results.push(result("Only one search per message. Use the results you have.", true));
              else {
                const args = checkFindArgs(use.input, business);
                if (!args.ok) {
                  results.push(result(`Can't search: ${args.problem}`, true));
                  continue;
                }
                const where = `within ${args.radiusMi} miles of ${args.town}${args.state ? `, ${args.state}` : ""}`;
                send({ type: "status", text: `Looking at the map for ${categoryLabel(args.category).toLowerCase()} ${where}…` });
                searched = [];
                const r = await runSearch(db, user.id, business, { town: args.town, state: args.state, category: args.category, hideChains: true, radiusMi: args.radiusMi }, { saved: false, deadline: started + SEARCH_BY_MS });
                if (!r.ok) {
                  searchNote = r.reason;
                  const why =
                    r.reason === "busy"
                      ? "The map is busy right now, so there are no results."
                      : r.reason === "town"
                        ? `Couldn't find the town "${clean(args.town, 60)}". Ask them to check the town and state.`
                        : r.message;
                  results.push(result(`${why} Tell them kindly, and that they can try again in a minute or use the Outreach page. Don't name or make up any businesses.`, true));
                } else {
                  searched = r.leads.slice(0, CHAT_RESULTS_SHOWN).map((lead, n) => ({ label: `B${n + 1}`, lead }));
                  results.push(result(resultsBlock(searched, where)));
                }
              }
            } else if (use.name === EMAIL_TOOL.name) {
              const id = String((use.input as { result_id?: unknown })?.result_id ?? "").trim().toUpperCase();
              const target = [...(searched ?? []), ...recent].find((x) => x.label === id);
              if (!emailAllowed || !target) {
                results.push(result(`"${clean(id, 12)}" isn't a result_id from <map_results> or <recent_cards>. Only look up those.`, true));
                continue;
              }
              if (++emailCalls > 2) {
                results.push(result("At most 2 email lookups per message.", true));
                continue;
              }
              send({ type: "status", text: `Looking for ${clean(target.lead.name, 60)}'s email…` });
              // At most 25 seconds here; the card's Find email button has its own full minute.
              const wait = Math.max(1_000, Math.min(25_000, timeLeft() - 10_000));
              const e = await Promise.race([
                findEmailForLead(db, user.id, target.lead.id, { allowTavily: true }),
                new Promise<null>((resolve) => setTimeout(() => resolve(null), wait)),
              ]);
              if (!e) results.push(result("That lookup took too long. Tell them to tap Find email on the card in a minute.", true));
              else if (!e.ok) results.push(result(e.message, true));
              else {
                target.lead = e.lead;
                send({ type: "card_email", leadId: e.lead.id, email: e.lead.email, emailSource: e.lead.emailSource });
                results.push(
                  result(
                    e.found && e.lead.email
                      ? `${id}: public email ${clean(e.lead.email, 120)} (found on ${clean(e.lead.emailSource, 200)}).`
                      : `${id}: no public email found. Suggest their contact page or Instagram, or calling them.`,
                  ),
                );
              }
            } else results.push(result("Unknown tool.", true));
          }

          const followUp: Anthropic.Beta.BetaMessageParam[] = [...messages, { role: "assistant", content: final.content }, { role: "user", content: results }];
          const ids = new Set((searched ?? []).map((x) => x.label));
          if (searched && searched.length && !thinks) {
            // ---------- Picks: structured, checked, one retry ----------
            const allowedNumbers = new Set(business.services.flatMap((sv) => [String(sv.price), ...(sv.minutes ? [String(sv.minutes)] : [])]));
            let reply = "";
            for (let attempt = 0; attempt < 2 && timeLeft() > 6_000; attempt++) {
              const res = await anthropic.beta.messages.create(
                { ...base, max_tokens: 900, tools: [...tools, PICKS_TOOL], tool_choice: { type: "tool", name: PICKS_TOOL.name }, messages: followUp },
                { timeout: Math.max(5_000, timeLeft()) },
              );
              count(res);
              final = res;
              allBlocks.push(...res.content);
              const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === PICKS_TOOL.name);
              if (!call) break;
              const checked = checkPicks(call.input, ids, allowedNumbers);
              reply = checked.reply || reply;
              // Bad picks get one retry; if the retry is no better, keep the good ones from before.
              if (checked.good.length >= picks.length || !checked.problems.length) picks = checked.good;
              if (!checked.problems.length) break;
              followUp.push(
                { role: "assistant", content: res.content },
                { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please fix and call show_picks again: ${checked.problems.join("; ")}.` }] },
              );
            }
            if (reply) say(`${text.trim() ? "\n\n" : ""}${reply}`);
          } else if (timeLeft() > 6_000) {
            // ---------- Plain answer after the lookup (or a busy map) ----------
            const after = anthropic.beta.messages.stream(
              { ...base, max_tokens: thinks ? 1500 : 600, tools: searched ? [...tools, PICKS_TOOL] : tools, tool_choice: { type: "none" }, messages: followUp },
              { timeout: Math.max(5_000, timeLeft()) },
            );
            let first = true;
            for await (const event of after) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                say(`${first && text.trim() ? "\n\n" : ""}${event.delta.text}`);
                first = false;
              }
            }
            final = await after.finalMessage();
            count(final);
            allBlocks.push(...final.content);
          }
          if (!text.trim()) {
            say(
              searchNote === "busy"
                ? "The map is busy right now, so I couldn't look. Please try again in a minute, or use the Outreach page."
                : "I couldn't finish looking that up. Please try again in a minute.",
            );
          }
        }

        // ---------- Business cards: only checked picks, built from the map data ----------
        const replyId = randomUUID();
        let businessCards: BusinessCard[] = [];
        if (picks.length && searched) {
          const picked = picks.map((pk) => ({ pick: pk, lead: (searched as Labeled[]).find((x) => x.label === pk.resultId)!.lead }));
          send({ type: "status", text: "Checking their websites for an email…" });
          const checkedLeads = await checkWebsites(db, picked.map((x) => x.lead), Math.min(started + WEBSITES_BY_MS, Date.now() + 10_000));
          businessCards = picked.map(({ pick, lead }, n) => {
            const l = checkedLeads[n];
            return {
              id: randomUUID(),
              messageId: replyId,
              leadId: l.id,
              name: l.name,
              category: l.category,
              address: l.address,
              town: l.town,
              distanceMi: lead.distanceMi ?? null,
              website: l.website,
              phone: l.phone,
              email: l.email,
              emailSource: l.emailSource,
              saved: l.saved !== false,
              why: pick.why,
              dealIdea: pick.dealIdea,
              nextStep: pick.nextStep,
            };
          });
        }

        // Suggested updates: check each one; only good ones become cards.
        const cards: ChatProposal[] = [];
        const proposalBlocks = allBlocks.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && PROPOSAL_NAMES.has(b.name));
        if (final.stop_reason !== "max_tokens" && final.stop_reason !== "refusal") {
          for (const block of proposalBlocks) {
            if (cards.length >= MAX_PROPOSALS) break;
            const checked = checkToolCall(block.name, block.input, { business, events, refs, timeZone, now });
            if (checked && !cards.some((c) => c.summary === checked.summary))
              cards.push({ ...checked, id: randomUUID(), messageId: replyId, status: "pending" });
          }
        }
        if (proposalBlocks.length && !text.trim()) {
          say(
            cards.length
              ? "Here's what I can update for you. Nothing changes until you tap Approve."
              : "I wasn't able to set that up. Could you tell me again, a little differently?",
          );
        } else if (proposalBlocks.length && cards.length === 0) {
          say("\n\n(I couldn't set up that change. You can also do it yourself in Settings or the Calendar.)");
        }

        if (final.stop_reason === "max_tokens") say("\n\n(I stopped there to keep things short. Ask me to keep going.)");
        if (final.stop_reason === "refusal" && !text.trim())
          say("I'm not able to help with that one. Is there something else about your business I can help with?");
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
            input_tokens: usage.input,
            output_tokens: usage.output,
            cache_read_tokens: usage.cacheRead,
            cache_write_tokens: usage.cacheWrite,
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
        if (!error && businessCards.length) {
          const { error: pickError } = await db.from("chat_business_cards").insert(
            businessCards.map((c) => ({ id: c.id, user_id: user.id, message_id: replyId, lead_id: c.leadId, why: c.why, deal_idea: c.dealIdea, next_step: c.nextStep, distance_mi: c.distanceMi })),
          );
          if (pickError) console.error("chat: couldn't save business cards", pickError.code);
          else send({ type: "business_cards", messageId: replyId, cards: businessCards });
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
