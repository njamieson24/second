// "Try the demo" storage: everything lives in this browser's localStorage.
// It never talks to the database. Only store.ts uses this file.

import type { DemoAccount } from "./demo-content";
import { entryTotal, type CatalogItem } from "./catalog";
import type { Backend, Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";

const KEYS = {
  business: "second:v1:business",
  mode: "second:v1:mode",
  completedTasks: "second:v1:completed-tasks",
  moneyPlan: "second:v1:money-plan",
  transactions: "second:v1:transactions",
  showSamples: "second:v1:show-samples",
  events: "second:v1:events",
  catalog: "second:v1:catalog",
} as const;

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
    // Storage can be full or blocked. Nothing else we can do in the demo.
  }
}

export const localBackend: Backend & { fill: (demo: DemoAccount) => Promise<void> } = {
  async getBusiness() {
    return read<Business>(KEYS.business);
  },
  async saveBusiness(business) {
    write(KEYS.business, business);
  },

  async getMode() {
    const mode = read<Mode>(KEYS.mode);
    return mode === "launch" || mode === "running" ? mode : null;
  },
  async saveMode(mode) {
    write(KEYS.mode, mode);
  },

  async getShowSamples() {
    return read<boolean>(KEYS.showSamples) === true;
  },

  async getTasks() {
    return read<string[]>(KEYS.completedTasks) ?? [];
  },
  async completeTask(taskId) {
    const done = read<string[]>(KEYS.completedTasks) ?? [];
    if (!done.includes(taskId)) write(KEYS.completedTasks, [...done, taskId]);
  },
  async uncompleteTask(taskId) {
    const done = read<string[]>(KEYS.completedTasks) ?? [];
    write(
      KEYS.completedTasks,
      done.filter((id) => id !== taskId),
    );
  },

  async getMoneyPlan() {
    return read<MoneyPlan>(KEYS.moneyPlan);
  },
  async saveMoneyPlan(plan) {
    write(KEYS.moneyPlan, plan);
  },

  async getTransactions() {
    return read<Transaction[]>(KEYS.transactions) ?? [];
  },
  async addTransaction(transaction) {
    const all = read<Transaction[]>(KEYS.transactions) ?? [];
    // Same rules as the database: the total comes from the parts, and an appointment is logged once.
    if (transaction.eventId && all.some((t) => t.eventId === transaction.eventId && (t.eventDate ?? t.date) === (transaction.eventDate ?? transaction.date)))
      throw new Error("That appointment is already logged.");
    const amount = transaction.unitPrice !== undefined ? entryTotal({ unitPrice: transaction.unitPrice, quantity: transaction.quantity, discount: transaction.discount, tip: transaction.tip }) : transaction.amount;
    write(KEYS.transactions, [...all, { ...transaction, amount }]);
  },

  async getCatalog() {
    return read<CatalogItem[]>(KEYS.catalog) ?? [];
  },
  async saveCatalogItem(item) {
    const all = read<CatalogItem[]>(KEYS.catalog) ?? [];
    write(KEYS.catalog, all.some((i) => i.id === item.id) ? all.map((i) => (i.id === item.id ? item : i)) : [...all, item]);
  },
  async deleteTransaction(id) {
    write(
      KEYS.transactions,
      (read<Transaction[]>(KEYS.transactions) ?? []).filter((t) => t.id !== id),
    );
  },

  async getEvents() {
    return read<CalendarEvent[]>(KEYS.events) ?? [];
  },
  async addEvent(event) {
    write(KEYS.events, [...(read<CalendarEvent[]>(KEYS.events) ?? []), event]);
  },
  async updateEvent(event) {
    write(
      KEYS.events,
      (read<CalendarEvent[]>(KEYS.events) ?? []).map((e) => (e.id === event.id ? event : e)),
    );
  },
  async deleteEvent(id) {
    write(
      KEYS.events,
      (read<CalendarEvent[]>(KEYS.events) ?? []).filter((e) => e.id !== id),
    );
  },

  async resetAll() {
    Object.values(KEYS).forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    });
  },

  /** Replace everything with a sample business (used by "Try the demo"). */
  async fill(demo) {
    await this.resetAll();
    write(KEYS.business, demo.business);
    write(KEYS.mode, demo.mode);
    write(KEYS.completedTasks, demo.completedTasks);
    write(KEYS.moneyPlan, demo.moneyPlan);
    write(KEYS.transactions, demo.transactions);
    write(KEYS.events, demo.events);
    write(KEYS.catalog, demo.catalog);
    write(KEYS.showSamples, true);
  },
};
