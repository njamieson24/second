// Outreach: finding local businesses on OpenStreetMap (free, no key). Server only.
// Nominatim turns a town into an OpenStreetMap area and lists the businesses in and near it
// (fast, 1 to 2 seconds). Overpass is the backup: more complete, but often overloaded ("504").
// Data © OpenStreetMap contributors (the page shows the required credit).

import { CATEGORIES, type CategoryId } from "./outreach";

export const USER_AGENT = "Second/1.0 (https://second-w28n.vercel.app)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
// overpass-api.de runs three instances; each one answers "busy" (504) now and then, so all three are
// tried before the community mirrors.
const DEFAULT_OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
  "https://z.overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const PER_SERVER_MS = 8_000;
const TOTAL_BUDGET_MS = 30_000;

/** The Overpass servers to try, in order. OUTREACH_OVERPASS_SERVERS is TEST-ONLY (never set in Vercel). */
export function overpassServers(): string[] {
  const test = process.env.OUTREACH_OVERPASS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
  return test?.length ? test : DEFAULT_OVERPASS;
}

export type Town = { relationId: number; displayName: string };

/** Look up a town ("Bradley Beach, NJ") and return its OpenStreetMap relation, or null. */
export async function geocodeTown(town: string, state: string): Promise<Town | null> {
  const q = [town, state, "USA"].filter(Boolean).join(", ");
  const url = `${NOMINATIM}?${new URLSearchParams({ q, format: "jsonv2", limit: "5" })}`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`nominatim ${res.status}`);
  const list = (await res.json()) as { osm_type?: string; osm_id?: number; display_name?: string; category?: string; type?: string }[];
  const place =
    list.find((r) => r.osm_type === "relation" && (r.category === "boundary" || r.category === "place")) ?? list.find((r) => r.osm_type === "relation");
  return place?.osm_id ? { relationId: place.osm_id, displayName: place.display_name ?? q } : null;
}

export const areaIdFor = (relationId: number) => 3_600_000_000 + relationId;

const OTHER_SHOPS = ["bakery", "pastry", "hairdresser", "beauty", "massage", "florist"];

/** The Overpass query for one category in one area (only places with a name). */
export function overpassQuery(areaId: number, category: CategoryId): string {
  const cat = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const parts = cat.tags.map(([k, v]) =>
    v === "*" ? `nwr["${k}"]["${k}"!~"^(${OTHER_SHOPS.join("|")})$"]["name"](area.a);` : `nwr["${k}"="${v}"]["name"](area.a);`,
  );
  return `[out:json][timeout:25];\narea(id:${areaId})->.a;\n(\n  ${parts.join("\n  ")}\n);\nout center tags 400;`;
}

export type OsmElement = { type: "node" | "way" | "relation"; id: number; tags?: Record<string, string> };

/** The map tags Nominatim searches for each category (it indexes each place by its main tag). */
const NOMINATIM_TAGS: Record<CategoryId, [string, string][]> = {
  cafes: [["amenity", "cafe"]],
  restaurants: [["amenity", "restaurant"], ["amenity", "fast_food"]],
  bars: [["amenity", "bar"], ["amenity", "pub"]],
  bakeries: [["shop", "bakery"], ["shop", "pastry"]],
  ice_cream: [["amenity", "ice_cream"]],
  salons: [["shop", "hairdresser"], ["shop", "beauty"]],
  gyms: [["leisure", "fitness_centre"], ["leisure", "sports_centre"]],
  spa: [["shop", "massage"], ["leisure", "spa"]],
  florists: [["shop", "florist"]],
  retail: [["shop", "clothes"], ["shop", "gift"]],
};

type NominatimPlace = {
  osm_type?: string;
  osm_id?: number;
  category?: string;
  type?: string;
  name?: string;
  extratags?: Record<string, string> | null;
  address?: Record<string, string> | null;
};

/**
 * Businesses of one kind in and near a town, from Nominatim (up to 40 per map tag).
 * `claimSlot` waits for the app-wide 1-lookup-a-second turn before each request.
 * Returns null only if every request failed (then the caller tries Overpass).
 */
export async function nominatimPlaces(town: string, state: string, category: CategoryId, claimSlot: () => Promise<void>): Promise<OsmElement[] | null> {
  const where = [town, state].filter(Boolean).join(", ");
  const out: OsmElement[] = [];
  let answered = false;
  for (const [k, v] of NOMINATIM_TAGS[category]) {
    try {
      await claimSlot();
      const url = `${NOMINATIM}?${new URLSearchParams({ q: `[${k}=${v}] ${where}`, format: "jsonv2", extratags: "1", addressdetails: "1", limit: "40", countrycodes: "us" })}`;
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.error("outreach: nominatim", res.status);
        continue;
      }
      answered = true;
      for (const p of (await res.json()) as NominatimPlace[]) {
        if (p.category !== k || p.type !== v || !p.name || !p.osm_id) continue;
        if (p.osm_type !== "node" && p.osm_type !== "way" && p.osm_type !== "relation") continue;
        const a = p.address ?? {};
        const tags: Record<string, string> = { ...(p.extratags ?? {}), name: p.name };
        if (a.house_number) tags["addr:housenumber"] = a.house_number;
        if (a.road) tags["addr:street"] = a.road;
        const city = a.city ?? a.town ?? a.village ?? a.hamlet;
        if (city) tags["addr:city"] = city;
        out.push({ type: p.osm_type, id: p.osm_id, tags });
      }
    } catch (error) {
      console.error("outreach: nominatim", error instanceof Error ? error.name : "failed");
    }
  }
  return answered ? out : null;
}

/** Ask each Overpass server in turn; fall back if one is busy, fails, or times out. */
export async function runOverpass(query: string): Promise<{ elements: OsmElement[]; server: string } | null> {
  const started = Date.now();
  for (const server of overpassServers()) {
    const left = TOTAL_BUDGET_MS - (Date.now() - started);
    if (left < 3_000) break;
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(Math.min(PER_SERVER_MS, left)),
      });
      if (!res.ok) {
        console.error("outreach: overpass", new URL(server).hostname, res.status);
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
      // A server that ran out of time or memory answers 200 with a "remark" and no elements.
      if (!Array.isArray(json.elements) || (json.remark && /runtime error|timed out|out of memory/i.test(json.remark))) {
        console.error("outreach: overpass", new URL(server).hostname, "no results");
        continue;
      }
      return { elements: json.elements, server };
    } catch (error) {
      // try the next server
      console.error("outreach: overpass", new URL(server).hostname, error instanceof Error ? error.name : "failed");
    }
  }
  return null;
}

export type MapPlace = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  chain: boolean;
};

const clean = (v: string | undefined, max = 500) => (v && v.trim() ? v.trim().slice(0, max) : null);

function socialUrl(v: string | undefined, site: "instagram" | "facebook"): string | null {
  const s = clean(v);
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@/, "").replace(/^(www\.)?(instagram|facebook)\.com\//i, "");
  return `https://www.${site}.com/${handle}`;
}

function websiteUrl(v: string | undefined): string | null {
  const s = clean(v);
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function toPlace(e: OsmElement): MapPlace | null {
  const t = e.tags ?? {};
  const name = clean(t.name, 200);
  if (!name) return null;
  const street = [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ");
  const address = [street, t["addr:city"]].filter(Boolean).join(", ");
  return {
    osmType: e.type,
    osmId: e.id,
    name,
    address: address || null,
    website: websiteUrl(t.website ?? t["contact:website"] ?? t.url),
    phone: clean(t.phone ?? t["contact:phone"], 60),
    email: clean(t.email ?? t["contact:email"], 254),
    instagram: socialUrl(t["contact:instagram"], "instagram"),
    facebook: socialUrl(t["contact:facebook"], "facebook"),
    chain: Boolean(t.brand || t["brand:wikidata"]),
  };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Named, de-duplicated places; chains hidden if asked; never the owner's own business; capped. */
export function pickPlaces(elements: OsmElement[], opts: { hideChains: boolean; ownName: string; max: number }): MapPlace[] {
  const own = norm(opts.ownName);
  const seen = new Set<string>();
  const out: MapPlace[] = [];
  for (const e of elements) {
    const p = toPlace(e);
    if (!p) continue;
    if (opts.hideChains && p.chain) continue;
    const n = norm(p.name);
    if (own.length >= 4 && (n === own || n.includes(own) || (n.length >= 4 && own.includes(n)))) continue;
    const key = `${p.osmType}/${p.osmId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    if (out.length >= opts.max) break;
  }
  return out;
}
