// "Find prices Second already knows". Runs on the SERVER only.
//
// - Only when the owner taps the button. One Haiku call, at most EXTRACT_DAILY_LIMIT a day,
//   logged in catalog_runs (supabase/catalog-b.sql).
// - Reads their business notes and the price cards they approved in chat. Never chat history.
// - Returns a DRAFT. Nothing is saved here: the owner reviews it and approves it once, and
//   store.ts saves it through the normal catalog path (the database checks every price again).
// - ANTHROPIC_API_KEY is read only here. Never logged.

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { checkDraft, EXTRACT_DAILY_LIMIT, EXTRACT_MAX_TOKENS, EXTRACT_MODEL, EXTRACT_SYSTEM, EXTRACT_TOOL, extractPrompt, type CatalogResponse, type ExtractSource } from "@/lib/catalog-extract";
import { loadCatalog } from "@/lib/catalog-server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const send = (body: CatalogResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send({ status: "error", message: "This isn't set up yet." }, 500);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return send({ status: "error", message: "Please log in." }, 401);
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return send({ status: "error", message: "Please log in again." }, 401);

  const body = (await request.json().catch(() => ({}))) as { action?: unknown };
  if (body.action !== "extract") return send({ status: "error", message: "Something went wrong. Please try again." }, 400);
  if (!process.env.ANTHROPIC_API_KEY) return send({ status: "error", message: "Second can't look right now. Please try again later." }, 500);

  // At most a few runs a day.
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const runs = await db.from("catalog_runs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
  if (runs.error) {
    console.error("catalog: runs table", runs.error.code);
    return send({ status: "error", message: "This needs a quick database update. Please try again later." }, 500);
  }
  if ((runs.count ?? 0) >= EXTRACT_DAILY_LIMIT) return send({ status: "error", message: `You've looked ${EXTRACT_DAILY_LIMIT} times today. You can look again tomorrow.` }, 429);

  // Sources: business notes and approved price cards (never chat messages).
  const [catalog, notesRes, cardsRes] = await Promise.all([
    loadCatalog(db, user.id),
    db.from("business_notes").select("note").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(60),
    db.from("chat_proposals").select("summary").eq("user_id", user.id).eq("status", "approved").in("kind", ["set_price", "add_service"]).order("created_at", { ascending: false }).limit(30),
  ]);
  const sources: ExtractSource[] = [
    ...((notesRes.data ?? []) as { note: string }[]).map((n, k) => ({ ref: `N${k + 1}`, kind: "note" as const, text: n.note })),
    ...((cardsRes.data ?? []) as { summary: string }[]).map((c, k) => ({ ref: `A${k + 1}`, kind: "card" as const, text: c.summary })),
  ].filter((s) => /\d/.test(s.text)); // only ones with a number can hold a price
  if (!sources.length) return send({ status: "draft", lines: [], questions: [], dropped: 0, message: "Second didn't find any prices in your notes yet. As you mention prices in chat, they'll show up here." });

  // One try, 20 seconds: a slow or failed call ends inside this route's 30 seconds, so it's
  // always logged below (and counts toward the daily limit).
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 20_000 });
  try {
    const res = await anthropic.messages.create({
      model: EXTRACT_MODEL,
      max_tokens: EXTRACT_MAX_TOKENS,
      system: EXTRACT_SYSTEM,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "tool", name: EXTRACT_TOOL.name },
      messages: [{ role: "user", content: extractPrompt(catalog, sources) }],
    });
    const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const draft = checkDraft(call?.input, catalog, sources);
    const offered = Array.isArray((call?.input as { lines?: unknown[] } | undefined)?.lines) ? (call!.input as { lines: unknown[] }).lines.length : 0;
    const { error } = await db.from("catalog_runs").insert({ user_id: user.id, model: res.model, input_tokens: res.usage.input_tokens, output_tokens: res.usage.output_tokens, offered: Math.min(offered, 200), dropped: Math.min(draft.dropped, 200) });
    if (error) console.error("catalog: couldn't log the run", error.code);
    return send({
      status: "draft",
      ...draft,
      ...(draft.lines.length || draft.questions.length ? {} : { message: "Everything Second found is already in your list." }),
    });
  } catch (error) {
    console.error("catalog: extract failed", error instanceof Anthropic.APIError ? error.status : "network");
    // A failed run still counts toward the daily limit (so retrying can't run up the bill).
    const { error: logError } = await db.from("catalog_runs").insert({ user_id: user.id, model: `${EXTRACT_MODEL} (failed)`, input_tokens: 0, output_tokens: 0, offered: 0, dropped: 0 });
    if (logError) console.error("catalog: couldn't log the failed run", logError.code);
    return send({ status: "error", message: "Second is a bit busy right now. Please try again in a minute." }, 502);
  }
}
