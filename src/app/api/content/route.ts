// Content page: weekly post briefs and captions. Runs on the SERVER only.
//
// - Briefs: made the first time the owner opens Content each week (Monday start, their time zone),
//   then read from the database. "New ideas" works at most 2 times a week. A try is claimed in
//   content_weeks (unique on user + week + attempt) BEFORE the AI call.
// - Plain code works out the facts (the same as This Week, minus client names); one Haiku call
//   writes 5 briefs (what to post, format, 2-3 phone shots, hook, best day) with a tool; the server
//   checks them (health, prices, offers, client names, phone-only and one-person shots), retries
//   once, then uses plain-code briefs.
// - If This Week has a post action, it's the first idea, so the two pages agree.
// - Captions: one Haiku call (300 tokens), the caption and hashtags only, checked the same way.
//   Counts toward DRAFTS_DAILY_LIMIT (logged in draft_runs as 'caption').
// - Hooks: owners can edit them; the server checks the new hook before saving it.
// - Everything is read and written AS the owner (row level security). Briefs, hooks and captions
//   are never logged.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { IDEA_TRIES, IDEAS_PER_WEEK, type ContentPost, type ContentResponse, type ContentWeek, type PostFormat, type PostStatus, type PostType } from "@/lib/content";
import {
  briefFor,
  CAPTION_MAX_TOKENS,
  CAPTION_TOOL,
  captionPrompt,
  checkCaption,
  checkIdeas,
  CONTENT_MODEL,
  contentFacts,
  daysLeftInWeek,
  fallbackIdeas,
  hookProblems,
  IDEAS_MAX_TOKENS,
  keepGoodIdeas,
  IDEAS_SYSTEM,
  ideasTool,
  localTags,
  type PlannedIdea,
  type TextRules,
} from "@/lib/content-plan";
import { toBusiness, toEvent, toTransaction, type BusinessRow, type EventRow, type TransactionRow } from "@/lib/db-rows";
import { formatMoney, knownClientNames } from "@/lib/money";
import { gatherFacts, intSetting, validTimeZone } from "@/lib/server-facts";
import type { Business, Mode } from "@/lib/store";
import { addDaysToKey, dateKeyIn } from "@/lib/timezone";
import { DRAFTS_DAILY_LIMIT } from "@/lib/week";
import { mondayOf } from "@/lib/week-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;
const PENDING_FOR_MS = 90_000;

const send = (body: ContentResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

type BatchRow = { id: string; mode: Mode; attempt: number; fallback: boolean; status: "pending" | "ready"; created_at: string };
type PostRow = {
  id: string;
  week_start: string;
  position: number;
  type: PostType;
  title: string;
  why: string;
  source: ContentPost["source"];
  plan_action_id: string | null;
  day: string;
  status: PostStatus;
  format: PostFormat | null;
  shots: string[] | null;
  hook: string | null;
  caption: string | null;
  posted_at: string | null;
};
const toPost = (r: PostRow): ContentPost => ({
  id: r.id,
  weekStart: r.week_start,
  position: r.position,
  type: r.type,
  title: r.title,
  why: r.why,
  source: r.source,
  day: r.day,
  status: r.status,
  format: r.format ?? null,
  shots: Array.isArray(r.shots) ? r.shots : null,
  hook: r.hook ?? null,
  caption: r.caption,
  postedAt: r.posted_at,
});

const servicesLine = (b: Business) => b.services.map((s) => `${s.name} ${formatMoney(s.price)}${s.minutes ? ` (${s.minutes} min)` : ""}`).join("; ");

async function clientNamesOf(db: SupabaseClient, userId: string): Promise<string[]> {
  const [txs, evs] = await Promise.all([db.from("transactions").select("*").eq("user_id", userId), db.from("events").select("*").eq("user_id", userId)]);
  return knownClientNames(((txs.data ?? []) as TransactionRow[]).map(toTransaction), ((evs.data ?? []) as EventRow[]).map(toEvent));
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send({ status: "error", message: "Content isn't set up yet." }, 500);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return send({ status: "error", message: "Please log in." }, 401);
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return send({ status: "error", message: "Please log in again." }, 401);

  const body = (await request.json().catch(() => ({}))) as { action?: string; postId?: unknown; hook?: unknown; timeZone?: unknown };
  const timeZone = validTimeZone(body.timeZone);
  const now = new Date(Date.now() + intSetting("PLAN_WEEK_OFFSET", 0) * 7 * DAY);
  const today = dateKeyIn(now, timeZone);
  const weekStart = mondayOf(today);
  const postId = typeof body.postId === "string" ? body.postId : "";

  const bizRes = await db.from("businesses").select("*").eq("user_id", user.id).maybeSingle();
  const business = toBusiness(bizRes.data as BusinessRow | null);
  if (!business) return send({ status: "error", message: "Please finish setting up your business first." }, 400);
  const mode: Mode = (bizRes.data as { mode?: Mode }).mode === "launch" ? "launch" : "running";
  const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 }) : null;

  if (body.action === "caption") return writeCaption(db, user.id, anthropic, business, postId, mode);
  if (body.action === "hook") return saveHook(db, user.id, business, postId, typeof body.hook === "string" ? body.hook : "");

  // ---------- Briefs ----------
  const batchesRes = await db.from("content_weeks").select("id, mode, attempt, fallback, status, created_at").eq("user_id", user.id).eq("week_start", weekStart).order("attempt", { ascending: false });
  if (batchesRes.error) {
    console.error("content: content_weeks problem", batchesRes.error.code);
    return send({ status: "error", message: "Content isn't set up yet." }, 500);
  }
  const batches = (batchesRes.data ?? []) as BatchRow[];
  const aiTries = batches.filter((b) => !b.fallback).length;
  const latest = batches[0];
  const stuck = latest?.status === "pending" && Date.now() - Date.parse(latest.created_at) > PENDING_FOR_MS;
  if (latest?.status === "pending" && !stuck) return send({ status: "pending" });

  const pinned = await thisWeekPost(db, user.id, weekStart);

  if (body.action === "new") {
    if (aiTries >= IDEA_TRIES) return send({ status: "error", message: "You've used this week's new ideas. Fresh ones come next Monday." }, 429);
  } else if (latest && !stuck) {
    const fresh = latest.mode === mode && Date.parse(latest.created_at) >= Date.parse(business.createdAt);
    const posts = await weekPosts(db, user.id, weekStart);
    if (fresh && posts.length > 0) {
      await syncPinned(db, user.id, weekStart, today, pinned, business);
      return send({ status: "ready", week: weekOf(weekStart, await weekPosts(db, user.id, weekStart), aiTries) });
    }
  }

  // ---------- Make briefs: claim the try FIRST ----------
  const useAI = aiTries < IDEA_TRIES && anthropic !== null;
  const batchId = randomUUID();
  const claim = await db.from("content_weeks").insert({ id: batchId, user_id: user.id, week_start: weekStart, mode, attempt: (latest?.attempt ?? 0) + 1, fallback: !useAI, status: "pending" });
  if (claim.error) {
    if (claim.error.code === "23505") return send({ status: "pending" });
    console.error("content: couldn't claim a try", claim.error.code);
    return send({ status: "error", message: "We couldn't make your ideas just now. Please try again." }, 500);
  }

  const { facts, transactions, events } = await gatherFacts(db, user.id, business, mode, weekStart, now, timeZone);
  const rules: TextRules = { servicePrices: business.services.map((s) => s.price), clientNames: knownClientNames(transactions, events), ownerText: facts.ownerText };
  const threeWeeksAgo = addDaysToKey(weekStart, -21);
  const [recentRes, postedRes] = await Promise.all([
    db.from("content_posts").select("type, title, week_start").eq("user_id", user.id).gte("week_start", threeWeeksAgo).order("week_start", { ascending: false }).limit(40),
    db.from("content_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "posted").gte("day", addDaysToKey(weekStart, -7)).lt("day", weekStart),
  ]);
  const recent = (recentRes.data ?? []) as { type: string; title: string }[];
  const recentTypes = [...new Set(recent.map((r) => r.type.replace(/_/g, " ")))];
  const recentTitles = recent.map((r) => r.title);
  const days = daysLeftInWeek(weekStart, today);
  const want = IDEAS_PER_WEEK - (pinned ? 1 : 0);
  const main = business.services[0] ? { name: business.services[0].name, price: business.services[0].price, minutes: business.services[0].minutes } : null;

  let ideas: PlannedIdea[] = fallbackIdeas(facts, mode, want, days.names, main);
  let usage = { model: null as string | null, input: 0, output: 0 };
  let aiOk = false;
  if (useAI && anthropic) {
    const text = contentFacts(facts, recentTypes, recentTitles, postedRes.count ?? 0, days.names);
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Facts for this week:\n${text}\n\nGive exactly ${want} post briefs.` }];
    try {
      for (let round = 0; round < 2; round++) {
        const res = await anthropic.messages.create({
          model: CONTENT_MODEL,
          max_tokens: IDEAS_MAX_TOKENS,
          system: IDEAS_SYSTEM,
          tools: [ideasTool(days.names)],
          tool_choice: { type: "tool", name: "save_post_ideas" },
          messages,
        });
        usage = { model: res.model, input: usage.input + res.usage.input_tokens, output: usage.output + res.usage.output_tokens };
        const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const checked =
          res.stop_reason === "max_tokens" || !call
            ? { ok: false as const, problems: ["the list was cut off; keep it shorter"] }
            : checkIdeas(call.input, want, facts, mode, days.names, recentTitles, rules);
        if (checked.ok) {
          ideas = checked.ideas;
          aiOk = true;
          break;
        }
        if (round === 1 && checked.ideas && checked.bad) {
          // Second try still has problems: keep the good AI briefs, swap only the failing ones.
          const kept = keepGoodIdeas(checked.ideas, checked.bad, ideas, mode);
          if (kept) {
            ideas = kept;
            aiOk = true;
          }
          break;
        }
        if (!call) break;
        messages.push(
          { role: "assistant", content: res.content },
          { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please fix and send all ${want} again: ${checked.problems.join("; ")}.` }] },
        );
      }
    } catch (error) {
      console.error("content: ideas call failed", error instanceof Anthropic.APIError ? error.status : "network");
    }
  }

  // "New ideas" replaces only this week's untouched ideas; drafted, ready and posted ones stay.
  const existing = await weekPosts(db, user.id, weekStart);
  if (body.action === "new") {
    const replace = existing.filter((p) => p.status === "idea" && p.source !== "this_week").map((p) => p.id);
    if (replace.length) await db.from("content_posts").delete().in("id", replace);
  }
  const startAt = Math.max(0, ...existing.map((p) => p.position)) + 1;
  const rows = ideas.map((idea, i) => {
    const day = days.dateOf(idea.day);
    return {
      id: randomUUID(),
      user_id: user.id,
      batch_id: batchId,
      week_start: weekStart,
      position: startAt + i,
      type: idea.type,
      title: idea.title,
      why: idea.why,
      source: aiOk ? "ai" : "fallback",
      day: day < today ? today : day,
      status: "idea",
      format: idea.format,
      shots: idea.shots,
      hook: idea.hook,
    };
  });
  const saved = await db.from("content_posts").insert(rows);
  await syncPinned(db, user.id, weekStart, today, pinned, business);
  await db.from("content_weeks").update({ status: "ready", model: usage.model, input_tokens: usage.input, output_tokens: usage.output }).eq("id", batchId);
  if (saved.error) {
    console.error("content: couldn't save ideas", saved.error.code);
    return send({ status: "error", message: "We couldn't save your ideas. Please refresh the page." }, 500);
  }
  return send({ status: "ready", week: weekOf(weekStart, await weekPosts(db, user.id, weekStart), aiTries + (useAI ? 1 : 0)) });
}

function weekOf(weekStart: string, posts: ContentPost[], aiTries: number): ContentWeek {
  const ideas = [...posts].sort((a, b) => (a.source === "this_week" ? -1 : b.source === "this_week" ? 1 : a.position - b.position));
  return { weekStart, ideas, newIdeasLeft: Math.max(0, IDEA_TRIES - Math.max(1, aiTries)) };
}

async function weekPosts(db: SupabaseClient, userId: string, weekStart: string): Promise<ContentPost[]> {
  const { data } = await db.from("content_posts").select("*").eq("user_id", userId).eq("week_start", weekStart).order("position");
  return ((data ?? []) as PostRow[]).map(toPost);
}

/** This Week's post action (if any), so the two pages agree. */
async function thisWeekPost(db: SupabaseClient, userId: string, weekStart: string) {
  const plan = await db.from("weekly_plans").select("id").eq("user_id", userId).eq("week_start", weekStart).eq("status", "ready").order("attempt", { ascending: false }).limit(1);
  const planId = plan.data?.[0]?.id as string | undefined;
  if (!planId) return null;
  const { data } = await db.from("plan_actions").select("id, title, why, draft").eq("plan_id", planId).eq("type", "post").order("position").limit(1);
  return (data?.[0] as { id: string; title: string; why: string; draft: string | null } | undefined) ?? null;
}

/** Make sure This Week's post is the first idea (once), with a ready-made brief. */
async function syncPinned(
  db: SupabaseClient,
  userId: string,
  weekStart: string,
  today: string,
  pinned: { id: string; title: string; why: string; draft: string | null } | null,
  business: Business,
) {
  if (!pinned) return;
  const { data } = await db.from("content_posts").select("id").eq("user_id", userId).eq("plan_action_id", pinned.id).limit(1);
  if (data?.length) return;
  const s = business.services[0];
  const brief = briefFor("promo", { service: s ? { name: s.name, price: s.price, minutes: s.minutes } : null, freeDayNames: [], daysToOpening: null });
  await db.from("content_posts").insert({
    id: randomUUID(),
    user_id: userId,
    week_start: weekStart,
    position: 0,
    type: "promo",
    title: pinned.title.slice(0, 100),
    why: pinned.why.slice(0, 200),
    source: "this_week",
    plan_action_id: pinned.id,
    day: today,
    status: pinned.draft ? "drafted" : "idea",
    caption: pinned.draft,
    ...brief,
  });
}

/** "Write caption": the caption and hashtags that follow the hook, checked, saved. */
async function writeCaption(db: SupabaseClient, userId: string, anthropic: Anthropic | null, business: Business, postId: string, mode: Mode) {
  if (!anthropic) return send({ status: "error", message: "Captions aren't working right now. Please try again later." }, 500);
  const dayAgo = new Date(Date.now() - DAY).toISOString();
  const [count, postRes] = await Promise.all([
    db.from("draft_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", dayAgo),
    db.from("content_posts").select("*").eq("id", postId).maybeSingle(),
  ]);
  const limit = intSetting("DRAFTS_DAILY_LIMIT", DRAFTS_DAILY_LIMIT);
  if ((count.count ?? 0) >= limit) return send({ status: "error", message: `You've written today's ${limit} drafts and captions. You can write more tomorrow.` }, 429);
  const post = postRes.data as PostRow | null;
  if (!post) return send({ status: "error", message: "We couldn't find that idea. Please refresh the page." }, 404);

  const [notesRes, clientNames] = await Promise.all([
    db.from("business_notes").select("note").eq("user_id", userId).order("updated_at", { ascending: false }).limit(10),
    clientNamesOf(db, userId),
  ]);
  const tags = localTags(business.area);
  const prompt = captionPrompt({
    idea: { type: post.type, title: post.title, why: post.why, format: post.format, hook: post.hook },
    tone: business.contentTone ?? "warm",
    business: { ownerName: business.ownerName, businessName: business.businessName, typeLabel: business.typeLabel, area: business.area, services: servicesLine(business) },
    notes: (notesRes.data ?? []).map((n) => n.note as string),
    localTags: tags,
    openingDay: mode === "launch" ? business.openingDay ?? null : null,
  });

  let caption: string | null = null;
  let usage = { model: CONTENT_MODEL, input: 0, output: 0 };
  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt.user }];
    for (let round = 0; round < 2; round++) {
      const res = await anthropic.messages.create({
        model: CONTENT_MODEL,
        max_tokens: CAPTION_MAX_TOKENS,
        system: prompt.system,
        tools: [CAPTION_TOOL],
        tool_choice: { type: "tool", name: CAPTION_TOOL.name },
        messages,
      });
      usage = { model: res.model, input: usage.input + res.usage.input_tokens, output: usage.output + res.usage.output_tokens };
      const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const candidate = ((call?.input as { caption?: string } | undefined)?.caption ?? "").trim();
      const problems =
        res.stop_reason === "max_tokens" || !call
          ? ["the caption was cut off; keep it shorter"]
          : checkCaption(candidate, { servicePrices: business.services.map((s) => s.price), clientNames, localTags: tags, hook: post.hook });
      if (!problems.length) {
        caption = candidate;
        break;
      }
      if (!call) break;
      messages.push(
        { role: "assistant", content: res.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please rewrite it: ${problems.join("; ")}.` }] },
      );
    }
  } catch (error) {
    console.error("content: caption call failed", error instanceof Anthropic.APIError ? error.status : "network");
    return send({ status: "error", message: "Second is a bit busy right now. Please try again in a minute." }, 502);
  } finally {
    if (usage.input > 0) {
      const { error } = await db.from("draft_runs").insert({ user_id: userId, action_type: "caption", model: usage.model, input_tokens: usage.input, output_tokens: usage.output });
      if (error) console.error("content: couldn't log the caption", error.code);
    }
  }
  if (!caption) return send({ status: "error", message: "We couldn't write a good caption for that one. Please try again." }, 502);

  const status: PostStatus = post.status === "idea" ? "drafted" : post.status;
  const saved = await db.from("content_posts").update({ caption, status }).eq("id", post.id);
  if (saved.error) console.error("content: couldn't save the caption", saved.error.code);
  if (post.plan_action_id) await db.from("plan_actions").update({ draft: caption }).eq("id", post.plan_action_id);
  return send({ status: "caption", caption });
}

/** Save an edited hook after the same checks as the brief (health, prices, offers, client names). */
async function saveHook(db: SupabaseClient, userId: string, business: Business, postId: string, hook: string) {
  const text = hook.replace(/\s+/g, " ").trim();
  const problems = hookProblems(text, { servicePrices: business.services.map((s) => s.price), clientNames: await clientNamesOf(db, userId), ownerText: "" });
  if (problems.length) return send({ status: "error", message: `Please change the hook: ${problems.join("; ")}.` }, 400);
  const { error } = await db.from("content_posts").update({ hook: text }).eq("id", postId);
  if (error) {
    console.error("content: couldn't save the hook", error.code);
    return send({ status: "error", message: "We couldn't save the hook. Please try again." }, 500);
  }
  return send({ status: "hook", hook: text });
}
