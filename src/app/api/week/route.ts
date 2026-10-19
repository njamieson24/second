// "This Week": the weekly game plan and "Do it with Second" drafts. Runs on the SERVER only.
//
// - Made the first time the owner opens Home each week (Monday start, their time zone).
//   Inactive owners cost nothing. After that, the plan is read from the database.
// - Plain code works out the facts (src/lib/week-facts.ts); one Haiku call picks 3 actions
//   with a tool; the server checks them (src/lib/week-plan.ts), retries once, and otherwise
//   uses a plan made by plain code. Nobody ever gets an empty card.
// - A try is CLAIMED in the database before the AI call. weekly_plans is unique on
//   (user, week, attempt), so two tabs or a fast reload can't make or pay for two plans.
// - At most PLAN_TRIES AI plans a week (first + 2 redos) and DRAFTS_DAILY_LIMIT drafts a day.
// - Everything is read and written AS the owner (row level security). Plan text, drafts and
//   facts are never logged.
// - PLAN_WEEK_OFFSET (server-only, TESTS ONLY, never set in Vercel) pretends it's N weeks later.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { toBusiness, toEvent, toTransaction, type BusinessRow, type EventRow, type TransactionRow } from "@/lib/db-rows";
import { withCatalog } from "@/lib/catalog-server";
import { formatMoney, knownClientNames } from "@/lib/money";
import type { Business, Mode } from "@/lib/store";
import { dateKeyIn } from "@/lib/timezone";
import { DRAFTS_DAILY_LIMIT, PLAN_TRIES, type ActionStatus, type ActionType, type PlanAction, type WeekPlan, type WeekResponse } from "@/lib/week";
import { mondayOf } from "@/lib/week-facts";
import { gatherFacts, intSetting, validTimeZone } from "@/lib/server-facts";
import {
  checkDraft,
  checkPlan,
  DRAFT_MAX_TOKENS,
  draftPrompt,
  fallbackPlan,
  PLAN_MAX_TOKENS,
  PLAN_SYSTEM,
  PLAN_TOOL,
  WEEK_MODEL,
  type PlannedAction,
} from "@/lib/week-plan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PENDING_FOR_MS = 90_000; // a claimed try older than this is treated as stuck
const DAY = 86_400_000;

const send = (body: WeekResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });


type PlanRow = { id: string; week_start: string; mode: Mode; attempt: number; fallback: boolean; status: "pending" | "ready"; created_at: string };
type ActionRow = {
  id: string;
  position: number;
  type: ActionType;
  title: string;
  why: string;
  client_first_name: string | null;
  draft: string | null;
  status: ActionStatus;
};
const toAction = (r: ActionRow): PlanAction => ({
  id: r.id,
  position: r.position,
  type: r.type,
  title: r.title,
  why: r.why,
  clientFirstName: r.client_first_name,
  draft: r.draft,
  status: r.status,
});

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send({ status: "error", message: "This Week isn't set up yet." }, 500);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return send({ status: "error", message: "Please log in." }, 401);
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return send({ status: "error", message: "Please log in again." }, 401);

  const body = (await request.json().catch(() => ({}))) as { action?: string; actionId?: unknown; timeZone?: unknown };
  const timeZone = validTimeZone(body.timeZone);
  const now = new Date(Date.now() + intSetting("PLAN_WEEK_OFFSET", 0) * 7 * DAY);
  const weekStart = mondayOf(dateKeyIn(now, timeZone));

  const bizRes = await db.from("businesses").select("*").eq("user_id", user.id).maybeSingle();
  const business = await withCatalog(db, user.id, toBusiness(bizRes.data as BusinessRow | null));
  if (!business) return send({ status: "error", message: "Please finish setting up your business first." }, 400);
  const mode: Mode = (bizRes.data as { mode?: Mode }).mode === "launch" ? "launch" : "running";

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey, maxRetries: 1, timeout: 25_000 }) : null;

  if (body.action === "draft") return makeDraft(db, user.id, anthropic, business, typeof body.actionId === "string" ? body.actionId : "");

  // ---------- The plan ----------
  const plansRes = await db.from("weekly_plans").select("id, week_start, mode, attempt, fallback, status, created_at").eq("user_id", user.id).eq("week_start", weekStart).order("attempt", { ascending: false });
  if (plansRes.error) {
    console.error("week: weekly_plans problem", plansRes.error.code);
    return send({ status: "error", message: "This Week isn't set up yet." }, 500);
  }
  const plans = (plansRes.data ?? []) as PlanRow[];
  const aiTries = plans.filter((p) => !p.fallback).length;
  const latest = plans[0];
  const stuck = latest?.status === "pending" && Date.now() - Date.parse(latest.created_at) > PENDING_FOR_MS;
  if (latest?.status === "pending" && !stuck) return send({ status: "pending" });

  if (body.action === "redo") {
    if (aiTries >= PLAN_TRIES) return send({ status: "error", message: "You've used this week's redos. A fresh plan comes next Monday." }, 429);
  } else if (latest && !stuck) {
    // A good plan exists: just read it (no AI). It's replaced only after Start over or a mode switch.
    const actions = await db.from("plan_actions").select("*").eq("plan_id", latest.id).order("position");
    const fresh = latest.mode === mode && Date.parse(latest.created_at) >= Date.parse(business.createdAt);
    if (fresh && (actions.data ?? []).length === 3)
      return send({ status: "ready", plan: planOf(weekStart, (actions.data as ActionRow[]).map(toAction), aiTries, latest.fallback) });
  }

  // ---------- Make a new plan: claim the try FIRST ----------
  const useAI = aiTries < PLAN_TRIES && anthropic !== null;
  const planId = randomUUID();
  const claim = await db.from("weekly_plans").insert({
    id: planId,
    user_id: user.id,
    week_start: weekStart,
    mode,
    attempt: (latest?.attempt ?? 0) + 1,
    fallback: !useAI,
    status: "pending",
  });
  if (claim.error) {
    if (claim.error.code === "23505") return send({ status: "pending" }); // another tab got there first
    console.error("week: couldn't claim a try", claim.error.code);
    return send({ status: "error", message: "We couldn't make your plan just now. Please try again." }, 500);
  }

  const facts = await gatherFacts(db, user.id, business, mode, weekStart, now, timeZone);
  let actions: PlannedAction[] = fallbackPlan(facts.facts, mode);
  let usage = { model: null as string | null, input: 0, output: 0 };
  let usedFallback = !useAI;

  if (useAI && anthropic) {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Facts for this week:\n${facts.facts.text}` }];
    try {
      for (let round = 0; round < 2; round++) {
        const res = await anthropic.messages.create({
          model: WEEK_MODEL,
          max_tokens: PLAN_MAX_TOKENS,
          system: PLAN_SYSTEM,
          tools: [PLAN_TOOL],
          tool_choice: { type: "tool", name: PLAN_TOOL.name },
          messages,
        });
        usage = { model: res.model, input: usage.input + res.usage.input_tokens, output: usage.output + res.usage.output_tokens };
        const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const checked = res.stop_reason === "max_tokens" || !call ? { ok: false as const, problems: ["the plan was cut off; keep it shorter"] } : checkPlan(call.input, facts.facts, mode, []);
        if (checked.ok) {
          actions = checked.actions;
          usedFallback = false;
          break;
        }
        usedFallback = true;
        if (!call) break;
        messages.push(
          { role: "assistant", content: res.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please fix and send all 3 again: ${checked.problems.join("; ")}.` }] },
        );
      }
    } catch (error) {
      console.error("week: plan call failed", error instanceof Anthropic.APIError ? error.status : "network");
      usedFallback = true;
    }
  }

  const rows = actions.map((a, i) => ({
    id: randomUUID(),
    user_id: user.id,
    plan_id: planId,
    position: i + 1,
    type: a.type,
    title: a.title,
    why: a.why,
    client_first_name: a.clientFirstName,
  }));
  const saved = await db.from("plan_actions").insert(rows);
  await db
    .from("weekly_plans")
    .update({ status: "ready", model: usage.model, input_tokens: usage.input, output_tokens: usage.output })
    .eq("id", planId);
  if (saved.error) {
    console.error("week: couldn't save the actions", saved.error.code);
    return send({ status: "error", message: "We couldn't save your plan. Please refresh the page." }, 500);
  }
  const tries = aiTries + (useAI ? 1 : 0);
  return send({
    status: "ready",
    plan: planOf(
      weekStart,
      rows.map((r) => ({ id: r.id, position: r.position, type: r.type, title: r.title, why: r.why, clientFirstName: r.client_first_name, draft: null, status: "open" })),
      tries,
      usedFallback,
    ),
  });
}

function planOf(weekStart: string, actions: PlanAction[], aiTries: number, fallback: boolean): WeekPlan {
  return { weekStart, actions, redosLeft: Math.max(0, PLAN_TRIES - Math.max(1, aiTries)), fallback };
}


/** "Do it with Second": one small Haiku call, checked, saved on the action. */
async function makeDraft(
  db: SupabaseClient,
  userId: string,
  anthropic: Anthropic | null,
  business: Business,
  actionId: string,
) {
  if (!anthropic) return send({ status: "error", message: "Drafts aren't working right now. Please try again later." }, 500);
  const dayAgo = new Date(Date.now() - DAY).toISOString();
  const [count, actionRes] = await Promise.all([
    db.from("draft_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", dayAgo),
    db.from("plan_actions").select("*").eq("id", actionId).maybeSingle(),
  ]);
  const limit = intSetting("DRAFTS_DAILY_LIMIT", DRAFTS_DAILY_LIMIT);
  if ((count.count ?? 0) >= limit)
    return send({ status: "error", message: `You've made today's ${limit} drafts. You can make more tomorrow.` }, 429);
  const action = actionRes.data as ActionRow | null;
  if (!action) return send({ status: "error", message: "We couldn't find that action. Please refresh the page." }, 404);

  const [notesRes, txs, evs, chat] = await Promise.all([
    db.from("business_notes").select("note").eq("user_id", userId).order("updated_at", { ascending: false }).limit(15),
    db.from("transactions").select("*").eq("user_id", userId),
    db.from("events").select("*").eq("user_id", userId),
    db.from("chat_messages").select("content").eq("user_id", userId).eq("role", "user").limit(40),
  ]);
  const notes = (notesRes.data ?? []).map((n) => n.note as string);
  const ownNames = [business.area, business.businessName, business.ownerName, ...business.services.map((s) => s.name), action.client_first_name ?? ""];
  const ownerText = [...ownNames, ...notes, ...(chat.data ?? []).map((m) => m.content as string)].join("\n");
  // The full name stays here, only to check the draft doesn't use it.
  const fullName =
    action.client_first_name
      ? knownClientNames(((txs.data ?? []) as TransactionRow[]).map(toTransaction), ((evs.data ?? []) as EventRow[]).map(toEvent)).find(
          (n) => n.split(/\s+/)[0].toLowerCase() === action.client_first_name!.toLowerCase(),
        ) ?? null
      : null;

  const prompt = draftPrompt(
    { type: action.type, title: action.title, why: action.why, clientFirstName: action.client_first_name },
    {
      ownerName: business.ownerName,
      typeLabel: business.typeLabel,
      area: business.area,
      services: business.services.map((s) => `${s.name} ${formatMoney(s.price)}${s.minutes ? ` (${s.minutes} min)` : ""}`).join("; "),
    },
    notes,
  );

  let draft = "";
  let usage = { model: WEEK_MODEL, input: 0, output: 0 };
  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt.user }];
    for (let round = 0; round < 2; round++) {
      const res = await anthropic.messages.create({ model: WEEK_MODEL, max_tokens: DRAFT_MAX_TOKENS[action.type], system: prompt.system, messages });
      usage = { model: res.model, input: usage.input + res.usage.input_tokens, output: usage.output + res.usage.output_tokens };
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
      const problems = checkDraft(text, action.type, fullName, ownerText);
      if (!problems.length) {
        draft = text;
        break;
      }
      messages.push({ role: "assistant", content: text || "(empty)" }, { role: "user", content: `Please rewrite it: ${problems.join("; ")}.` });
    }
  } catch (error) {
    console.error("week: draft call failed", error instanceof Anthropic.APIError ? error.status : "network");
    return send({ status: "error", message: "Second is a bit busy right now. Please try again in a minute." }, 502);
  } finally {
    if (usage.input > 0) {
      const { error } = await db.from("draft_runs").insert({ user_id: userId, action_type: action.type, model: usage.model, input_tokens: usage.input, output_tokens: usage.output });
      if (error) console.error("week: couldn't log the draft", error.code);
    }
  }
  if (!draft) return send({ status: "error", message: "We couldn't write a good draft for that one. Please try again." }, 502);
  const saved = await db.from("plan_actions").update({ draft: draft.slice(0, 3000) }).eq("id", action.id);
  if (saved.error) console.error("week: couldn't save the draft", saved.error.code);
  return send({ status: "draft", draft });
}
