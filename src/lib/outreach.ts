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
  goalMaxChars: 150,
  noteMaxChars: 500,
} as const;

export const OPT_OUT_LINE = "If you'd rather not hear from me, just let me know.";

export type CategoryId = "cafes" | "restaurants" | "bars" | "bakeries" | "ice_cream" | "salons" | "gyms" | "spa" | "florists" | "retail";

/** Category chips and the OpenStreetMap tags each one searches for. */
export const CATEGORIES: { id: CategoryId; label: string; tags: [string, string][] }[] = [
  { id: "cafes", label: "Cafés", tags: [["amenity", "cafe"]] },
  { id: "restaurants", label: "Restaurants", tags: [["amenity", "restaurant"], ["amenity", "fast_food"]] },
  { id: "bars", label: "Bars", tags: [["amenity", "bar"], ["amenity", "pub"]] },
  { id: "bakeries", label: "Bakeries", tags: [["shop", "bakery"], ["shop", "pastry"]] },
  { id: "ice_cream", label: "Ice cream", tags: [["amenity", "ice_cream"]] },
  { id: "salons", label: "Salons & barbers", tags: [["shop", "hairdresser"], ["shop", "beauty"]] },
  { id: "gyms", label: "Gyms & yoga", tags: [["leisure", "fitness_centre"], ["sport", "yoga"]] },
  { id: "spa", label: "Massage & spa", tags: [["shop", "massage"], ["leisure", "spa"]] },
  { id: "florists", label: "Florists", tags: [["shop", "florist"]] },
  // "Any other shop": every shop=* except the shop types the chips above already cover.
  { id: "retail", label: "Retail", tags: [["shop", "*"]] },
];
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
};

export type OutreachUsage = { lookupsLeft: number; draftsLeft: number; searchesLeft: number };

/**
 * POST /api/outreach
 *   { action: "search", town, state, category, hideChains } -> { status: "leads", leads, reused, usage }
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
