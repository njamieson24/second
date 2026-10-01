// "Try the demo" storage: everything lives in this browser's localStorage.
// Only store.ts uses this file.

import type { Backend, Business, Mode, MoneyPlan, Transaction } from "./store";

const KEYS = {
  business: "second:v1:business",
  mode: "second:v1:mode",
  completedTasks: "second:v1:completed-tasks",
  moneyPlan: "second:v1:money-plan",
  transactions: "second:v1:transactions",
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

export const localBackend: Backend = {
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
    write(KEYS.transactions, [...(read<Transaction[]>(KEYS.transactions) ?? []), transaction]);
  },
  async deleteTransaction(id) {
    write(
      KEYS.transactions,
      (read<Transaction[]>(KEYS.transactions) ?? []).filter((t) => t.id !== id),
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
};
