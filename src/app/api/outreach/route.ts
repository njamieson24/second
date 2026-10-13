// Outreach: find local businesses, find their public email, draft an email. Runs on the SERVER only.
//
// - Second NEVER sends anything. No email APIs. The owner copies the draft and sends it themselves.
// - TAVILY_API_KEY and ANTHROPIC_API_KEY are read only here (server). Never logged.
// - Everything is read and written AS the owner (row level security, owner-only tables).
// - Caps: 20 map searches, 25 email lookups and 30 drafts per person per 24 hours; Tavily at most
//   900 a month for everyone (claim_tavily_search() in supabase/outreach.sql); town lookups at
//   most 1 a second for everyone (claim_nominatim_slot()).
// - OUTREACH_OVERPASS_SERVERS and OUTREACH_FORCE_TAVILY_EXHAUSTED are TEST-ONLY settings. Never set them in Vercel.

import Anthropic from "@anthropic-ai/sdk";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { toBusiness, toEvent, toTransaction, type BusinessRow, type EventRow, type TransactionRow } from "@/lib/db-rows";
import { formatMoney, knownClientNames } from "@/lib/money";
import { CATEGORIES, categoryLabel, isEmailAddress, OUTREACH_LIMITS, type CategoryId, type Lead, type LeadStatus, type OutreachResponse, type OutreachUsage } from "@/lib/outreach";
import { DRAFT_MODEL, DRAFT_SYSTEM, DRAFT_TOOL, draftProblems, draftPrompt, OUTREACH_DRAFT_MAX_TOKENS, MAX_WORDS, wordCount, withOptOut } from "@/lib/outreach-draft";
import { isGoodEmail, lookupEmail } from "@/lib/outreach-email";
import { areaIdFor, geocodeTown, nominatimPlaces, overpassQuery, pickPlaces, runOverpass } from "@/lib/outreach-osm";
import type { Business } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 86_400_000;
const send = (body: OutreachResponse, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status: number) => send({ status: "error", message }, status);

type LeadRow = {
  id: string;
  source: "osm" | "manual";
  town: string | null;
  category: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  email_source: string | null;
  contact_page: string | null;
  instagram: string | null;
  facebook: string | null;
  status: LeadStatus;
  note: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  email_checked_at: string | null;
};
const toLead = (r: LeadRow): Lead => ({
  id: r.id,
  source: r.source,
  town: r.town,
  category: r.category,
  name: r.name,
  address: r.address,
  website: r.website,
  phone: r.phone,
  email: r.email,
  emailSource: r.email_source,
  contactPage: r.contact_page,
  instagram: r.instagram,
  facebook: r.facebook,
  status: r.status,
  note: r.note,
  draftSubject: r.draft_subject,
  draftBody: r.draft_body,
  emailCheckedAt: r.email_checked_at,
});

async function usageOf(db: SupabaseClient, userId: string): Promise<OutreachUsage> {
  const since = new Date(Date.now() - DAY).toISOString();
  const [s, l, d] = await Promise.all([
    db.from("outreach_searches").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    db.from("outreach_lookups").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since),
    db.from("draft_runs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("action_type", "outreach_email").gte("created_at", since),
  ]);
  return {
    searchesLeft: Math.max(0, OUTREACH_LIMITS.searchesPerDay - (s.count ?? 0)),
    lookupsLeft: Math.max(0, OUTREACH_LIMITS.lookupsPerDay - (l.count ?? 0)),
    draftsLeft: Math.max(0, OUTREACH_LIMITS.draftsPerDay - (d.count ?? 0)),
  };
}

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
  const hideChains = body.hideChains !== false;
  if (!town) return fail("Please type a town.", 400);
  if (!category) return fail("Please pick a kind of business.", 400);

  // Town: from this person's saved lookups, or Nominatim (1 a second for the whole app).
  const queryKey = `${town}, ${state}`.toLowerCase().replace(/\s+/g, " ").trim();
  const label = state ? `${town}, ${state}` : town;
  let relationId: number | null = null;
  const cached = await db.from("outreach_towns").select("relation_id").eq("user_id", userId).eq("query_key", queryKey).maybeSingle();
  if (cached.data) relationId = Number(cached.data.relation_id);
  else {
    const slot = await db.rpc("claim_nominatim_slot");
    if (slot.error) {
      console.error("outreach: nominatim guard", slot.error.code);
      return fail("Outreach isn't set up yet.", 500);
    }
    const found = await geocodeTown(town, state).catch(() => null);
    if (!found) return fail("We couldn't find that town. Check the spelling and the state.", 404);
    relationId = found.relationId;
    await db.from("outreach_towns").insert({ user_id: userId, query_key: queryKey, relation_id: relationId, display_name: found.displayName.slice(0, 300) });
  }
  const areaId = areaIdFor(relationId);
  const since = new Date(Date.now() - OUTREACH_LIMITS.reuseDays * DAY).toISOString();

  const leadsFor = async () => {
    let q = db.from("outreach_leads").select("*").eq("user_id", userId).eq("area_id", areaId).eq("category", category);
    if (hideChains) q = q.eq("chain", false);
    const { data } = await q.order("name").limit(OUTREACH_LIMITS.maxResults);
    return ((data ?? []) as LeadRow[]).map(toLead);
  };

  // Searched this town + kind in the last 30 days? Reuse the saved results (no map call).
  // (Unless the leads were cleared since, e.g. by Start over: then search again.)
  const recent = await db
    .from("outreach_searches")
    .select("result_count")
    .eq("user_id", userId)
    .eq("area_id", areaId)
    .eq("category", category)
    .eq("hide_chains", hideChains)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recent.data?.length) {
    const saved = await leadsFor();
    if (saved.length || recent.data[0].result_count === 0) return send({ status: "leads", leads: saved, reused: true, town: label, usage: await usageOf(db, userId) });
  }

  const usage = await usageOf(db, userId);
  if (usage.searchesLeft <= 0) return fail(`You've done today's ${OUTREACH_LIMITS.searchesPerDay} map searches. You can search again tomorrow.`, 429);

  // Nominatim first (fast); Overpass if Nominatim is down or found nothing.
  const claimSlot = async () => {
    const { error } = await db.rpc("claim_nominatim_slot");
    if (error) throw new Error(`nominatim guard ${error.code}`);
  };
  const fromNominatim = await nominatimPlaces(town, state, category, claimSlot);
  let elements = fromNominatim ?? [];
  if (!elements.length) {
    const result = await runOverpass(overpassQuery(areaId, category));
    if (result) elements = result.elements;
    else if (!fromNominatim) return fail("The map servers are busy right now. Try again in a minute.", 503);
  }
  const places = pickPlaces(elements, { hideChains, ownName: business.businessName, max: OUTREACH_LIMITS.maxResults });

  // Save as leads. Places already saved are left alone (keeps status, email and notes).
  if (places.length) {
    const rows = places.map((p) => ({
      user_id: userId,
      source: "osm",
      osm_type: p.osmType,
      osm_id: p.osmId,
      area_id: areaId,
      town: label,
      category,
      name: p.name,
      address: p.address,
      website: p.website,
      phone: p.phone,
      instagram: p.instagram,
      facebook: p.facebook,
      chain: p.chain,
      email: p.email && isGoodEmail(p.email) ? p.email.toLowerCase() : null,
      email_source: p.email && isGoodEmail(p.email) ? "openstreetmap" : null,
      status: p.email && isGoodEmail(p.email) ? "email_found" : "new",
    }));
    const saved = await db.from("outreach_leads").upsert(rows, { onConflict: "user_id,osm_type,osm_id", ignoreDuplicates: true });
    if (saved.error) console.error("outreach: couldn't save leads", saved.error.code);
  }
  await db.from("outreach_searches").insert({ user_id: userId, area_id: areaId, category, hide_chains: hideChains, result_count: places.length });
  return send({ status: "leads", leads: await leadsFor(), reused: false, town: label, usage: await usageOf(db, userId) });
}

// ---------- 2. Find an email ----------

async function findEmail(db: SupabaseClient, userId: string, leadId: string) {
  const usage = await usageOf(db, userId);
  if (usage.lookupsLeft <= 0) return fail(`You've used today's ${OUTREACH_LIMITS.lookupsPerDay} email lookups. You can look up more tomorrow.`, 429);
  const { data } = await db.from("outreach_leads").select("*").eq("id", leadId).maybeSingle();
  const lead = data as LeadRow | null;
  if (!lead) return fail("We couldn't find that business. Please refresh the page.", 404);

  const log = (found: boolean, usedTavily: boolean, pages: number) =>
    db.from("outreach_lookups").insert({ user_id: userId, lead_id: lead.id, used_tavily: usedTavily, pages_fetched: pages, found });

  // Step 1: the map already had an email.
  if (lead.email) {
    await log(true, false, 0);
    return send({ status: "lead", lead: toLead(lead), found: true, usage: await usageOf(db, userId) });
  }

  const claimTavily = async () => {
    if (!process.env.TAVILY_API_KEY || process.env.OUTREACH_FORCE_TAVILY_EXHAUSTED === "1") return false;
    const { data: ok, error } = await db.rpc("claim_tavily_search");
    if (error) console.error("outreach: tavily guard", error.code);
    return ok === true;
  };
  const r = await lookupEmail({ name: lead.name, website: lead.website, instagram: lead.instagram, facebook: lead.facebook, town: lead.town ?? "" }, claimTavily);
  const found = Boolean(r.email);
  const changes = {
    email: r.email,
    email_source: r.emailSource,
    website: r.website,
    contact_page: r.contactPage,
    instagram: r.instagram,
    facebook: r.facebook,
    email_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(found && lead.status === "new" ? { status: "email_found" } : {}),
  };
  const { data: updated } = await db.from("outreach_leads").update(changes).eq("id", lead.id).select("*").maybeSingle();
  await log(found, r.usedTavily, r.pagesFetched);
  return send({
    status: "lead",
    lead: toLead((updated as LeadRow | null) ?? { ...lead, ...changes } as LeadRow),
    found,
    ...(found ? {} : { message: "No public email found. Try their contact page or Instagram." }),
    usage: await usageOf(db, userId),
  });
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
