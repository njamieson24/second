// Outreach on the SERVER: finding businesses and their public emails. Shared by the Outreach
// route (/api/outreach) and Chat with Second (/api/chat), so both follow the same rules, caps
// and 30-day caches. Never import this into a "use client" file.
//
// - Everything is read and written AS the owner (row level security, owner-only tables).
// - Caps: 20 map searches and 25 email lookups per person per 24 hours. A map search only counts
//   when it really asks the map (a reused saved search doesn't). An email lookup only counts when
//   it really looks (an email already saved, or a web search for that business in the last 30
//   days, is reused for free). Tavily: 900 a month for everyone (claim_tavily_search()).
// - TAVILY_API_KEY is read here, never logged.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORY_CHANGED,
  milesBetween,
  OUTREACH_LIMITS,
  type CategoryId,
  type Lead,
  type LeadStatus,
  type OutreachUsage,
  type RadiusMi,
} from "./outreach";
import { isGoodEmail, lookupEmail } from "./outreach-email";
import { areaIdFor, geocodeTown, nominatimPlaces, overpassQuery, pickPlaces, runOverpass, type Point } from "./outreach-osm";
import type { Business } from "./store";

const DAY = 86_400_000;
const REUSE_MS = OUTREACH_LIMITS.reuseDays * DAY;

export type LeadRow = {
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
  saved?: boolean | null;
  lat?: number | null;
  lon?: number | null;
};

export const toLead = (r: LeadRow): Lead => ({
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
  saved: r.saved ?? true,
});

export async function usageOf(db: SupabaseClient, userId: string): Promise<OutreachUsage> {
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

// ---------- Find businesses ----------

export type SearchInput = { town: string; state: string; category: CategoryId; hideChains: boolean; radiusMi: RadiusMi; fresh?: boolean };
export type SearchOutcome =
  | { ok: true; leads: Lead[]; reused: boolean; town: string }
  | { ok: false; reason: "town" | "limit" | "busy" | "setup"; message: string; status: number };

/**
 * Businesses of one kind within `radiusMi` miles of a town, closest first (at most 150).
 * Results are saved as leads (the cache). `saved` marks whether they show in the owner's
 * Outreach list: true from the Outreach page, false from chat (until they tap Save to Outreach).
 * `deadline` (ms since 1970) stops the map search in time, e.g. inside a chat message.
 */
export async function runSearch(
  db: SupabaseClient,
  userId: string,
  business: Business,
  input: SearchInput,
  opts: { saved: boolean; deadline?: number },
): Promise<SearchOutcome> {
  const { town, state, category, hideChains, radiusMi } = input;
  const deadline = opts.deadline ?? Infinity;

  // Town: from this person's saved lookups, or Nominatim (1 a second for the whole app).
  const queryKey = `${town}, ${state}`.toLowerCase().replace(/\s+/g, " ").trim();
  const label = state ? `${town}, ${state}` : town;
  let relationId: number;
  let center: Point;
  const cached = await db.from("outreach_towns").select("relation_id, lat, lon").eq("user_id", userId).eq("query_key", queryKey).maybeSingle();
  if (cached.data && cached.data.lat != null && cached.data.lon != null) {
    relationId = Number(cached.data.relation_id);
    center = { lat: Number(cached.data.lat), lon: Number(cached.data.lon) };
  } else {
    const slot = await db.rpc("claim_nominatim_slot");
    if (slot.error) {
      console.error("outreach: nominatim guard", slot.error.code);
      return { ok: false, reason: "setup", message: "Outreach isn't set up yet.", status: 500 };
    }
    const found = await geocodeTown(town, state).catch(() => null);
    if (!found) return { ok: false, reason: "town", message: "We couldn't find that town. Check the spelling and the state.", status: 404 };
    relationId = found.relationId;
    center = { lat: found.lat, lon: found.lon };
    if (!cached.data) {
      await db.from("outreach_towns").insert({ user_id: userId, query_key: queryKey, relation_id: relationId, display_name: found.displayName.slice(0, 300), lat: found.lat, lon: found.lon });
    }
  }
  const areaId = areaIdFor(relationId);
  const since = new Date(Date.now() - REUSE_MS).toISOString();

  // Saved leads of this kind within the distance, closest first.
  const leadsFor = async () => {
    const dLat = radiusMi / 69;
    const dLon = radiusMi / (69 * Math.cos((center.lat * Math.PI) / 180));
    let q = db
      .from("outreach_leads")
      .select("*")
      .eq("user_id", userId)
      .eq("category", category)
      .gte("lat", center.lat - dLat)
      .lte("lat", center.lat + dLat)
      .gte("lon", center.lon - dLon)
      .lte("lon", center.lon + dLon);
    if (hideChains) q = q.eq("chain", false);
    const { data } = await q.limit(1000);
    return ((data ?? []) as (LeadRow & { lat: number; lon: number })[])
      .map((r) => ({ ...toLead(r), distanceMi: Math.round(milesBetween(center, r) * 10) / 10 }))
      .filter((l) => l.distanceMi <= radiusMi)
      .sort((a, b) => a.distanceMi - b.distanceMi || a.name.localeCompare(b.name))
      .slice(0, OUTREACH_LIMITS.maxResults);
  };
  // From the Outreach page, everything it shows belongs in the owner's list.
  const finish = async (reused: boolean): Promise<SearchOutcome> => {
    const leads = await leadsFor();
    if (opts.saved) {
      const hidden = leads.filter((l) => l.saved === false).map((l) => l.id);
      if (hidden.length) await db.from("outreach_leads").update({ saved: true }).in("id", hidden);
      for (const l of leads) l.saved = true;
    }
    return { ok: true, leads, reused, town: label };
  };

  // Same town, kind and distance in the last 30 days? Reuse the saved results (no map call).
  // (Unless the leads were cleared since, e.g. by Start over: then search again.)
  const recent = await db
    .from("outreach_searches")
    .select("result_count")
    .eq("user_id", userId)
    .eq("area_id", areaId)
    .eq("category", category)
    .eq("hide_chains", hideChains)
    .eq("radius_mi", radiusMi)
    .gte("created_at", [since, CATEGORY_CHANGED[category] ?? since].sort().pop()!)
    .order("created_at", { ascending: false })
    .limit(1);
  if (recent.error) {
    console.error("outreach: search cache", recent.error.code);
    return { ok: false, reason: "setup", message: "Outreach needs a quick database update. Please try again later.", status: 500 };
  }
  if (recent.data?.length && !input.fresh) {
    const out = await finish(true);
    if (out.ok && (out.leads.length || recent.data[0].result_count === 0)) return out;
  }

  const usage = await usageOf(db, userId);
  if (usage.searchesLeft <= 0)
    return { ok: false, reason: "limit", message: `You've done today's ${OUTREACH_LIMITS.searchesPerDay} map searches. You can search again tomorrow.`, status: 429 };

  // Nominatim first (fast); Overpass if Nominatim is down or found nothing.
  const claimSlot = async () => {
    const { error } = await db.rpc("claim_nominatim_slot");
    if (error) throw new Error(`nominatim guard ${error.code}`);
  };
  const fromNominatim = await nominatimPlaces(center, radiusMi, category, claimSlot, OUTREACH_LIMITS.maxResults, deadline);
  let elements = fromNominatim?.elements ?? [];
  // True only if the whole circle was searched (then untouched places it didn't list can go).
  let complete = Boolean(fromNominatim?.complete);
  if (!elements.length) {
    const result = Date.now() < deadline - 3_000 ? await runOverpass(overpassQuery(center, radiusMi, category), deadline) : null;
    if (result) {
      elements = result.elements;
      complete = true;
    } else if (!fromNominatim) return { ok: false, reason: "busy", message: "The map servers are busy right now. Try again in a minute.", status: 503 };
  }
  // Closest first, so the cap keeps the nearest places.
  const where = (e: (typeof elements)[number]) => (e.lat != null && e.lon != null ? { lat: e.lat, lon: e.lon } : e.center ?? null);
  const nearby = elements
    .map((e) => ({ e, at: where(e) }))
    .filter((x): x is { e: (typeof elements)[number]; at: Point } => x.at !== null)
    .map((x) => ({ e: x.e, d: milesBetween(center, x.at) }))
    .filter((x) => x.d <= radiusMi)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.e);
  const places = pickPlaces(nearby, { hideChains, ownName: business.businessName, max: OUTREACH_LIMITS.maxResults });

  if (places.length) {
    // New places are saved in full. Places already saved keep their status, email, website,
    // notes and drafts; only their map details (name, kind, location) are refreshed.
    const goodEmail = (p: (typeof places)[number]) => (p.email && isGoodEmail(p.email) ? p.email.toLowerCase() : null);
    const rows = places.map((p) => ({
      user_id: userId,
      source: "osm",
      osm_type: p.osmType,
      osm_id: p.osmId,
      area_id: areaId,
      town: p.city ?? label,
      category,
      name: p.name,
      address: p.address,
      website: p.website,
      phone: p.phone,
      instagram: p.instagram,
      facebook: p.facebook,
      chain: p.chain,
      lat: p.lat,
      lon: p.lon,
      saved: opts.saved,
      email: goodEmail(p),
      email_source: goodEmail(p) ? "openstreetmap" : null,
      status: goodEmail(p) ? "email_found" : "new",
    }));
    const added = await db.from("outreach_leads").upsert(rows, { onConflict: "user_id,osm_type,osm_id", ignoreDuplicates: true });
    if (added.error) console.error("outreach: couldn't save leads", added.error.code);
    const refreshed = await db.from("outreach_leads").upsert(
      rows.map((r) => ({ user_id: r.user_id, source: r.source, osm_type: r.osm_type, osm_id: r.osm_id, category: r.category, name: r.name, chain: r.chain, lat: r.lat, lon: r.lon })),
      { onConflict: "user_id,osm_type,osm_id" },
    );
    if (refreshed.error) console.error("outreach: couldn't refresh leads", refreshed.error.code);
  }
  // Places saved earlier that the map no longer lists here (closed, or not this kind after all)
  // are removed, but only if the owner never touched them: still New, no email, note or draft.
  // (Skipped when the search stopped early or the list was cut at 150: not everything was checked.)
  if (complete && places.length < OUTREACH_LIMITS.maxResults) {
    const keep = new Set(places.map((p) => `${p.osmType}/${p.osmId}`));
    const inRange = new Set((await leadsFor()).map((l) => l.id));
    const { data: untouched } = await db
      .from("outreach_leads")
      .select("id, osm_type, osm_id")
      .eq("user_id", userId)
      .eq("category", category)
      .eq("source", "osm")
      .eq("status", "new")
      .is("email", null)
      .is("note", null)
      .is("draft_body", null);
    const stale = (untouched ?? []).filter((r) => inRange.has(r.id) && !keep.has(`${r.osm_type}/${r.osm_id}`)).map((r) => r.id as string);
    if (stale.length) {
      const removed = await db.from("outreach_leads").delete().in("id", stale).eq("status", "new").is("email", null).is("note", null).is("draft_body", null);
      if (removed.error) console.error("outreach: couldn't remove old leads", removed.error.code);
    }
  }
  await db.from("outreach_searches").insert({ user_id: userId, area_id: areaId, category, hide_chains: hideChains, radius_mi: radiusMi, result_count: places.length });
  return finish(false);
}

// ---------- Find an email ----------

export type EmailOutcome =
  | { ok: true; lead: Lead; found: boolean; cached: boolean; message?: string }
  | { ok: false; message: string; status: number };

const NO_EMAIL = "No public email found. Try their contact page or Instagram.";

/**
 * The business's public email: the one already saved, then their website, then (if allowed)
 * one Tavily web search. Reused for free when the email is already saved, or when this business
 * already had a web search in the last 30 days. Only real lookups count toward the 25 a day.
 */
export async function findEmailForLead(db: SupabaseClient, userId: string, leadId: string, opts: { allowTavily: boolean }): Promise<EmailOutcome> {
  const { data } = await db.from("outreach_leads").select("*").eq("id", leadId).maybeSingle();
  const lead = data as LeadRow | null;
  if (!lead) return { ok: false, message: "We couldn't find that business. Please refresh the page.", status: 404 };

  // Already found (from the map, their website, a web search, or added by the owner).
  if (lead.email) return { ok: true, lead: toLead(lead), found: true, cached: true };

  // Already searched the web for this business recently and found nothing: don't pay again.
  const since = new Date(Date.now() - REUSE_MS).toISOString();
  const searched = await db.from("outreach_lookups").select("id").eq("lead_id", lead.id).eq("used_tavily", true).gte("created_at", since).limit(1);
  if (searched.data?.length) return { ok: true, lead: toLead(lead), found: false, cached: true, message: NO_EMAIL };

  const usage = await usageOf(db, userId);
  if (usage.lookupsLeft <= 0) return { ok: false, message: `You've used today's ${OUTREACH_LIMITS.lookupsPerDay} email lookups. You can look up more tomorrow.`, status: 429 };

  const claimTavily = async () => {
    if (!opts.allowTavily || !process.env.TAVILY_API_KEY || process.env.OUTREACH_FORCE_TAVILY_EXHAUSTED === "1") return false;
    const { data: ok, error } = await db.rpc("claim_tavily_search");
    if (error) console.error("outreach: tavily guard", error.code);
    return ok === true;
  };
  // Their website was checked in the last 30 days (e.g. by chat): go straight to the web search.
  const skipWebsite = Boolean(lead.email_checked_at && Date.now() - Date.parse(lead.email_checked_at) < REUSE_MS);
  const r = await lookupEmail({ name: lead.name, website: lead.website, instagram: lead.instagram, facebook: lead.facebook, town: lead.town ?? "" }, claimTavily, { skipWebsite });
  const found = Boolean(r.email);
  const changes = {
    email: r.email,
    email_source: r.emailSource,
    website: r.website,
    contact_page: r.contactPage ?? lead.contact_page,
    instagram: r.instagram,
    facebook: r.facebook,
    email_checked_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...(found && lead.status === "new" ? { status: "email_found" } : {}),
  };
  const { data: updated } = await db.from("outreach_leads").update(changes).eq("id", lead.id).select("*").maybeSingle();
  await db.from("outreach_lookups").insert({ user_id: userId, lead_id: lead.id, used_tavily: r.usedTavily, pages_fetched: r.pagesFetched, found });
  return {
    ok: true,
    lead: toLead((updated as LeadRow | null) ?? ({ ...lead, ...changes } as LeadRow)),
    found,
    cached: false,
    ...(found ? {} : { message: NO_EMAIL }),
  };
}

/**
 * Chat: check the websites of a few picks for a public email, all at once, and give up on any
 * that run past `deadline`. Website only (never a web search), not counted toward the 25 a day,
 * and skipped for sites checked in the last 30 days. Returns the leads with what was found.
 */
export async function checkWebsites(db: SupabaseClient, leads: Lead[], deadline: number): Promise<Lead[]> {
  const fresh = (l: Lead) => l.emailCheckedAt && Date.now() - Date.parse(l.emailCheckedAt) < REUSE_MS;
  const check = async (l: Lead): Promise<Lead> => {
    if (l.email || !l.website || fresh(l)) return l;
    const wait = deadline - Date.now();
    if (wait < 1_500) return l;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), wait));
    const r = await Promise.race([lookupEmail({ name: l.name, website: l.website, instagram: l.instagram, facebook: l.facebook, town: l.town ?? "" }, async () => false), timeout]);
    if (!r) return l; // ran long: the card keeps its "Find email" button
    const changes = {
      email: r.email,
      email_source: r.emailSource,
      contact_page: r.contactPage ?? l.contactPage,
      email_checked_at: new Date().toISOString(),
      ...(r.email && l.status === "new" ? { status: "email_found" } : {}),
    };
    const { error } = await db.from("outreach_leads").update(changes).eq("id", l.id);
    if (error) console.error("chat: couldn't save a website check", error.code);
    return { ...l, email: r.email, emailSource: r.emailSource, contactPage: changes.contact_page, emailCheckedAt: changes.email_checked_at, status: (changes.status as LeadStatus | undefined) ?? l.status };
  };
  return Promise.all(leads.map(check));
}
