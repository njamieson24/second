// Outreach: find local businesses, find their public email, draft an email. Runs on the SERVER only.
//
// - Second NEVER sends anything. No email APIs. The owner copies the draft and sends it themselves.
// - TAVILY_API_KEY and ANTHROPIC_API_KEY are read only here (server). Never logged.
// - Everything is read and written AS the owner (row level security, owner-only tables).
// - Caps: 20 map searches, 25 email lookups and 30 drafts per person per 24 hours; Tavily at most
//   900 a month for everyone (claim_tavily_search() in supabase/outreach.sql); town lookups at
//   most 1 a second for everyone (claim_nominatim_slot()).
// - Searching and email lookups live in src/lib/outreach-server.ts (shared with chat).
// - OUTREACH_OVERPASS_SERVERS, OUTREACH_NOMINATIM_URL and OUTREACH_FORCE_TAVILY_EXHAUSTED are TEST-ONLY settings. Never set them in Vercel.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toBusiness, toEvent, toTransaction, type BusinessRow, type EventRow, type TransactionRow } from "@/lib/db-rows";
import { formatMoney, knownClientNames } from "@/lib/money";
import { CATEGORIES, categoryLabel, DEFAULT_RADIUS, isEmailAddress, OUTREACH_LIMITS, RADIUS_OPTIONS, type RadiusMi, type CategoryId, type LeadStatus, type OutreachResponse } from "@/lib/outreach";
import { DRAFT_MODEL, DRAFT_SYSTEM, DRAFT_TOOL, draftProblems, draftPrompt, OUTREACH_DRAFT_MAX_TOKENS, MAX_WORDS, wordCount, withOptOut } from "@/lib/outreach-draft";
import { findEmailForLead, runSearch, toLead, usageOf, type LeadRow } from "@/lib/outreach-server";
import type { Business } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const send = (body: OutreachResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status: number) => send({ status: "error", message }, status);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail("Outreach isn't set up yet.", 500);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail("Please log in.", 401);
  const db = createClient(url, key, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return fail("Please log in again.", 401);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const bizRes = await db.from("businesses").select("*").eq("user_id", user.id).maybeSingle();
  const business = toBusiness(bizRes.data as BusinessRow | null);
  if (!business) return fail("Please finish setting up your business first.", 400);

  try {
    switch (body.action) {
      case "usage":
        return send({ status: "usage", usage: await usageOf(db, user.id) });
      case "search":
        return await search(db, user.id, business, body);
      case "find_email":
        return await findEmail(db, user.id, text(body.leadId, 40));
      case "draft":
        return await draft(db, user.id, business, text(body.leadId, 40), text(body.goal, OUTREACH_LIMITS.goalMaxChars));
      case "add_manual":
        return await addManual(db, user.id, body);
      default:
        return fail("Something went wrong. Please try again.", 400);
    }
  } catch (error) {
    console.error("outreach: unexpected", error instanceof Error ? error.name : "unknown");
    return fail("Something went wrong. Please try again in a minute.", 500);
  }
}

// ---------- 1. Find businesses ----------

async function search(db: SupabaseClient, userId: string, business: Business, body: Record<string, unknown>) {
  const town = text(body.town, 80);
  const state = text(body.state, 40);
  const category = CATEGORIES.find((c) => c.id === body.category)?.id as CategoryId | undefined;
  const radiusMi: RadiusMi = RADIUS_OPTIONS.find((r) => r === Number(body.radiusMi)) ?? DEFAULT_RADIUS;
  if (!town) return fail("Please type a town.", 400);
  if (!category) return fail("Please pick a kind of business.", 400);
  // "Search the map again" (fresh): skip the saved results (still counts toward the daily searches).
  const r = await runSearch(db, userId, business, { town, state, category, hideChains: body.hideChains !== false, radiusMi, fresh: body.fresh === true }, { saved: true });
  if (!r.ok) return fail(r.message, r.status);
  return send({ status: "leads", leads: r.leads, reused: r.reused, town: r.town, usage: await usageOf(db, userId) });
}

// ---------- 2. Find an email ----------

async function findEmail(db: SupabaseClient, userId: string, leadId: string) {
  const r = await findEmailForLead(db, userId, leadId, { allowTavily: true });
  if (!r.ok) return fail(r.message, r.status);
  return send({ status: "lead", lead: r.lead, found: r.found, ...(r.message ? { message: r.message } : {}), usage: await usageOf(db, userId) });
}

// ---------- 3. Draft the email (the owner sends it) ----------

async function draft(db: SupabaseClient, userId: string, business: Business, leadId: string, goal: string) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("Drafts aren't working right now. Please try again later.", 500);
  const usage = await usageOf(db, userId);
  if (usage.draftsLeft <= 0) return fail(`You've written today's ${OUTREACH_LIMITS.draftsPerDay} outreach drafts. You can write more tomorrow.`, 429);
  const { data } = await db.from("outreach_leads").select("*").eq("id", leadId).maybeSingle();
  const lead = data as LeadRow | null;
  if (!lead) return fail("We couldn't find that business. Please refresh the page.", 404);

  const [notesRes, txs, evs] = await Promise.all([
    db.from("business_notes").select("note").eq("user_id", userId).order("updated_at", { ascending: false }).limit(12),
    db.from("transactions").select("*").eq("user_id", userId),
    db.from("events").select("*").eq("user_id", userId),
  ]);
  const clientNames = knownClientNames(((txs.data ?? []) as TransactionRow[]).map(toTransaction), ((evs.data ?? []) as EventRow[]).map(toEvent));
  const allowedNumbers = new Set(business.services.flatMap((s) => [String(s.price), ...(s.minutes ? [String(s.minutes)] : [])]));
  const prompt = draftPrompt({
    owner: {
      name: business.ownerName,
      business: business.businessName,
      typeLabel: business.typeLabel,
      town: business.area,
      services: business.services.map((s) => `${s.name} ${formatMoney(s.price)}${s.minutes ? ` (${s.minutes} min)` : ""}`).join("; "),
    },
    notes: (notesRes.data ?? []).map((n) => n.note as string),
    lead: { name: lead.name, category: categoryLabel(lead.category), town: lead.town },
    goal,
  });
  const ctx = { ownerFirstName: business.ownerName.split(/\s+/)[0], business: business.businessName, allowedNumbers, clientNames };

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });
  let result: { subject: string; body: string } | null = null;
  let usageTokens = { model: DRAFT_MODEL, input: 0, output: 0 };
  try {
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
    for (let round = 0; round < 2; round++) {
      const res = await anthropic.messages.create({
        model: DRAFT_MODEL,
        max_tokens: OUTREACH_DRAFT_MAX_TOKENS,
        system: DRAFT_SYSTEM,
        tools: [DRAFT_TOOL],
        tool_choice: { type: "tool", name: DRAFT_TOOL.name },
        messages,
      });
      usageTokens = { model: res.model, input: usageTokens.input + res.usage.input_tokens, output: usageTokens.output + res.usage.output_tokens };
      const call = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const out = call?.input as { subject?: string; body?: string } | undefined;
      // The opt-out line is required; if it's still missing it's added in code below.
      const candidate = { subject: (out?.subject ?? "").trim(), body: withOptOut(out?.body ?? "") };
      const problems = res.stop_reason === "max_tokens" || !call ? ["the email was cut off; keep it shorter"] : draftProblems(candidate, ctx);
      if (!problems.length && wordCount(candidate.body) <= MAX_WORDS) {
        result = candidate;
        break;
      }
      if (!call) break;
      messages.push(
        { role: "assistant", content: res.content },
        { role: "user", content: [{ type: "tool_result", tool_use_id: call.id, is_error: true, content: `Please rewrite it: ${problems.join("; ")}.` }] },
      );
    }
  } catch (error) {
    console.error("outreach: draft call failed", error instanceof Anthropic.APIError ? error.status : "network");
    return fail("Second is a bit busy right now. Please try again in a minute.", 502);
  } finally {
    if (usageTokens.input > 0) {
      const { error } = await db.from("draft_runs").insert({ user_id: userId, action_type: "outreach_email", model: usageTokens.model, input_tokens: usageTokens.input, output_tokens: usageTokens.output });
      if (error) console.error("outreach: couldn't log the draft", error.code);
    }
  }
  if (!result) return fail("We couldn't write a good draft for that one. Please try again.", 502);

  const status: LeadStatus = lead.status === "new" || lead.status === "email_found" ? "drafted" : lead.status;
  const { data: updated } = await db
    .from("outreach_leads")
    .update({ draft_subject: result.subject.slice(0, 200), draft_body: result.body.slice(0, 3000), status, updated_at: new Date().toISOString() })
    .eq("id", lead.id)
    .select("*")
    .maybeSingle();
  return send({ status: "draft", subject: result.subject, body: result.body, lead: toLead((updated as LeadRow | null) ?? lead), usage: await usageOf(db, userId) });
}

// ---------- 4. Add a business by hand ----------

async function addManual(db: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const name = text(body.name, 200);
  if (!name) return fail("Please type the business name.", 400);
  let website: string | null = text(body.website, 500) || null;
  if (website) {
    if (!/^https?:\/\//i.test(website)) website = `https://${website}`;
    try {
      const u = new URL(website);
      if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
    } catch {
      return fail("That website doesn't look right. It should look like example.com.", 400);
    }
  }
  const email = text(body.email, 254).toLowerCase() || null;
  if (email && !isEmailAddress(email)) return fail("That email doesn't look right.", 400);
  const category = CATEGORIES.find((c) => c.id === body.category)?.id ?? "retail";
  const town = text(body.town, 120) || null;
  const { data, error } = await db
    .from("outreach_leads")
    .insert({ user_id: userId, source: "manual", category, name, website, email, town, email_source: email ? "added by you" : null, status: email ? "email_found" : "new" })
    .select("*")
    .single();
  if (error || !data) {
    console.error("outreach: couldn't add a lead", error?.code);
    return fail("We couldn't add that business. Please try again.", 500);
  }
  return send({ status: "lead", lead: toLead(data as LeadRow), found: Boolean(email), usage: await usageOf(db, userId) });
}
