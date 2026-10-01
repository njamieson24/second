// The ONLY place that saves or loads app data. Pages and components must use
// these functions (through src/lib/data.tsx), never localStorage directly.
//
// Phase 2 keeps everything in the browser. Every function returns a Promise so
// this file can later be swapped for a real database without changing pages.

import type { BusinessType } from "./business-types";

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

// ---------- Storage keys ----------

export const STORAGE_KEYS = {
  business: "second:v1:business",
  mode: "second:v1:mode",
  completedTasks: "second:v1:completed-tasks",
  moneyPlan: "second:v1:money-plan",
  transactions: "second:v1:transactions",
} as const;

// ---------- Change notifications ----------

const listeners = new Set<() => void>();

/** Call `listener` whenever saved data changes (in this tab or another one). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("second:")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

// ---------- Low-level helpers (private) ----------

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or blocked. Nothing else we can do in Phase 2.
  }
  notify();
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Business profile ----------

export async function getBusiness(): Promise<Business | null> {
  return read<Business>(STORAGE_KEYS.business);
}

export async function saveBusiness(business: Business): Promise<void> {
  write(STORAGE_KEYS.business, business);
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
  const mode = read<Mode>(STORAGE_KEYS.mode);
  return mode === "launch" || mode === "running" ? mode : null;
}

export async function saveMode(mode: Mode): Promise<void> {
  write(STORAGE_KEYS.mode, mode);
}

// ---------- Roadmap tasks ----------

/** IDs of roadmap tasks the user has checked off (see src/lib/roadmap.ts). */
export async function getTasks(): Promise<string[]> {
  return read<string[]>(STORAGE_KEYS.completedTasks) ?? [];
}

export async function completeTask(taskId: string): Promise<void> {
  const done = await getTasks();
  if (!done.includes(taskId)) write(STORAGE_KEYS.completedTasks, [...done, taskId]);
}

export async function uncompleteTask(taskId: string): Promise<void> {
  const done = await getTasks();
  write(
    STORAGE_KEYS.completedTasks,
    done.filter((id) => id !== taskId),
  );
}

// ---------- Money plan ----------

export async function getMoneyPlan(): Promise<MoneyPlan | null> {
  return read<MoneyPlan>(STORAGE_KEYS.moneyPlan);
}

export async function saveMoneyPlan(plan: MoneyPlan): Promise<void> {
  write(STORAGE_KEYS.moneyPlan, plan);
}

// ---------- Money tracking ----------

export async function getTransactions(): Promise<Transaction[]> {
  return read<Transaction[]>(STORAGE_KEYS.transactions) ?? [];
}

export async function addTransaction(transaction: Omit<Transaction, "id">): Promise<Transaction> {
  const saved = { ...transaction, id: newId() };
  const all = await getTransactions();
  write(STORAGE_KEYS.transactions, [...all, saved]);
  return saved;
}

export async function deleteTransaction(id: string): Promise<void> {
  const all = await getTransactions();
  write(
    STORAGE_KEYS.transactions,
    all.filter((t) => t.id !== id),
  );
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

/** Delete everything Second saved in this browser. */
export async function resetAll(): Promise<void> {
  Object.values(STORAGE_KEYS).forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
  notify();
}
