// The ONLY place that saves or loads app data. Pages and components use these
// functions (through src/lib/data.tsx), never localStorage or Supabase directly.
//
// Where data lives depends on who's using the app:
//   - Signed in to an account: Supabase (store-supabase.ts), one set of rows per person.
//   - "Try the demo": this browser's localStorage (store-local.ts).
// The functions below look the same either way, so pages don't care which.

import type { BusinessType } from "./business-types";
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
};

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
};

/** Who is using the app right now. */
export type Account = { kind: "demo" } | { kind: "user"; email: string };

/** What every storage backend has to do. */
export type Backend = {
  getBusiness(): Promise<Business | null>;
  saveBusiness(business: Business): Promise<void>;
  getMode(): Promise<Mode | null>;
  saveMode(mode: Mode): Promise<void>;
  getTasks(): Promise<string[]>;
  completeTask(taskId: string): Promise<void>;
  uncompleteTask(taskId: string): Promise<void>;
  getMoneyPlan(): Promise<MoneyPlan | null>;
  saveMoneyPlan(plan: MoneyPlan): Promise<void>;
  getTransactions(): Promise<Transaction[]>;
  addTransaction(transaction: Transaction): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
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

/** Use the app without an account. Data stays in this browser. */
export async function startDemo(): Promise<void> {
  if (await currentUser()) await supabase().auth.signOut();
  remote = null;
  setKey(STORAGE_KEYS.demo, "1");
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
