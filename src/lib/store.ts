// The ONLY place that saves or loads app data. Pages and components use these
// functions (through src/lib/data.tsx), never localStorage or Supabase directly.
//
// Where data lives depends on who's using the app:
//   - Signed in to an account: Supabase (store-supabase.ts), one set of rows per person.
//   - "Try the demo": this browser's localStorage (store-local.ts).
// The functions below look the same either way, so pages don't care which.

import type { BusinessType } from "./business-types";
import type { BetaProblems, BetaSignup } from "./beta";
import type {
  BusinessCard,
  BusinessNote,
  ChatProposal,
  ChatRole,
  ChatStreamEvent,
  ProposalChange,
  ProposalStatus,
  SavedChatMessage,
} from "./chat";
import { SAMPLE_NOTES, sampleContentWeek, sampleLeads, sampleOutreachDraft, sampleWeek } from "./demo-content";
import type { ContentPost, ContentResponse, ContentWeek, PostStatus } from "./content";
import type { ActionStatus, WeekPlan, WeekResponse } from "./week";
import { dealDiscount, OUTREACH_LIMITS, type DealTerms, type Lead, type LeadStatus, type OutreachResponse, type OutreachUsage, type PartnerStage } from "./outreach";
import { buildDemoAccount, sampleCatalogDraft, sampleMatches } from "./demo-content";
import type { Match, MatchesResponse } from "./matches";
import type { CatalogDraft, CatalogResponse, DraftLine } from "./catalog-extract";
import { capital, wordsFor } from "./business-kinds";
import { formatMoney } from "./money";
import {
  activeItems,
  activeVariants,
  CATALOG_LIMITS,
  entryTotal,
  findVariant,
  itemProblems,
  newItem,
  newVariant,
  servicesFromCatalog,
  validPrice,
  type CatalogItem,
} from "./catalog";
import { localBackend } from "./store-local";
import { createSupabaseBackend } from "./store-supabase";
import { supabase, supabaseConfigured } from "./supabase";

// ---------- Types ----------

export type Mode = "launch" | "running";

export type Service = {
  id: string;
  name: string;
  price: number;
  /** Length in minutes. Optional: some businesses charge per order or job. */
  minutes?: number;
};

export type Business = {
  ownerName: string;
  businessName: string;
  type: BusinessType;
  /** Shown to the user. For "Something else" this is what they typed. */
  typeLabel: string;
  area: string;
  /** The first service is the main one. Its price drives the money plan. */
  services: Service[];
  /** What they want to pay themselves each month, in dollars */
  payGoal: number;
  /** Running mode: a goal in their own words, like "10 new clients by December" */
  goalNote?: string;
  /** Launch mode: target opening day, YYYY-MM-DD */
  openingDay?: string;
  createdAt: string;
  /** Set when they graduate from Launch mode */
  launchedAt?: string;
  /** How captions sound. Unset = warm */
  contentTone?: ContentTone;
};

export type ContentTone = "warm" | "fun" | "professional";

export type CostLine = { id: string; label: string; amount: number };

export type MoneyPlan = {
  monthlyCosts: CostLine[];
  startupCosts: CostLine[];
  /** Saved so far toward startup costs */
  saved: number;
};

export type Transaction = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kind: "income" | "expense";
  amount: number;
  label: string;
  category: string;
  /** Income only, optional: who paid. Used to spot clients who haven't come back. */
  clientName?: string;
  // From the catalog (all optional; entries typed by hand have none of these).
  // `amount` and `label` are a snapshot: changing the catalog never changes past entries.
  itemId?: string;
  variantId?: string;
  quantity?: number;
  /** The price used for this entry (editable when logging) */
  unitPrice?: number;
  discount?: number;
  /** Tips are income but not part of the price (kept out of best sellers and price math) */
  tip?: number;
  /** "Got paid" on a calendar appointment, and which day (weekly repeats) */
  eventId?: string;
  eventDate?: string;
  /** "From a partner?": the partner business (a lead at the deal stage). The database applies its deal. */
  partnerLeadId?: string;
};

// ---------- Calendar ----------

export type EventType = "appointment" | "business" | "deadline" | "reminder";
export type EventSource = "manual" | "roadmap" | "second";

export type CalendarEvent = {
  id: string;
  title: string;
  type: EventType;
  allDay: boolean;
  /**
   * Timed events: an exact moment as an ISO string in UTC, like "2026-10-06T14:00:00.000Z".
   * All-day events: a plain date, "YYYY-MM-DD".
   */
  start: string;
  /** Same format as `start`. For all-day events, the last day (inclusive). */
  end: string;
  /** Where it was made, like "America/New_York". Weekly repeats keep this local time. */
  timeZone: string;
  clientName?: string;
  price?: number;
  location?: string;
  notes?: string;
  repeatsWeekly: boolean;
  /** Last day a weekly repeat happens, "YYYY-MM-DD" (inclusive). Empty = keeps going. */
  repeatUntil?: string;
  source: EventSource;
  roadmapTaskId?: string;
};

/**
 * What you need to add an event. Only title, type, and start are required:
 * the end defaults to 1 hour later (or the same day if all-day), the time zone
 * to this device's, and the source to "manual".
 */
export type NewEvent = Pick<CalendarEvent, "title" | "type" | "start"> &
  Partial<Omit<CalendarEvent, "id" | "title" | "type" | "start">>;

/** Who is using the app right now. */
export type Account = { kind: "demo" } | { kind: "user"; email: string };

/** What every storage backend has to do. */
export type Backend = {
  getBusiness(): Promise<Business | null>;
  saveBusiness(business: Business): Promise<void>;
  getMode(): Promise<Mode | null>;
  saveMode(mode: Mode): Promise<void>;
  /** True when sample content should fill the not-yet-built AI sections (demo only) */
  getShowSamples(): Promise<boolean>;
  getTasks(): Promise<string[]>;
  completeTask(taskId: string): Promise<void>;
  uncompleteTask(taskId: string): Promise<void>;
  getMoneyPlan(): Promise<MoneyPlan | null>;
  saveMoneyPlan(plan: MoneyPlan): Promise<void>;
  getTransactions(): Promise<Transaction[]>;
  /** Everything the business sells, including hidden items (past entries still name them) */
  getCatalog(): Promise<CatalogItem[]>;
  /** Add or change one item and its variants (variants are never deleted, only hidden). */
  saveCatalogItem(item: CatalogItem): Promise<void>;
  addTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  getEvents(): Promise<CalendarEvent[]>;
  addEvent(event: CalendarEvent): Promise<void>;
  /** Replace the whole event (same id). */
  updateEvent(event: CalendarEvent): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  resetAll(): Promise<void>;
};

// ---------- Small browser keys (not business data) ----------

export const STORAGE_KEYS = {
  /** Set while someone is trying the demo */
  demo: "second:v1:demo",
  /** Last known mode, so the right sidebar shows before data loads (see boot.ts) */
  modeHint: "second:v1:mode-hint",
  /** The "Take a tour" welcome card was shown (on this device) */
  tourOffered: "second:v1:tour-offered",
} as const;

function setKey(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked. The app still works, just less smoothly.
  }
}

function getKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------- Change notifications ----------

const listeners = new Set<() => void>();
const errorListeners = new Set<(message: string) => void>();
let authWatching = false;

/** Call `listener` whenever saved data or the signed-in person changes. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  watchAuth();
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("second:")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Call `listener` with a plain-English message when a change couldn't be saved. */
export function onSaveError(listener: (message: string) => void): () => void {
  errorListeners.add(listener);
  return () => errorListeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

function reportSaveError(error: unknown) {
  console.error("Second could not save a change:", error);
  const message = "We couldn't save your last change. Check your internet connection, then try again.";
  errorListeners.forEach((listener) => listener(message));
}

function watchAuth() {
  if (authWatching || !supabaseConfigured()) return;
  authWatching = true;
  supabase().auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "PASSWORD_RECOVERY") {
      // Don't call Supabase from inside this callback; do it right after.
      setTimeout(notify, 0);
    }
  });
  // Try to save anything still waiting if the page is closing.
  window.addEventListener("pagehide", () => remote?.backend.flush());
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Which backend is in use ----------

let remote: { userId: string; backend: ReturnType<typeof createSupabaseBackend> } | null = null;

async function currentUser() {
  if (!supabaseConfigured()) return null;
  const { data } = await supabase().auth.getSession();
  return data.session?.user ?? null;
}

async function backend(): Promise<Backend | null> {
  const user = await currentUser();
  if (user) {
    if (remote?.userId !== user.id) remote = { userId: user.id, backend: createSupabaseBackend(user.id, reportSaveError) };
    return remote.backend;
  }
  remote = null;
  return getKey(STORAGE_KEYS.demo) === "1" ? localBackend : null;
}

async function mustHaveBackend(): Promise<Backend> {
  const b = await backend();
  if (!b) throw new Error("Please log in or try the demo first.");
  return b;
}

/** Run a change, then tell the app something changed. */
async function change(run: (b: Backend) => Promise<void>) {
  await run(await mustHaveBackend());
  notify();
}

// ---------- Accounts ----------

export async function getAccount(): Promise<Account | null> {
  const user = await currentUser();
  if (user) return { kind: "user", email: user.email ?? "" };
  return getKey(STORAGE_KEYS.demo) === "1" ? { kind: "demo" } : null;
}

export type AuthResult = { ok: true; needsEmailConfirmation?: boolean } | { ok: false; message: string };

function friendlyAuthError(error: { code?: string; message?: string; status?: number } | null): string {
  switch (error?.code) {
    case "invalid_credentials":
      return "That email and password don't match. Try again, or reset your password.";
    case "user_already_exists":
    case "email_exists":
      return "There's already an account with that email. Try logging in instead.";
    case "weak_password":
      return "Please pick a longer password. Use at least 8 letters, numbers, or symbols.";
    case "email_address_invalid":
      return "That email address doesn't look right. Please check it.";
    case "email_not_confirmed":
      return "Please confirm your email first. Look for a message from Second in your inbox.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many tries in a short time. Please wait a few minutes and try again.";
    case "same_password":
      return "That's your current password. Please pick a new one.";
  }
  if (!error?.status) return "We couldn't reach Second. Check your internet connection and try again.";
  return "Something went wrong. Please try again in a moment.";
}

function startFresh() {
  remote = null;
  setKey(STORAGE_KEYS.demo, null);
  setKey(STORAGE_KEYS.modeHint, null);
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase().auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  startFresh();
  notify();
  // With "Confirm email" on, there's no session until they click the link in the email.
  return { ok: true, needsEmailConfirmation: !data.session };
}

export async function logIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: friendlyAuthError(error) };
  startFresh();
  notify();
  return { ok: true };
}

export async function logOut(): Promise<void> {
  await remote?.backend.settle(); // finish saving before the session ends
  await supabase().auth.signOut();
  startFresh();
  notify();
}

/** Email a link that opens /reset-password. */
export async function sendPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await supabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

/** Set a new password. Works after opening the reset link (or while logged in). */
export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase().auth.updateUser({ password });
  return error ? { ok: false, message: friendlyAuthError(error) } : { ok: true };
}

/**
 * Use the app without an account, filled with Maria's sample business.
 * Everything stays in this browser; the demo never writes to the database.
 */
export async function startDemo(): Promise<void> {
  if (await currentUser()) {
    await remote?.backend.settle();
    await supabase().auth.signOut();
  }
  remote = null;
  setKey(STORAGE_KEYS.demo, "1");
  const demo = buildDemoAccount();
  await localBackend.fill(demo);
  setKey(STORAGE_KEYS.modeHint, demo.mode);
  notify();
}

export async function leaveDemo(): Promise<void> {
  setKey(STORAGE_KEYS.demo, null);
  setKey(STORAGE_KEYS.modeHint, null);
  notify();
}

// ---------- Business profile ----------

export async function getBusiness(): Promise<Business | null> {
  const b = await backend();
  if (!b) return null;
  const [business, catalog] = await Promise.all([b.getBusiness(), b.getCatalog()]);
  // `services` always comes from the catalog (the one source of truth), never businesses.services.
  return business ? { ...business, services: servicesFromCatalog(catalog) } : business;
}

export async function saveBusiness(business: Business): Promise<void> {
  await change((b) => b.saveBusiness(business));
}

/** Change the main service's price (shared by the profile and the money plan). */
export async function saveMainPrice(price: number): Promise<void> {
  if (!validPrice(price)) return;
  const first = activeItems(await getCatalog())[0];
  if (!first) return;
  const vs = activeVariants(first);
  const main = vs.find((v) => v.isDefault) ?? vs[0];
  await saveCatalogItem({ ...first, variants: first.variants.map((v) => (v.id === main.id ? { ...v, price } : v)) });
}

// ---------- Catalog (what the business sells) ----------

/** Everything they sell, including hidden items. Use activeItems() for what's on sale now. */
export async function getCatalog(): Promise<CatalogItem[]> {
  return (await backend())?.getCatalog() ?? [];
}

/** Add or change an item. Checked here and again by the database (prices $0 to $10,000). */
export async function saveCatalogItem(item: CatalogItem): Promise<{ ok: true } | { ok: false; message: string }> {
  const problems = itemProblems(item);
  if (problems.length) return { ok: false, message: problems[0] };
  const all = await getCatalog();
  if (!all.some((i) => i.id === item.id) && activeItems(all).length >= CATALOG_LIMITS.maxItems)
    return { ok: false, message: `You can list up to ${CATALOG_LIMITS.maxItems} things.` };
  await change((b) => b.saveCatalogItem({ ...item, name: item.name.trim() }));
  return { ok: true };
}

/** "Delete": hides it. Past money entries still show what they were. */
export async function hideCatalogItem(id: string): Promise<void> {
  const item = (await getCatalog()).find((i) => i.id === id);
  if (item) await change((b) => b.saveCatalogItem({ ...item, active: false }));
}

// ---------- "Find prices Second already knows" ----------

export type DraftResult = { ok: true; draft: CatalogDraft; message?: string; sample: boolean } | { ok: false; message: string };

/** One Haiku look at their notes and approved cards. Returns a draft; nothing is saved. */
export async function findCatalogPrices(): Promise<DraftResult> {
  if (await isDemo()) return { ok: true, draft: sampleCatalogDraft(await getCatalog()), sample: true };
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please log in." };
  try {
    const res = await fetch("/api/catalog", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "extract" }) });
    const body = (await res.json()) as CatalogResponse;
    if (body.status === "error") return { ok: false, message: body.message };
    return { ok: true, draft: { lines: body.lines, questions: body.questions, dropped: body.dropped }, message: body.message, sample: false };
  } catch {
    return { ok: false, message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

/** Save the draft lines the owner approved (each through saveCatalogItem, which checks prices). */
export async function applyCatalogDraft(lines: DraftLine[]): Promise<{ ok: true; saved: number } | { ok: false; message: string; saved: number }> {
  const business = await getBusiness();
  if (!business) return { ok: false, message: "Please finish setting up first.", saved: 0 };
  let saved = 0;
  for (const line of lines) {
    const catalog = await getCatalog();
    let r: { ok: true } | { ok: false; message: string };
    if (line.type === "new_item") {
      const position = catalog.reduce((max, i) => Math.max(max, i.position + 1), 0);
      const item = newItem({ name: line.itemName, price: line.price, minutes: line.minutes, type: business.type, position });
      if (line.optionLabel) item.variants = item.variants.map((v) => ({ ...v, label: line.optionLabel }));
      r = await saveCatalogItem(item);
    } else {
      const item = catalog.find((i) => i.id === line.itemId);
      if (!item) return { ok: false, message: `${line.itemName} isn't in your list anymore.`, saved };
      if (line.type === "new_option") {
        // The first option gets a name too, so both show as choices ("60 min", "90 min").
        const named = item.variants.map((v) => (v.active && !v.label.trim() && v.minutes ? { ...v, label: `${v.minutes} min` } : v));
        const position = item.variants.reduce((m, v) => Math.max(m, v.position + 1), 0);
        r = await saveCatalogItem({ ...item, variants: [...named, { ...newVariant(position, line.optionLabel, line.price, line.minutes), price: line.price }] });
      } else r = await saveCatalogItem({ ...item, variants: item.variants.map((v) => (v.id === line.variantId ? { ...v, price: line.price } : v)) });
    }
    if (!r.ok) return { ok: false, message: `${line.itemName}: ${r.message}`, saved };
    saved++;
  }
  return { ok: true, saved };
}

/** Onboarding: turn the chosen services into catalog items, only if the catalog is empty. */
export async function ensureCatalog(services: Service[], type: BusinessType): Promise<void> {
  if ((await getCatalog()).length) return;
  for (const [n, s] of services.entries()) {
    if (!s.name.trim() || !validPrice(s.price)) continue;
    await change((b) => b.saveCatalogItem(newItem({ name: s.name, price: s.price, minutes: s.minutes ?? null, type, position: n })));
  }
}

export async function savePayGoal(payGoal: number): Promise<void> {
  const business = await getBusiness();
  if (!business) return;
  await saveBusiness({ ...business, payGoal });
}

// ---------- Mode ----------

export async function getMode(): Promise<Mode | null> {
  const mode = (await (await backend())?.getMode()) ?? null;
  if (mode) setKey(STORAGE_KEYS.modeHint, mode);
  return mode;
}

export async function saveMode(mode: Mode): Promise<void> {
  setKey(STORAGE_KEYS.modeHint, mode);
  await change((b) => b.saveMode(mode));
}

/** True when the not-yet-built AI sections should show sample content (demos only). */
export async function getShowSamples(): Promise<boolean> {
  return (await (await backend())?.getShowSamples()) ?? false;
}

// ---------- Demo data for screenshots (server-checked, own account only) ----------

async function demoDataRequest(action: "check" | "load" | "remove"): Promise<{ ok: boolean; allowed?: boolean; message?: string }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please log in first." };
  try {
    const res = await fetch("/api/demo-data", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, timeZone: deviceTimeZone() }),
    });
    return await res.json();
  } catch {
    return { ok: false, message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

/** Whether this account may use "Load demo data". The server decides (DEMO_DATA_EMAILS). */
export async function canLoadDemoData(): Promise<boolean> {
  if (!(await currentUser())) return false;
  const result = await demoDataRequest("check");
  return result.ok && result.allowed === true;
}

/** Replace this account's data with Maria's sample business. Only works for allowed emails. */
export async function loadDemoData(): Promise<AuthResult> {
  await remote?.backend.settle();
  const result = await demoDataRequest("load");
  if (!result.ok) return { ok: false, message: result.message ?? "Something went wrong. Please try again." };
  remote = null; // read the new data fresh
  setKey(STORAGE_KEYS.modeHint, "running");
  notify();
  return { ok: true };
}

/** Empty this account again (business data only; the login stays). */
export async function removeDemoData(): Promise<AuthResult> {
  await remote?.backend.settle();
  const result = await demoDataRequest("remove");
  if (!result.ok) return { ok: false, message: result.message ?? "Something went wrong. Please try again." };
  remote = null;
  setKey(STORAGE_KEYS.modeHint, null);
  notify();
  return { ok: true };
}

// ---------- Chat with Second (logged-in accounts only, never the demo) ----------

export type ChatHistoryResult = { ok: true; messages: SavedChatMessage[] } | { ok: false; message: string };

/** The latest saved messages, oldest first. */
export async function getChatHistory(count = 100): Promise<ChatHistoryResult> {
  const user = await currentUser();
  if (!user) return { ok: false, message: "Please log in to chat with Second." };
  const { data, error } = await supabase()
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(count);
  if (error) return { ok: false, message: "We couldn't load your earlier messages. Please refresh the page." };
  const ids = data.filter((r) => r.role === "assistant").map((r) => r.id as string);
  // Cards are optional: if the memory tables aren't set up yet, chat still loads.
  const { data: cards } = ids.length
    ? await supabase().from("chat_proposals").select("id, message_id, summary, details, status").in("message_id", ids)
    : { data: [] };
  const cardsFor = (messageId: string): ChatProposal[] =>
    (cards ?? [])
      .filter((c) => c.message_id === messageId)
      .map((c) => ({ id: c.id, messageId, summary: c.summary, change: c.details as ProposalChange, status: c.status as ProposalStatus }));
  // Business picks are optional too (chat-outreach.sql), and disappear with their lead (Start over).
  const { data: picks } = ids.length
    ? await supabase()
        .from("chat_business_cards")
        .select("id, message_id, lead_id, why, deal_idea, next_step, distance_mi, outreach_leads(name, category, address, town, website, phone, email, email_source, saved)")
        .in("message_id", ids)
        .order("created_at")
    : { data: [] };
  const picksFor = (messageId: string): BusinessCard[] =>
    ((picks ?? []) as Record<string, unknown>[])
      .filter((c) => c.message_id === messageId && c.outreach_leads)
      .map((c) => {
        const l = c.outreach_leads as Record<string, unknown>;
        return {
          id: c.id as string,
          messageId,
          leadId: c.lead_id as string,
          name: l.name as string,
          category: l.category as string,
          address: (l.address as string | null) ?? null,
          town: (l.town as string | null) ?? null,
          distanceMi: (c.distance_mi as number | null) ?? null,
          website: (l.website as string | null) ?? null,
          phone: (l.phone as string | null) ?? null,
          email: (l.email as string | null) ?? null,
          emailSource: (l.email_source as string | null) ?? null,
          saved: l.saved !== false,
          why: c.why as string,
          dealIdea: c.deal_idea as string,
          nextStep: c.next_step as string,
        };
      });
  return {
    ok: true,
    messages: data
      .map((r) => ({
        id: r.id as string,
        role: r.role as ChatRole,
        content: r.content as string,
        createdAt: r.created_at as string,
        proposals: cardsFor(r.id as string),
        businessCards: picksFor(r.id as string),
      }))
      .reverse(),
  };
}

export type ChatSendResult =
  | { ok: true; remaining: number }
  | { ok: false; message: string; limit?: boolean };

/**
 * Ask Second something. The reply streams in through onText, a piece at a time.
 * Goes through the server (/api/chat), which holds the Claude API key and saves both messages.
 */
export type ChatHandlers = {
  onText: (piece: string) => void;
  onProposals?: (messageId: string, proposals: ChatProposal[]) => void;
  /** What Second is doing right now ("Looking at the map…"), not part of the reply */
  onStatus?: (text: string) => void;
  onBusinessCards?: (messageId: string, cards: BusinessCard[]) => void;
  onCardEmail?: (leadId: string, email: string | null, emailSource: string | null) => void;
};

export async function sendChatMessage(message: string, handlers: ChatHandlers, about?: { leadId?: string | null }): Promise<ChatSendResult> {
  const { onText, onProposals, onStatus, onBusinessCards, onCardEmail } = handlers;
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please log in to chat with Second." };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, timeZone: deviceTimeZone(), ...(about?.leadId ? { aboutLeadId: about.leadId } : {}) }),
    });
    if (!res.body) return { ok: false, message: "We couldn't reach Second. Check your internet connection and try again." };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: ChatSendResult | null = null;
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line) as ChatStreamEvent;
        if (event.type === "text") onText(event.text);
        else if (event.type === "proposals") onProposals?.(event.messageId, event.proposals);
        else if (event.type === "status") onStatus?.(event.text);
        else if (event.type === "business_cards") onBusinessCards?.(event.messageId, event.cards);
        else if (event.type === "card_email") onCardEmail?.(event.leadId, event.email, event.emailSource);
        else if (event.type === "done") result = { ok: true, remaining: event.remaining };
        else if (event.type === "error") result = { ok: false, message: event.message, limit: event.limit };
      }
      if (done) break;
    }
    return result ?? { ok: false, message: "Second stopped partway through. Please try again." };
  } catch {
    return { ok: false, message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

// ---------- Suggested updates: only the owner's Approve writes ----------

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Make the change on a card, with the same functions Settings and the Calendar use. */
/** A card that can't be saved as it is: the catalog changed since it was made. */
type CardCheck = { retry: ProposalChange; message: string } | { removed: string };

/**
 * "Log income" cards are re-checked against the catalog when Approve is tapped: if the option
 * was hidden or its price changed since the card was made, nothing is saved.
 */
async function recheckIncome(change: Extract<ProposalChange, { kind: "log_income" }>): Promise<CardCheck | null> {
  const business = await getBusiness();
  const item = (await getCatalog()).find((i) => i.id === change.itemId);
  const variant = item?.variants.find((v) => v.id === change.variantId);
  if (!item || !item.active || !variant || !variant.active) return { removed: `This ${wordsFor(business?.type).item} was removed. Nothing was logged.` };
  const madeWith = change.catalogPrice ?? change.unitPrice;
  if (variant.price === madeWith) return null;
  // They said a price of their own: keep it. Otherwise use the new catalog price.
  const unitPrice = change.unitPrice === madeWith ? variant.price : change.unitPrice;
  const total = entryTotal({ unitPrice, quantity: change.quantity, discount: change.discount, tip: change.tip });
  if (total <= 0) return { removed: `The price of ${change.label} changed. Nothing was logged.` };
  return {
    retry: { ...change, unitPrice, catalogPrice: variant.price, total },
    message: `Price changed to ${formatMoney(variant.price)}. Log ${formatMoney(total)} instead?`,
  };
}

async function applyChange(change: ProposalChange): Promise<boolean> {
  const business = await getBusiness();
  if (!business) return false;
  const catalog = await getCatalog();
  // Price changes go to the catalog, the one source of truth (never businesses.services).
  switch (change.kind) {
    case "set_price": {
      const found = findVariant(catalog, change.service);
      if (!found || !validPrice(change.newPrice)) return false;
      const { item, variant } = found;
      return (await saveCatalogItem({ ...item, variants: item.variants.map((v) => (v.id === variant.id ? { ...v, price: change.newPrice } : v)) })).ok;
    }
    case "add_service": {
      if (findVariant(catalog, change.name) || activeItems(catalog).some((i) => same(i.name, change.name))) return false;
      const position = catalog.reduce((max, i) => Math.max(max, i.position + 1), 0);
      return (await saveCatalogItem(newItem({ name: change.name, price: change.price, minutes: change.minutes, type: business.type, position }))).ok;
    }
    case "remove_service": {
      const found = findVariant(catalog, change.service);
      if (!found || business.services.length < 2) return false;
      const { item, variant } = found;
      // One option of several: hide that option. Otherwise hide the whole item.
      if (activeVariants(item).length > 1)
        return (await saveCatalogItem({ ...item, variants: item.variants.map((v) => (v.id === variant.id ? { ...v, active: false } : v)) })).ok;
      await hideCatalogItem(item.id);
      return true;
    }
    case "set_pay_goal":
      await savePayGoal(change.newGoal);
      return true;
    case "log_income": {
      // Only if that option is still on sale; the database works out the total again.
      const item = catalog.find((i) => i.id === change.itemId && i.active);
      if (!item || !item.variants.some((v) => v.id === change.variantId && v.active)) return false;
      await addTransaction({
        kind: "income",
        amount: change.total,
        label: change.label,
        category: capital(wordsFor(business.type).visit),
        date: change.date,
        itemId: change.itemId,
        variantId: change.variantId,
        quantity: change.quantity,
        unitPrice: change.unitPrice,
        ...(change.discount ? { discount: change.discount } : {}),
        ...(change.tip ? { tip: change.tip } : {}),
        ...(change.clientName ? { clientName: change.clientName } : {}),
      });
      return true;
    }
    case "add_event":
      await addEvent({
        title: change.title,
        type: change.type,
        allDay: change.allDay,
        start: change.start,
        end: change.end,
        timeZone: change.timeZone,
        ...(change.clientName ? { clientName: change.clientName } : {}),
        source: "second",
      });
      return true;
    case "move_event": {
      const event = (await getEvents()).find((e) => e.id === change.eventId);
      if (!event || event.repeatsWeekly) return false;
      await updateEvent(event.id, { allDay: change.allDay, start: change.start, end: change.end });
      return true;
    }
    case "cancel_event": {
      const event = (await getEvents()).find((e) => e.id === change.eventId);
      if (!event || event.repeatsWeekly) return false;
      await deleteEvent(event.id);
      return true;
    }
  }
}

async function setCardStatus(id: string, status: ProposalStatus): Promise<boolean> {
  const { error } = await supabase().from("chat_proposals").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export type CardResult =
  | { ok: true; status: ProposalStatus }
  | { ok: false; message: string; status?: ProposalStatus; retry?: ProposalChange };

/** Approve a card: make the change under the owner's own login, then mark the card. */
export async function approveProposal(card: ChatProposal): Promise<CardResult> {
  if (!(await currentUser())) return { ok: false, message: "Please log in again." };
  try {
    if (card.change.kind === "log_income") {
      const check = await recheckIncome(card.change);
      if (check && "removed" in check) {
        await setCardStatus(card.id, "stale");
        return { ok: false, message: check.removed, status: "stale" };
      }
      // Nothing saved: the owner confirms the new amount first ("Log $Y instead?").
      if (check) return { ok: false, message: check.message, retry: check.retry };
    }
    const applied = await applyChange(card.change);
    await remote?.backend.settle(); // make sure it's saved before Second's next reply reads it
    const status: ProposalStatus = applied ? "approved" : "stale";
    if (!(await setCardStatus(card.id, status))) return { ok: false, message: "That was saved, but the card didn't update. Refresh the page to see it." };
    return { ok: true, status };
  } catch {
    return { ok: false, message: "We couldn't make that change. Please try again." };
  }
}

/** Ignore a card. Nothing else changes. */
export async function ignoreProposal(card: ChatProposal): Promise<CardResult> {
  return (await setCardStatus(card.id, "ignored")) ? { ok: true, status: "ignored" } : { ok: false, message: "Please try again." };
}

// ---------- Business notes ("What Second knows") ----------

/**
 * Ask the server to update the notes from recent chats. It only calls the AI when there are
 * new messages since the last time, and never more than the daily cap. Never runs in the demo.
 */
export async function refreshNotes(): Promise<{ ran: boolean; changed: number }> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ran: false, changed: 0 };
  try {
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    });
    const out = (await res.json()) as { ok?: boolean; ran?: boolean; changed?: number };
    return { ran: Boolean(out.ran), changed: out.changed ?? 0 };
  } catch {
    return { ran: false, changed: 0 };
  }
}

export type NotesResult = { ok: true; notes: BusinessNote[]; sample: boolean } | { ok: false; message: string };

/** Every saved note, newest first. The demo gets sample notes (read only). */
export async function getNotes(): Promise<NotesResult> {
  const user = await currentUser();
  if (!user) {
    return getKey(STORAGE_KEYS.demo) === "1" ? { ok: true, notes: SAMPLE_NOTES, sample: true } : { ok: false, message: "Please log in." };
  }
  const { data, error } = await supabase()
    .from("business_notes")
    .select("id, note, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) return { ok: false, message: "We couldn't load what Second knows. Please refresh the page." };
  return { ok: true, sample: false, notes: data.map((n) => ({ id: n.id, note: n.note, createdAt: n.created_at, updatedAt: n.updated_at })) };
}

export async function updateNote(id: string, note: string): Promise<boolean> {
  const text = note.trim().slice(0, 200);
  if (!text) return false;
  const { error } = await supabase().from("business_notes").update({ note: text, updated_at: new Date().toISOString() }).eq("id", id);
  return !error;
}

export async function deleteNote(id: string): Promise<boolean> {
  const { error } = await supabase().from("business_notes").delete().eq("id", id);
  return !error;
}

export async function clearNotes(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  const { error } = await supabase().from("business_notes").delete().eq("user_id", user.id);
  return !error;
}

// ---------- This Week (weekly game plan) ----------

export type WeekResult = { ok: true; plan: WeekPlan; sample: boolean } | { ok: false; message: string };

async function weekRequest(body: object): Promise<WeekResponse> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: "error", message: "Please log in." };
  try {
    const res = await fetch("/api/week", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, timeZone: deviceTimeZone() }),
    });
    return (await res.json()) as WeekResponse;
  } catch {
    return { status: "error", message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

/** Ask for the plan; if another tab is making it right now, wait for that one (never a second plan). */
async function waitForPlan(first: WeekResponse): Promise<WeekResult> {
  let res = first;
  for (let i = 0; res.status === "pending" && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await weekRequest({ action: "get" });
  }
  if (res.status === "ready") return { ok: true, plan: res.plan, sample: false };
  if (res.status === "error") return { ok: false, message: res.message };
  return { ok: false, message: "Your plan is taking longer than usual. Please refresh the page." };
}

async function isDemo(): Promise<boolean> {
  return !(await currentUser()) && getKey(STORAGE_KEYS.demo) === "1";
}

/** This week's plan. Made the first time Home opens each week; read from the database after that. */
export async function getWeekPlan(): Promise<WeekResult> {
  if (await isDemo()) return { ok: true, plan: sampleWeek((await getMode()) ?? "running"), sample: true };
  return waitForPlan(await weekRequest({ action: "get" }));
}

/** "Redo this week's plan" (2 a week). */
export async function redoWeekPlan(): Promise<WeekResult> {
  if (await isDemo()) return { ok: true, plan: sampleWeek((await getMode()) ?? "running"), sample: true };
  return waitForPlan(await weekRequest({ action: "redo" }));
}

/** "Do it with Second": a draft for one action. The demo shows its sample draft (no AI). */
export async function makeActionDraft(actionId: string): Promise<{ ok: true; draft: string } | { ok: false; message: string }> {
  if (await isDemo()) {
    const sample = sampleWeek((await getMode()) ?? "running").actions.find((a) => a.id === actionId)?.draft;
    return sample ? { ok: true, draft: sample } : { ok: false, message: "This is a demo." };
  }
  const res = await weekRequest({ action: "draft", actionId });
  return res.status === "draft" ? { ok: true, draft: res.draft } : { ok: false, message: res.status === "error" ? res.message : "Please try again." };
}

/** Done / Skip (feeds next week's plan). The demo keeps it on the page only. */
export async function setActionStatus(actionId: string, status: ActionStatus): Promise<boolean> {
  if (await isDemo()) return true;
  const { error } = await supabase()
    .from("plan_actions")
    .update({ status, decided_at: status === "open" ? null : new Date().toISOString() })
    .eq("id", actionId);
  return !error;
}

/** Save the owner's edits to a draft. */
export async function saveActionDraft(actionId: string, draft: string): Promise<boolean> {
  if (await isDemo()) return true;
  const { error } = await supabase().from("plan_actions").update({ draft: draft.slice(0, 3000) }).eq("id", actionId);
  return !error;
}

// ---------- Content page ----------

export type ContentWeekResult = { ok: true; week: ContentWeek; sample: boolean } | { ok: false; message: string };

async function contentRequest(body: object): Promise<ContentResponse> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: "error", message: "Please log in." };
  try {
    const res = await fetch("/api/content", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...body, timeZone: deviceTimeZone() }),
    });
    return (await res.json()) as ContentResponse;
  } catch {
    return { status: "error", message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

async function waitForIdeas(first: ContentResponse): Promise<ContentWeekResult> {
  let res = first;
  for (let i = 0; res.status === "pending" && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await contentRequest({ action: "get" });
  }
  if (res.status === "ready") return { ok: true, week: res.week, sample: false };
  if (res.status === "error") return { ok: false, message: res.message };
  return { ok: false, message: "Your ideas are taking longer than usual. Please refresh the page." };
}

/** This week's post ideas. Made the first time Content opens each week; read after that. */
export async function getContentWeek(): Promise<ContentWeekResult> {
  if (await isDemo()) return { ok: true, week: sampleContentWeek((await getMode()) ?? "running"), sample: true };
  return waitForIdeas(await contentRequest({ action: "get" }));
}

/** "New ideas" (2 a week). Drafted, ready and posted ideas are kept. */
export async function newContentIdeas(): Promise<ContentWeekResult> {
  if (await isDemo()) return { ok: true, week: sampleContentWeek((await getMode()) ?? "running"), sample: true };
  return waitForIdeas(await contentRequest({ action: "new" }));
}

/** "Write caption": the caption and hashtags that follow the hook. */
export async function writeContentCaption(postId: string): Promise<{ ok: true; caption: string } | { ok: false; message: string }> {
  if (await isDemo()) {
    const sample = sampleContentWeek((await getMode()) ?? "running").ideas.find((p) => p.id === postId);
    return sample?.caption ? { ok: true, caption: sample.caption } : { ok: false, message: "In the demo, captions are samples. Make an account to write your own." };
  }
  const res = await contentRequest({ action: "caption", postId });
  return res.status === "caption" ? { ok: true, caption: res.caption } : { ok: false, message: res.status === "error" ? res.message : "Please try again." };
}

/** Save an edited hook. The server checks it (health, prices, offers, client names) first. */
export async function saveContentHook(postId: string, hook: string): Promise<{ ok: true; hook: string } | { ok: false; message: string }> {
  if (await isDemo()) return { ok: true, hook: hook.trim() };
  const res = await contentRequest({ action: "hook", postId, hook });
  return res.status === "hook" ? { ok: true, hook: res.hook } : { ok: false, message: res.status === "error" ? res.message : "Please try again." };
}

export type ContentPostChanges = Partial<{ day: string; status: PostStatus; caption: string | null; postedAt: string | null }>;

/** Save changes to an idea (day, status, caption). The demo keeps them on the page only. */
export async function updateContentPost(id: string, changes: ContentPostChanges): Promise<boolean> {
  if (await isDemo()) return true;
  const row: Record<string, unknown> = {};
  if (changes.day !== undefined) row.day = changes.day;
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.caption !== undefined) row.caption = changes.caption?.slice(0, 3000) ?? null;
  if (changes.postedAt !== undefined) row.posted_at = changes.postedAt;
  const { error } = await supabase().from("content_posts").update(row).eq("id", id);
  return !error;
}

/** Posts on the content calendar between two dates (YYYY-MM-DD, inclusive). */
export async function getContentPosts(from: string, to: string): Promise<ContentPost[]> {
  if (await isDemo()) return sampleContentWeek((await getMode()) ?? "running").ideas.filter((p) => p.day >= from && p.day <= to);
  const user = await currentUser();
  if (!user) return [];
  const { data, error } = await supabase().from("content_posts").select("*").eq("user_id", user.id).gte("day", from).lte("day", to).order("day");
  if (error) return [];
  return (data ?? []).map((r) => ({
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
  }));
}

/** Caption tone: warm (default), fun or professional. */
export async function saveContentTone(tone: ContentTone): Promise<void> {
  const business = await getBusiness();
  if (business) await saveBusiness({ ...business, contentTone: tone });
  await remote?.backend.settle(); // saved before the next caption is written
}

// ---------- Outreach ----------
// Second never sends anything: the owner copies the draft and sends it from their own email.
// The demo shows made-up businesses (example.com emails) and never calls the server.

export type LeadResult = { ok: true; lead: Lead; found: boolean; message?: string; usage: OutreachUsage } | { ok: false; message: string };
export type LeadsResult = { ok: true; leads: Lead[]; reused: boolean; town: string; usage: OutreachUsage } | { ok: false; message: string };
export type OutreachDraftResult = { ok: true; subject: string; body: string; lead: Lead; usage: OutreachUsage } | { ok: false; message: string };

const DEMO_USAGE: OutreachUsage = { searchesLeft: OUTREACH_LIMITS.searchesPerDay, lookupsLeft: OUTREACH_LIMITS.lookupsPerDay, draftsLeft: OUTREACH_LIMITS.draftsPerDay };
let demoLeads: Lead[] | null = null;
const demoList = () => (demoLeads ??= sampleLeads());
const demoUpdate = (id: string, changes: Partial<Lead>) => {
  demoLeads = demoList().map((l) => (l.id === id ? { ...l, ...changes } : l));
  return demoLeads.find((l) => l.id === id);
};

async function outreachRequest(body: object): Promise<OutreachResponse> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: "error", message: "Please log in." };
  try {
    const res = await fetch("/api/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    return (await res.json()) as OutreachResponse;
  } catch {
    return { status: "error", message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}
const errorOf = (res: OutreachResponse) => (res.status === "error" ? res.message : "Something went wrong. Please try again.");

type LeadRow = Record<string, unknown> & { id: string };
const rowToLead = (r: LeadRow): Lead => ({
  id: r.id,
  source: r.source as Lead["source"],
  town: (r.town as string | null) ?? null,
  category: r.category as string,
  name: r.name as string,
  address: (r.address as string | null) ?? null,
  website: (r.website as string | null) ?? null,
  phone: (r.phone as string | null) ?? null,
  email: (r.email as string | null) ?? null,
  emailSource: (r.email_source as string | null) ?? null,
  contactPage: (r.contact_page as string | null) ?? null,
  instagram: (r.instagram as string | null) ?? null,
  facebook: (r.facebook as string | null) ?? null,
  status: r.status as LeadStatus,
  note: (r.note as string | null) ?? null,
  draftSubject: (r.draft_subject as string | null) ?? null,
  draftBody: (r.draft_body as string | null) ?? null,
  emailCheckedAt: (r.email_checked_at as string | null) ?? null,
  saved: r.saved !== false,
  stage: (r.stage as PartnerStage | undefined) ?? "found",
  emailedAt: (r.emailed_at as string | null) ?? null,
  followUpOn: (r.follow_up_on as string | null) ?? null,
  repliedAt: (r.replied_at as string | null) ?? null,
  dealAt: (r.deal_at as string | null) ?? null,
  deal: r.deal_type
    ? { type: r.deal_type as DealTerms["type"], value: r.deal_value === null || r.deal_value === undefined ? null : Number(r.deal_value), variantId: (r.deal_variant_id as string | null) ?? null, note: (r.deal_note as string | null) ?? null }
    : null,
});

/** Every saved lead, newest changes first. */
export async function getLeads(): Promise<{ leads: Lead[]; sample: boolean }> {
  if (await isDemo()) return { leads: demoList(), sample: true };
  const user = await currentUser();
  if (!user) return { leads: [], sample: false };
  // Only the owner's list: businesses found in chat show up after they tap Save to Outreach.
  const { data } = await supabase().from("outreach_leads").select("*").eq("user_id", user.id).eq("saved", true).order("updated_at", { ascending: false }).limit(500);
  const leads = ((data ?? []) as LeadRow[]).map(rowToLead);
  // Second's idea from chat, newest card per business.
  if (leads.length) {
    const { data: cards } = await supabase()
      .from("chat_business_cards")
      .select("lead_id, why, deal_idea")
      .in("lead_id", leads.map((l) => l.id))
      .order("created_at", { ascending: false });
    for (const l of leads) {
      const c = (cards ?? []).find((x) => x.lead_id === l.id);
      if (c) l.idea = { why: c.why as string, dealIdea: c.deal_idea as string };
    }
    // Or from Home's weekly matches / onboarding's picks.
    const noIdea = leads.filter((l) => !l.idea);
    if (noIdea.length) {
      const { data: matches } = await supabase()
        .from("partner_matches")
        .select("lead_id, why, deal_idea")
        .in("lead_id", noIdea.map((l) => l.id))
        .order("created_at", { ascending: false });
      for (const l of noIdea) {
        const m = (matches ?? []).find((x) => x.lead_id === l.id);
        if (m) l.idea = { why: m.why as string, dealIdea: m.deal_idea as string };
      }
    }
  }
  return { leads, sample: false };
}

/** Lookups, drafts and map searches left today. */
export async function getOutreachUsage(): Promise<OutreachUsage> {
  if (await isDemo()) return DEMO_USAGE;
  const res = await outreachRequest({ action: "usage" });
  return res.status === "usage" ? res.usage : DEMO_USAGE;
}

/** Find businesses of one kind in a town (OpenStreetMap). Saved results are reused for 30 days. */
export async function searchLeads(input: { town: string; state: string; category: string; hideChains: boolean; radiusMi: number; fresh?: boolean }): Promise<LeadsResult> {
  if (await isDemo()) {
    return { ok: true, leads: demoList().filter((l) => l.category === input.category), reused: false, town: [input.town, input.state].filter(Boolean).join(", "), usage: DEMO_USAGE };
  }
  const res = await outreachRequest({ action: "search", ...input });
  return res.status === "leads" ? { ok: true, leads: res.leads, reused: res.reused, town: res.town, usage: res.usage } : { ok: false, message: errorOf(res) };
}

/** Look for the business's public email (map, then their website, then a web search). */
export async function findLeadEmail(leadId: string): Promise<LeadResult> {
  if (await isDemo()) {
    const lead = demoList().find((l) => l.id === leadId);
    if (!lead) return { ok: false, message: "This is a demo." };
    const email = lead.email ?? `${lead.name.toLowerCase().replace(/[^a-z]+/g, "")}@example.com`;
    const updated = demoUpdate(leadId, { email, emailSource: lead.emailSource ?? "https://www.example.com/contact", status: lead.status === "new" ? "email_found" : lead.status })!;
    return { ok: true, lead: updated, found: true, usage: DEMO_USAGE };
  }
  const res = await outreachRequest({ action: "find_email", leadId });
  return res.status === "lead" ? { ok: true, lead: res.lead, found: res.found, message: res.message, usage: res.usage } : { ok: false, message: errorOf(res) };
}

/** Second writes the email. The owner reads it, edits it, and sends it themselves. */
export async function draftOutreachEmail(leadId: string, goal: string, followUp = false): Promise<OutreachDraftResult> {
  if (await isDemo()) {
    const lead = demoList().find((l) => l.id === leadId);
    if (!lead) return { ok: false, message: "This is a demo." };
    const d = sampleOutreachDraft(lead.name);
    const updated = demoUpdate(leadId, { draftSubject: d.subject, draftBody: d.body, status: lead.status === "new" || lead.status === "email_found" ? "drafted" : lead.status })!;
    return { ok: true, ...d, lead: updated, usage: DEMO_USAGE };
  }
  const res = await outreachRequest({ action: "draft", leadId, goal: goal.slice(0, OUTREACH_LIMITS.goalMaxChars), followUp });
  return res.status === "draft" ? { ok: true, subject: res.subject, body: res.body, lead: res.lead, usage: res.usage } : { ok: false, message: errorOf(res) };
}

/** Add a business by hand (one the map doesn't have). */
export async function addManualLead(input: { name: string; website: string; email: string; category: string; town: string }): Promise<LeadResult> {
  if (await isDemo()) {
    const lead: Lead = {
      id: newId(), source: "manual", town: input.town || null, category: input.category, name: input.name.trim(), address: null,
      website: input.website.trim() || null, phone: null, email: input.email.trim() || null, emailSource: input.email.trim() ? "added by you" : null,
      contactPage: null, instagram: null, facebook: null, status: input.email.trim() ? "email_found" : "new", note: null, draftSubject: null, draftBody: null, emailCheckedAt: null,
    };
    if (!lead.name) return { ok: false, message: "Please type the business name." };
    demoLeads = [lead, ...demoList()];
    return { ok: true, lead, found: Boolean(lead.email), usage: DEMO_USAGE };
  }
  const res = await outreachRequest({ action: "add_manual", ...input });
  return res.status === "lead" ? { ok: true, lead: res.lead, found: res.found, usage: res.usage } : { ok: false, message: errorOf(res) };
}

/** "Remove" on the Outreach page: takes it off the list. The business stays in the 30-day cache
 *  (chat can still suggest it, and Save to Outreach puts it back with its email, notes and draft). */
export async function removeFromOutreach(leadId: string): Promise<boolean> {
  forgetReplyCount();
  if (await isDemo()) {
    demoLeads = demoList().filter((l) => l.id !== leadId);
    return true;
  }
  const { error } = await supabase().from("outreach_leads").update({ saved: false, updated_at: new Date().toISOString() }).eq("id", leadId);
  return !error;
}

/** "Save to Outreach" on a chat card: puts that business (and any email found) in the Outreach list. */
// ---------- Partners pipeline (found -> emailed -> replied -> deal) ----------
// The owner moves a business along by hand. Second never sends anything.

const FOLLOW_UP_DAYS = 5;

/** Move a business to a stage. Keeps the old status in step so older screens still agree. */
export async function setPartnerStage(leadId: string, stage: PartnerStage): Promise<boolean> {
  forgetReplyCount();
  const now = new Date();
  const changes: Partial<Lead> = { stage, saved: true };
  const row: Record<string, unknown> = { stage, saved: true, updated_at: now.toISOString() };
  if (stage === "emailed") {
    const follow = new Date(now.getTime() + FOLLOW_UP_DAYS * 86_400_000);
    const followUpOn = `${follow.getFullYear()}-${String(follow.getMonth() + 1).padStart(2, "0")}-${String(follow.getDate()).padStart(2, "0")}`;
    Object.assign(changes, { status: "contacted", emailedAt: now.toISOString(), followUpOn });
    Object.assign(row, { status: "contacted", emailed_at: now.toISOString(), follow_up_on: followUpOn });
  } else if (stage === "replied") {
    Object.assign(changes, { status: "replied", repliedAt: now.toISOString() });
    Object.assign(row, { status: "replied", replied_at: now.toISOString() });
  } else if (stage === "deal") {
    Object.assign(changes, { status: "replied", dealAt: now.toISOString() });
    Object.assign(row, { status: "replied", deal_at: now.toISOString() });
  } else {
    Object.assign(changes, { status: "new" });
    Object.assign(row, { status: "new" });
  }
  if (await isDemo()) {
    demoUpdate(leadId, changes);
    return true;
  }
  const { error } = await supabase().from("outreach_leads").update(row).eq("id", leadId);
  return !error;
}

/** "Not interested": out of the pipeline, still listed under "Not interested (N)". */
export async function setNotInterested(leadId: string, notInterested: boolean): Promise<boolean> {
  forgetReplyCount();
  const status: LeadStatus = notInterested ? "not_interested" : "new";
  return updateLead(leadId, { status });
}

/** Save a deal and move the business to the Deal stage. Checked here and again by the database. */
export async function saveDeal(leadId: string, deal: DealTerms): Promise<{ ok: true } | { ok: false; message: string }> {
  forgetReplyCount();
  const value = deal.value === null ? null : Math.round(deal.value * 100) / 100;
  if (deal.type === "percent" && (value === null || value < 0 || value > 100)) return { ok: false, message: "A percent off goes from 0 to 100." };
  if (deal.type === "amount_off" && (value === null || value < 0 || value > 10_000)) return { ok: false, message: "Dollars off goes from $0 to $10,000." };
  if (deal.type === "custom" && !deal.note?.trim()) return { ok: false, message: "Write the deal in a few words." };
  const note = deal.note?.trim().slice(0, 200) || null;
  const clean: DealTerms = { type: deal.type, value: deal.type === "custom" ? null : value, variantId: deal.type === "custom" ? null : deal.variantId, note };
  if (await isDemo()) {
    demoUpdate(leadId, { deal: clean, stage: "deal", saved: true, dealAt: new Date().toISOString() });
    return { ok: true };
  }
  const { error } = await supabase()
    .from("outreach_leads")
    .update({ deal_type: clean.type, deal_value: clean.value, deal_variant_id: clean.variantId, deal_note: clean.note, stage: "deal", status: "replied", saved: true, deal_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", leadId);
  return error ? { ok: false, message: "We couldn't save that deal. Please try again." } : { ok: true };
}

/** How many partners replied and are waiting on the owner (the blue badge). */
// Remembered for a minute (and forgotten when a stage changes), so the data refresh after every
// save stays instant: it's the only part of loadAll that would otherwise ask the database.
let replyCount: { userId: string; n: number; at: number } | null = null;
const forgetReplyCount = () => {
  replyCount = null;
};
/** After a partner moves stage: refresh the blue badge. */
export function partnersChanged() {
  forgetReplyCount();
  notify();
}

export async function getPartnerReplyCount(): Promise<number> {
  if (await isDemo()) return demoList().filter((l) => l.saved !== false && l.stage === "replied" && l.status !== "not_interested").length;
  const user = await currentUser();
  if (!user) return 0;
  if (replyCount && replyCount.userId === user.id && Date.now() - replyCount.at < 60_000) return replyCount.n;
  const { count, error } = await supabase().from("outreach_leads").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("saved", true).eq("stage", "replied").neq("status", "not_interested");
  const n = error ? 0 : (count ?? 0);
  replyCount = { userId: user.id, n, at: Date.now() };
  return n;
}

// ---------- "Your matches this week" ----------

export type MatchesResult = { ok: true; matches: Match[]; center: { lat: number; lon: number } | null; stale: boolean } | { ok: false };

/**
 * This week's matches. Made once a week on the server (the first time Home or onboarding asks);
 * if another tab is making them right now, wait for that one. Never throws: { ok: false } means
 * "show the Find partners button".
 */
export async function getWeeklyMatches(source: "weekly" | "onboarding" = "weekly", maxWaitMs = 60_000): Promise<MatchesResult> {
  if (await isDemo()) return { ok: true, matches: sampleMatches(), center: null, stale: false };
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false };
  const ask = async (): Promise<MatchesResponse> => {
    try {
      const res = await fetch("/api/matches", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "get", timeZone: deviceTimeZone(), source }) });
      return (await res.json()) as MatchesResponse;
    } catch {
      return { status: "error", message: "" };
    }
  };
  const until = Date.now() + maxWaitMs;
  let res = await ask();
  while (res.status === "pending" && Date.now() < until) {
    await new Promise((r) => setTimeout(r, 2500));
    res = await ask();
  }
  return res.status === "ready" ? { ok: true, matches: res.matches, center: res.center, stale: res.stale } : { ok: false };
}

export async function saveLeadToOutreach(leadId: string): Promise<{ ok: true; already: boolean } | { ok: false; message: string }> {
  if (await isDemo()) {
    if (demoList().some((l) => l.id === leadId)) return { ok: true, already: true };
    const m = sampleMatches().find((x) => x.lead.id === leadId);
    if (m) demoLeads = [{ ...m.lead, saved: true, idea: { why: m.why, dealIdea: m.dealIdea } }, ...demoList()];
    return { ok: true, already: false };
  }
  const { data, error } = await supabase().from("outreach_leads").select("saved").eq("id", leadId).maybeSingle();
  if (error || !data) return { ok: false, message: "We couldn't find that business anymore. It may have been removed." };
  if (data.saved) return { ok: true, already: true };
  const { error: saveError } = await supabase().from("outreach_leads").update({ saved: true, updated_at: new Date().toISOString() }).eq("id", leadId);
  return saveError ? { ok: false, message: "We couldn't save that. Please try again." } : { ok: true, already: false };
}

export type LeadChanges = Partial<{ status: LeadStatus; note: string | null; draftSubject: string | null; draftBody: string | null }>;

/** Save the owner's changes to a lead: status, note, or their edits to the draft. */
export async function updateLead(id: string, changes: LeadChanges): Promise<boolean> {
  if (await isDemo()) {
    demoUpdate(id, changes);
    return true;
  }
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.note !== undefined) row.note = changes.note?.trim().slice(0, OUTREACH_LIMITS.noteMaxChars) || null;
  if (changes.draftSubject !== undefined) row.draft_subject = changes.draftSubject?.slice(0, 200) ?? null;
  if (changes.draftBody !== undefined) row.draft_body = changes.draftBody?.slice(0, 3000) ?? null;
  const { error } = await supabase().from("outreach_leads").update(row).eq("id", id);
  return !error;
}

// ---------- Beta sign-ups (public /beta page, no account) ----------

export type BetaResult = { ok: true } | { ok: false; message: string; problems?: BetaProblems };

/**
 * Add someone to the beta list. Goes through the server (/api/beta), which can only
 * ADD rows; nobody can read the list from the browser. Works the same in the demo.
 * `website` is the hidden honeypot field (bots fill it in).
 */
export async function joinBeta(signup: BetaSignup, website = ""): Promise<BetaResult> {
  try {
    const res = await fetch("/api/beta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...signup, website }),
    });
    const result = (await res.json()) as BetaResult;
    if (result.ok) return result;
    return { ok: false, message: result.message ?? "Something went wrong. Please try again.", problems: result.problems };
  } catch {
    return { ok: false, message: "We couldn't reach Second. Check your internet connection and try again." };
  }
}

// ---------- Roadmap tasks ----------

/** IDs of roadmap tasks the user has checked off (see src/lib/roadmap.ts). */
export async function getTasks(): Promise<string[]> {
  return (await (await backend())?.getTasks()) ?? [];
}

export async function completeTask(taskId: string): Promise<void> {
  await change((b) => b.completeTask(taskId));
}

export async function uncompleteTask(taskId: string): Promise<void> {
  await change((b) => b.uncompleteTask(taskId));
}

// ---------- Money plan ----------

export async function getMoneyPlan(): Promise<MoneyPlan | null> {
  return (await (await backend())?.getMoneyPlan()) ?? null;
}

export async function saveMoneyPlan(plan: MoneyPlan): Promise<void> {
  await change((b) => b.saveMoneyPlan(plan));
}

// ---------- Money tracking ----------

export async function getTransactions(): Promise<Transaction[]> {
  return (await (await backend())?.getTransactions()) ?? [];
}

export async function addTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
  // From the parts (price x quantity - discount + tip). The database works out the same total
  // itself and never trusts this one; this is just so the screen is right straight away.
  if (transaction.partnerLeadId && transaction.unitPrice !== undefined) {
    // From a partner: the deal sets the discount (the database does this itself and wins).
    const partner = (await isDemo()) ? demoList().find((l) => l.id === transaction.partnerLeadId) : null;
    if (partner) transaction = { ...transaction, discount: dealDiscount(partner.deal, { unitPrice: transaction.unitPrice, quantity: transaction.quantity ?? 1, variantId: transaction.variantId ?? "" }) };
  }
  const amount = transaction.unitPrice !== undefined ? entryTotal({ unitPrice: transaction.unitPrice, quantity: transaction.quantity, discount: transaction.discount, tip: transaction.tip }) : transaction.amount;
  const saved = { ...transaction, amount, id: newId() };
  await change((b) => b.addTransaction(saved));
  return saved;
}

export async function deleteTransaction(id: string): Promise<void> {
  await change((b) => b.deleteTransaction(id));
}

// ---------- Calendar ----------

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function getEvents(): Promise<CalendarEvent[]> {
  return (await (await backend())?.getEvents()) ?? [];
}

/** Add an event. See NewEvent for what's required. Returns the saved event. */
export async function addEvent(input: NewEvent): Promise<CalendarEvent> {
  const allDay = input.allDay ?? false;
  const end = input.end ?? (allDay ? input.start : new Date(new Date(input.start).getTime() + 60 * 60 * 1000).toISOString());
  const event: CalendarEvent = {
    ...input,
    id: newId(),
    allDay,
    end,
    timeZone: input.timeZone ?? deviceTimeZone(),
    repeatsWeekly: input.repeatsWeekly ?? false,
    source: input.source ?? "manual",
  };
  await change((b) => b.addEvent(event));
  return event;
}

/** Change some fields of an event. Returns the updated event, or null if it wasn't found. */
export async function updateEvent(
  id: string,
  changes: Partial<Omit<CalendarEvent, "id">>,
): Promise<CalendarEvent | null> {
  const current = (await getEvents()).find((e) => e.id === id);
  if (!current) return null;
  const updated: CalendarEvent = { ...current, ...changes, id };
  await change((b) => b.updateEvent(updated));
  return updated;
}

export async function deleteEvent(id: string): Promise<void> {
  await change((b) => b.deleteEvent(id));
}

// ---------- Launch day ----------

/** Move from Launch mode to Running mode. Profile, prices, and money plan carry over as-is. */
export async function graduate(): Promise<void> {
  const business = await getBusiness();
  if (business && !business.launchedAt) {
    await saveBusiness({ ...business, launchedAt: new Date().toISOString() });
  }
  await saveMode("running");
}

// ---------- "Take a tour" ----------

/** Has the first-visit "Take a tour" card been shown on this device? (A screen setting, like the theme.) */
export function wasTourOffered(): boolean {
  return getKey(STORAGE_KEYS.tourOffered) === "1";
}

/** Don't show the first-visit card again (they started the tour or said "Maybe later"). */
export function markTourOffered(): void {
  setKey(STORAGE_KEYS.tourOffered, "1");
}

// ---------- Reset ----------

/** Delete this person's business data (demo: in this browser; account: in the database). The login stays. */
export async function resetAll(): Promise<void> {
  setKey(STORAGE_KEYS.modeHint, null);
  await change((b) => b.resetAll());
}
