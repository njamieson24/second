// "Your matches this week": a few local businesses worth teaming up with, each with why and a
// deal idea. Runs on the SERVER only.
//
// - Once per person per week (Monday start, owner's time zone). The week is CLAIMED in
//   match_runs (unique on user + week) BEFORE the work, so refreshes and two tabs can't run or
//   pay for it twice. Onboarding's run is that week's run (Home reuses it).
// - One map search (the same code and 20-a-day quota as Outreach) + one Haiku picks call (the
//   same checks as chat: result IDs only, real catalog prices, no guesses). No email lookups:
//   those only happen when the owner taps Draft email on a business.
// - If it fails: the last saved matches, or nothing. Never an error screen.
// - ANTHROPIC_API_KEY is read only here. Never logged.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { activeItems, activeVariants, entryName, servicesFromCatalog } from "@/lib/catalog";
import { loadCatalog } from "@/lib/catalog-server";
import { CHAT_OUTREACH_RULES, CHAT_RESULTS_SHOWN, checkFindArgs, checkPicks, partnerHint, PARTNERS, PICKS_TOOL, resultsBlock, type Labeled, type Pick } from "@/lib/chat-outreach";
import { toBusiness, type BusinessRow } from "@/lib/db-rows";
import type { Match, MatchesResponse } from "@/lib/matches";
import { formatMoney } from "@/lib/money";
import type { CategoryId } from "@/lib/outreach";
import { runSearch, toLead, type LeadRow } from "@/lib/outreach-server";
import { validTimeZone } from "@/lib/server-facts";
import { dateKeyIn } from "@/lib/timezone";
import { mondayOf } from "@/lib/week-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = "claude-haiku-4-5-20251001";
const MATCHES = 3;
/** A run still "pending" after this long was cut off: treat it as failed. */
const STUCK_MS = 120_000;

const send = (body: MatchesResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** The matches saved for one run, with their businesses. */
async function matchesOf(db: SupabaseClient, runId: string): Promise<Match[]> {
  const { data } = await db.from("partner_matches").select("id, why, deal_idea, distance_mi, position, outreach_leads(*)").eq("run_id", runId).order("position");
  return ((data ?? []) as unknown as { id: string; why: string; deal_idea: string; distance_mi: number | null; outreach_leads: LeadRow | null }[])
    .filter((m) => m.outreach_leads)
    .map((m) => ({ id: m.id, lead: { ...toLead(m.outreach_leads!), distanceMi: m.distance_mi }, why: m.why, dealIdea: m.deal_idea }));
}

/** The most recent run that worked (for when this week's didn't). */
async function lastSaved(db: SupabaseClient, userId: string): Promise<MatchesResponse> {
  const { data } = await db.from("match_runs").select("id").eq("user_id", userId).eq("status", "ready").order("week_start", { ascending: false }).limit(1);
  const run = data?.[0];
  if (!run) return { status: "none" };
  const matches = await matchesOf(db, run.id as string);
  return matches.length ? { status: "ready", matches, center: null, stale: true } : { status: "none" };
}

export async function POST(request: Request) {
  const started = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return send({ status: "error", message: "This isn't set up yet." }, 500);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return send({ status: "error", message: "Please log in." }, 401);
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return send({ status: "error", message: "Please log in again." }, 401);

  const body = (await request.json().catch(() => ({}))) as { action?: unknown; timeZone?: unknown; source?: unknown };
  if (body.action !== "get") return send({ status: "error", message: "Something went wrong." }, 400);
  const timeZone = validTimeZone(body.timeZone);
  const source = body.source === "onboarding" ? "onboarding" : "weekly";
  const weekStart = mondayOf(dateKeyIn(new Date(), timeZone));

  // ---------- This week's run already exists? ----------
  const existing = await db.from("match_runs").select("id, status, created_at").eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();
  if (existing.error) {
    console.error("matches: runs table", existing.error.code);
    return send({ status: "none" }); // before partners.sql: Home just shows "Find partners"
  }
  if (existing.data) {
    const run = existing.data as { id: string; status: string; created_at: string };
    if (run.status === "ready") {
      const matches = await matchesOf(db, run.id);
      return send(matches.length ? { status: "ready", matches, center: null, stale: false } : await lastSaved(db, user.id));
    }
    if (run.status === "pending" && Date.now() - Date.parse(run.created_at) < STUCK_MS) return send({ status: "pending" });
    if (run.status === "pending") await db.from("match_runs").update({ status: "failed" }).eq("id", run.id);
    return send(await lastSaved(db, user.id));
  }

  // ---------- Claim this week (unique on user + week), THEN do the work ----------
  const claim = await db.from("match_runs").insert({ user_id: user.id, week_start: weekStart, source }).select("id").single();
  if (claim.error) {
    if (claim.error.code === "23505") return send({ status: "pending" }); // another tab got there first
    console.error("matches: couldn't claim the week", claim.error.code);
    return send(await lastSaved(db, user.id));
  }
  const runId = claim.data.id as string;
  const fail = async (why: string) => {
    console.error("matches:", why);
    await db.from("match_runs").update({ status: "failed" }).eq("id", runId);
    return send(await lastSaved(db, user.id));
  };

  const biz = await db.from("businesses").select("*").eq("user_id", user.id).maybeSingle();
  const row = toBusiness(biz.data as BusinessRow | null);
  if (!row) return fail("no business");
  const catalog = await loadCatalog(db, user.id);
  const business = { ...row, services: servicesFromCatalog(catalog) };

  // ---------- Map search: their best partner kinds, 10 miles ----------
  const kinds: CategoryId[] = PARTNERS[business.type]?.good.length ? PARTNERS[business.type].good.slice(0, 2) : ["cafes", "gyms"];
  let leads: Labeled[] = [];
  let center: { lat: number; lon: number } | null = null;
  let where = "";
  let usedKind: string | null = null;
  for (const kind of kinds) {
    const args = checkFindArgs({ kind, town: null, state: null, miles: 10 }, business);
    if (!args.ok) return fail("no town");
    const r = await runSearch(db, user.id, business, { town: args.town, state: args.state, category: args.category, hideChains: true, radiusMi: args.radiusMi }, { saved: false, deadline: started + 25_000 });
    if (!r.ok) continue;
    center = r.center;
    where = `within ${args.radiusMi} miles of ${r.town}`;
    const fresh = r.leads.filter((l) => !leads.some((x) => x.lead.id === l.id));
    leads = [...leads, ...fresh.map((lead) => ({ label: "", lead }))];
    usedKind = usedKind ?? args.category;
    if (leads.length >= MATCHES + 2 || Date.now() - started > 25_000) break;
  }
  if (!leads.length) return fail("no businesses found");
  leads = leads
    .sort((a, b) => (a.lead.distanceMi ?? 99) - (b.lead.distanceMi ?? 99))
    .slice(0, CHAT_RESULTS_SHOWN)
    .map((x, n) => ({ ...x, label: `B${n + 1}` }));

  // ---------- One Haiku picks call (same rules and checks as chat) ----------
  if (!process.env.ANTHROPIC_API_KEY) return fail("no API key");
  const sells = activeItems(catalog)
    .flatMap((i) => activeVariants(i).map((v) => `${entryName(i, v, activeVariants(i).length)} ${formatMoney(v.price)}`))
    .join("; ");
  const system = `${CHAT_OUTREACH_RULES}

You're picking this week's partner matches for a small business owner: call show_picks with the ${MATCHES} best businesses from <map_results>, best first. The reply is one short friendly sentence.

About the owner: ${business.ownerName}, ${business.typeLabel}${business.businessName ? ` (${business.businessName})` : ""} in ${business.area}.
What they sell: ${sells || "nothing listed yet"}.

${partnerHint(business)}`;
  const allowedNumbers = new Set(business.services.flatMap((s) => [String(s.price), ...(s.minutes ? [String(s.minutes)] : [])]));
  const ids = new Set(leads.map((x) => x.label));
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0, timeout: 20_000 });
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `${resultsBlock(leads, where)}\n\nPick this week's ${MATCHES} matches.` }];
  let picks: Pick[] = [];
  let tokens = { model: MODEL, input: 0, output: 0 };
  try {
    for (let attempt = 0; attempt < 2 && Date.now() - started < 45_000; attempt++) {
      const res = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1600,
        system,
        tools: [PICKS_TOOL as Anthropic.Tool],
        tool_choice: { type: "tool", name: PICKS_TOOL.name },
        messages,
      });
      tokens = { model: res.model, input: tokens.input + res.usage.input_tokens, output: tokens.output + res.usage.output_tokens };
      const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!call) break;
      const checked = checkPicks(call.input, ids, allowedNumbers);
      if (checked.good.length >= picks.length) picks = checked.good;
      if (!checked.problems.length) break;
      messages.push(
        { role: "assistant", content: res.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please fix and call show_picks again: ${checked.problems.join("; ")}.` }] },
      );
    }
  } catch (error) {
    await db.from("match_runs").update({ model: tokens.model, input_tokens: tokens.input, output_tokens: tokens.output }).eq("id", runId);
    return fail(`picks call failed ${error instanceof Anthropic.APIError ? error.status : "network"}`);
  }
  await db.from("match_runs").update({ model: tokens.model, input_tokens: tokens.input, output_tokens: tokens.output, category: usedKind }).eq("id", runId);
  if (!picks.length) return fail("no good picks");

  // ---------- Save the matches (the businesses stay out of Partners until Save / Draft email) ----------
  const rows = picks.slice(0, MATCHES).map((p, position) => {
    const lead = leads.find((x) => x.label === p.resultId)!.lead;
    return { user_id: user.id, run_id: runId, lead_id: lead.id, position, why: p.why, deal_idea: p.dealIdea, distance_mi: lead.distanceMi ?? null };
  });
  const saved = await db.from("partner_matches").insert(rows);
  if (saved.error) return fail(`couldn't save matches ${saved.error.code}`);
  await db.from("match_runs").update({ status: "ready" }).eq("id", runId);
  return send({ status: "ready", matches: await matchesOf(db, runId), center, stale: false });
}
