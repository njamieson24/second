// Outreach: shared by the browser (store.ts, the page) and the server route.
// Second never sends anything. The owner copies the draft and sends it from their own email.

export const OUTREACH_LIMITS = {
  /** Map searches per person per 24 hours */
  searchesPerDay: 20,
  /** Email lookups per person per 24 hours */
  lookupsPerDay: 25,
  /** Outreach email drafts per person per 24 hours (separate from This Week drafts and captions) */
  draftsPerDay: 30,
  /** Saved search results are reused for this many days */
  reuseDays: 30,
  maxResults: 150,
  /** The goal for a draft: typed on a card, or the deal idea from a chat pick */
  goalMaxChars: 400,
  noteMaxChars: 500,
} as const;

/** How far a search reaches, in miles. */
export const RADIUS_OPTIONS = [5, 10, 15, 20] as const;
export type RadiusMi = (typeof RADIUS_OPTIONS)[number];
export const DEFAULT_RADIUS: RadiusMi = 10;

/** Miles between two points (straight line). */
export function milesBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export const OPT_OUT_LINE = "If you'd rather not hear from me, just let me know.";

export type CategoryId =
  | "cafes"
  | "restaurants"
  | "bars"
  | "bakeries"
  | "ice_cream"
  | "salons"
  | "gyms"
  | "spa"
  | "florists"
  | "retail"
  | "fun"
  | "breweries"
  | "hotels"
  | "venues";

/** Category chips and the OpenStreetMap tags each one searches for. */
export const CATEGORIES: { id: CategoryId; label: string; tags: [string, string][] }[] = [
  { id: "cafes", label: "Cafés", tags: [["amenity", "cafe"]] },
  { id: "restaurants", label: "Restaurants", tags: [["amenity", "restaurant"], ["amenity", "fast_food"]] },
  { id: "bars", label: "Bars", tags: [["amenity", "bar"], ["amenity", "pub"]] },
  { id: "bakeries", label: "Bakeries", tags: [["shop", "bakery"], ["shop", "pastry"]] },
  { id: "ice_cream", label: "Ice cream", tags: [["amenity", "ice_cream"]] },
  { id: "salons", label: "Salons & barbers", tags: [["shop", "hairdresser"], ["shop", "beauty"]] },
  // Fitness centres include yoga, pilates and barre studios on the map. Not leisure=sports_centre
  // (mostly pools, racetracks, rinks and ball fields) or leisure=spa (mostly pools and hot tubs).
  { id: "gyms", label: "Gyms & yoga", tags: [["leisure", "fitness_centre"], ["amenity", "dojo"]] },
  { id: "spa", label: "Massage & spa", tags: [["shop", "massage"]] },
  { id: "florists", label: "Florists", tags: [["shop", "florist"]] },
  // "Any other shop": every shop=* except the shop types the chips above already cover.
  { id: "retail", label: "Retail", tags: [["shop", "*"]] },
  { id: "fun", label: "Mini golf & fun", tags: [["leisure", "miniature_golf"], ["leisure", "amusement_arcade"], ["leisure", "bowling_alley"], ["leisure", "escape_game"], ["leisure", "trampoline_park"]] },
  { id: "breweries", label: "Breweries & wineries", tags: [["craft", "brewery"], ["craft", "winery"], ["craft", "distillery"]] },
  { id: "hotels", label: "Hotels & inns", tags: [["tourism", "hotel"], ["tourism", "guest_house"], ["tourism", "motel"]] },
  { id: "venues", label: "Event venues & theaters", tags: [["amenity", "events_venue"], ["amenity", "theatre"]] },
];
/** Searches made before a category's map tags last changed aren't reused (their results were wrong). */
export const CATEGORY_CHANGED: Partial<Record<CategoryId, string>> = {
  // After the deploy that dropped sports centres and spas (an earlier, too-early cutoff let
  // searches made by the old code be reused).
  gyms: "2026-10-15T22:00:00Z",
  spa: "2026-10-15T22:00:00Z",
};

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? "Business";

export type LeadStatus = "new" | "email_found" | "drafted" | "contacted" | "replied" | "not_interested";
export const LEAD_STATUSES: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "email_found", label: "Email found" },
  { id: "drafted", label: "Drafted" },
  { id: "contacted", label: "Contacted" },
  { id: "replied", label: "Replied" },
  { id: "not_interested", label: "Not interested" },
];

export type Lead = {
  id: string;
  source: "osm" | "manual";
  town: string | null;
  category: string;
  name: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  /** Where the email was found: a page address, "openstreetmap" or "added by you" */
  emailSource: string | null;
  contactPage: string | null;
  instagram: string | null;
  facebook: string | null;
  status: LeadStatus;
  note: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  emailCheckedAt: string | null;
  /** Miles from the town searched (only in search results) */
  distanceMi?: number | null;
  /** In the owner's Outreach list. Chat results aren't until they tap Save to Outreach. */
  saved?: boolean;
  /** Second's idea from the chat card it was saved from (newest card) */
  idea?: { why: string; dealIdea: string } | null;
  // ---------- Partners pipeline (supabase/partners.sql) ----------
  /** found -> emailed -> replied -> deal. "Not interested" is status = not_interested. */
  stage?: PartnerStage;
  emailedAt?: string | null;
  /** YYYY-MM-DD */
  followUpOn?: string | null;
  repliedAt?: string | null;
  dealAt?: string | null;
  deal?: DealTerms | null;
  /** Where it is (public map data), for onboarding's little map */
  lat?: number | null;
  lon?: number | null;
};

export type PartnerStage = "found" | "emailed" | "replied" | "deal";
export const PARTNER_STAGES: { id: PartnerStage; label: string }[] = [
  { id: "found", label: "Found" },
  { id: "emailed", label: "Emailed" },
  { id: "replied", label: "Replied" },
  { id: "deal", label: "Deal" },
];

/**
 * A partner deal: percent off, dollars off, or something custom (no automatic discount).
 * Optional: only one catalog option. The database works out the discount from these (never
 * from the browser), never below $0.
 */
export type DealTerms = { type: "percent" | "amount_off" | "custom"; value: number | null; variantId: string | null; note: string | null };

/** The deal discount for one entry (preview only: the database does the real sum). */
export function dealDiscount(deal: DealTerms | null | undefined, entry: { unitPrice: number; quantity: number; variantId: string }): number {
  if (!deal || deal.value === null || deal.type === "custom") return 0;
  if (deal.variantId && deal.variantId !== entry.variantId) return 0;
  const base = entry.unitPrice * entry.quantity;
  const off = deal.type === "percent" ? (base * Math.min(Math.max(deal.value, 0), 100)) / 100 : Math.max(deal.value, 0) * entry.quantity;
  return Math.round(Math.min(off, base) * 100) / 100;
}

/** "15% off" / "$15 off Deep tissue, 60 min" / their own words */
export function dealText(deal: DealTerms | null | undefined, optionName?: string | null): string {
  if (!deal) return "";
  const on = optionName ? ` ${optionName}` : "";
  if (deal.type === "percent" && deal.value !== null) return `${deal.value}% off${on}`.trim();
  if (deal.type === "amount_off" && deal.value !== null) return `$${deal.value % 1 ? deal.value.toFixed(2) : deal.value} off${on}`.trim();
  return deal.note ?? "Custom deal";
}

export type OutreachUsage = { lookupsLeft: number; draftsLeft: number; searchesLeft: number };

/**
 * POST /api/outreach
 *   { action: "search", town, state, category, hideChains, radiusMi, fresh? } -> { status: "leads", leads, reused, usage }
 *   { action: "find_email", leadId }                         -> { status: "lead", lead, found, message?, usage }
 *   { action: "draft", leadId, goal }                        -> { status: "draft", subject, body, lead, usage }
 *   { action: "add_manual", name, website, email, category } -> { status: "lead", lead, found: false, usage }
 *   { action: "usage" }                                      -> { status: "usage", usage }
 */
export type OutreachResponse =
  | { status: "leads"; leads: Lead[]; reused: boolean; town: string; usage: OutreachUsage }
  | { status: "lead"; lead: Lead; found: boolean; message?: string; usage: OutreachUsage }
  | { status: "draft"; subject: string; body: string; lead: Lead; usage: OutreachUsage }
  | { status: "usage"; usage: OutreachUsage }
  | { status: "error"; message: string };

/** A plain email address (no spaces, "?", "&" or anything that could sneak extra fields into a mailto: link). */
export const isEmailAddress = (s: string) => /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(s);

/** The mailto: link for "Open in my email app" (subject and body filled in). */
export function mailtoLink(to: string | null, subject: string, body: string): string {
  const address = to && isEmailAddress(to) ? to : "";
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
