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
  BusinessNote,
  ChatProposal,
  ChatRole,
  ChatStreamEvent,
  ProposalChange,
  ProposalStatus,
  SavedChatMessage,
} from "./chat";
import { SAMPLE_NOTES, sampleContentWeek, sampleWeek } from "./demo-content";
import type { ContentPost, ContentResponse, ContentWeek, PostStatus, TemplateSize, TemplateText } from "./content";
import type { ActionStatus, WeekPlan, WeekResponse } from "./week";
import { buildDemoAccount } from "./demo-content";
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
  /** The owner's own brand colors for their posts (#RRGGBB). Unset = the defaults in brand.ts */
  brandPrimary?: string;
  brandAccent?: string;
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
  return (await backend())?.getBusiness() ?? null;
}

export async function saveBusiness(business: Business): Promise<void> {
  await change((b) => b.saveBusiness(business));
}

/** Change the main service's price (shared by the profile and the money plan). */
export async function saveMainPrice(price: number): Promise<void> {
  const business = await getBusiness();
  if (!business || business.services.length === 0) return;
  const [main, ...rest] = business.services;
  await saveBusiness({ ...business, services: [{ ...main, price }, ...rest] });
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
  return {
    ok: true,
    messages: data
      .map((r) => ({
        id: r.id as string,
        role: r.role as ChatRole,
        content: r.content as string,
        createdAt: r.created_at as string,
        proposals: cardsFor(r.id as string),
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
export async function sendChatMessage(
  message: string,
  onText: (piece: string) => void,
  onProposals?: (messageId: string, proposals: ChatProposal[]) => void,
): Promise<ChatSendResult> {
  const { data } = await supabase().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please log in to chat with Second." };
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message, timeZone: deviceTimeZone() }),
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
        else if (event.type === "done") result = { ok: true, remaining: event.remaining };
        else result = { ok: false, message: event.message, limit: event.limit };
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
async function applyChange(change: ProposalChange): Promise<boolean> {
  const business = await getBusiness();
  if (!business) return false;
  const services = business.services;
  switch (change.kind) {
    case "set_price": {
      if (!services.some((s) => same(s.name, change.service))) return false;
      await saveBusiness({ ...business, services: services.map((s) => (same(s.name, change.service) ? { ...s, price: change.newPrice } : s)) });
      return true;
    }
    case "add_service": {
      if (services.some((s) => same(s.name, change.name))) return false;
      const added: Service = { id: newId(), name: change.name, price: change.price, ...(change.minutes ? { minutes: change.minutes } : {}) };
      await saveBusiness({ ...business, services: [...services, added] });
      return true;
    }
    case "remove_service": {
      if (services.length < 2 || !services.some((s) => same(s.name, change.service))) return false;
      await saveBusiness({ ...business, services: services.filter((s) => !same(s.name, change.service)) });
      return true;
    }
    case "set_pay_goal":
      await savePayGoal(change.newGoal);
      return true;
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

export type CardResult = { ok: true; status: ProposalStatus } | { ok: false; message: string };

/** Approve a card: make the change under the owner's own login, then mark the card. */
export async function approveProposal(card: ChatProposal): Promise<CardResult> {
  if (!(await currentUser())) return { ok: false, message: "Please log in again." };
  try {
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

/** "Write it": a caption plus the template's headline and line. `ownerWords` = what the owner typed (offer, quote). */
export async function writeContentCaption(
  postId: string,
  ownerWords: string,
): Promise<{ ok: true; caption: string; templateText: TemplateText } | { ok: false; message: string }> {
  if (await isDemo()) {
    const sample = sampleContentWeek((await getMode()) ?? "running").ideas.find((p) => p.id === postId);
    return sample?.caption ? { ok: true, caption: sample.caption, templateText: sample.templateText ?? {} } : { ok: false, message: "This is a demo." };
  }
  const res = await contentRequest({ action: "caption", postId, ownerWords });
  return res.status === "caption" ? { ok: true, caption: res.caption, templateText: res.templateText } : { ok: false, message: res.status === "error" ? res.message : "Please try again." };
}

export type ContentPostChanges = Partial<{
  day: string;
  status: PostStatus;
  caption: string | null;
  template: string | null;
  templateSize: TemplateSize | null;
  templateText: TemplateText | null;
  postedAt: string | null;
}>;

/** Save changes to an idea or post (day, status, caption, template). The demo keeps them on the page only. */
export async function updateContentPost(id: string, changes: ContentPostChanges): Promise<boolean> {
  if (await isDemo()) return true;
  const row: Record<string, unknown> = {};
  if (changes.day !== undefined) row.day = changes.day;
  if (changes.status !== undefined) row.status = changes.status;
  if (changes.caption !== undefined) row.caption = changes.caption?.slice(0, 3000) ?? null;
  if (changes.template !== undefined) row.template = changes.template;
  if (changes.templateSize !== undefined) row.template_size = changes.templateSize;
  if (changes.templateText !== undefined) row.template_text = changes.templateText;
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
    caption: r.caption,
    template: r.template,
    templateSize: r.template_size,
    templateText: r.template_text,
    postedAt: r.posted_at,
  }));
}

/** Caption tone: warm (default), fun or professional. */
export async function saveContentTone(tone: ContentTone): Promise<void> {
  const business = await getBusiness();
  if (business) await saveBusiness({ ...business, contentTone: tone });
  await remote?.backend.settle(); // saved before the next caption is written
}

/** The owner's brand colors for post templates (#RRGGBB). */
export async function saveBrandColors(primary: string, accent: string): Promise<void> {
  const business = await getBusiness();
  if (business) await saveBusiness({ ...business, brandPrimary: primary, brandAccent: accent });
  await remote?.backend.settle();
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
  const saved = { ...transaction, id: newId() };
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

// ---------- Reset ----------

/** Delete this person's business data (demo: in this browser; account: in the database). The login stays. */
export async function resetAll(): Promise<void> {
  setKey(STORAGE_KEYS.modeHint, null);
  await change((b) => b.resetAll());
}
