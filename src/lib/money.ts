// Money math. Pure functions, no saving or loading.

import { monthKey, monthsEnding } from "./dates";
import type { CostLine, MoneyPlan, Transaction } from "./store";

export function formatMoney(amount: number): string {
  const whole = Number.isInteger(amount);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/**
 * Client names already in the calendar and past income, one per person (ignoring capital
 * letters), newest spelling first. Used to suggest names so the same client isn't counted twice.
 */
export function knownClientNames(transactions: Transaction[], events: { clientName?: string; start: string }[]): string[] {
  const seen = new Map<string, { name: string; when: string }>();
  const add = (raw: string | undefined, when: string) => {
    const name = raw?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    const prev = seen.get(key);
    if (!prev || when > prev.when) seen.set(key, { name, when });
  };
  transactions.forEach((t) => add(t.clientName, t.date));
  events.forEach((e) => add(e.clientName, e.start));
  return [...seen.values()].sort((a, b) => (a.when < b.when ? 1 : -1)).map((x) => x.name);
}

/** The saved spelling of a name if this client is already known (ignoring capital letters). */
export function matchClientName(typed: string, known: string[]): string {
  const name = typed.trim().replace(/\s+/g, " ");
  return known.find((k) => k.toLowerCase() === name.toLowerCase()) ?? name;
}

export function sumCosts(lines: CostLine[]): number {
  return lines.reduce((total, line) => total + (Number.isFinite(line.amount) ? line.amount : 0), 0);
}

export type SessionMath = {
  monthlyCosts: number;
  /** Visits a month to cover costs */
  toCover: number;
  /** Visits a month to cover costs AND pay yourself your goal */
  toGoal: number;
  /** "About 8 or 9 a week" */
  perWeek: string;
};

const WEEKS_PER_MONTH = 4.33;

export function sessionMath(plan: MoneyPlan, price: number, payGoal: number): SessionMath {
  const monthlyCosts = sumCosts(plan.monthlyCosts);
  if (price <= 0) return { monthlyCosts, toCover: 0, toGoal: 0, perWeek: "Add a price to see this" };
  const toCover = Math.ceil(monthlyCosts / price);
  const toGoal = Math.ceil((monthlyCosts + payGoal) / price);
  const weekly = toGoal / WEEKS_PER_MONTH;
  const low = Math.floor(weekly);
  const high = Math.ceil(weekly);
  const perWeek =
    toGoal === 0 ? "Set a pay goal to see this" : low === high || low === 0 ? `About ${high} a week` : `About ${low} or ${high} a week`;
  return { monthlyCosts, toCover, toGoal, perWeek };
}

export type MonthTotals = {
  earned: number;
  spent: number;
  kept: number;
  incomeCount: number;
  /** Spending by category, biggest first */
  categories: { label: string; amount: number; percent: number }[];
  transactions: Transaction[];
};

export function monthTotals(all: Transaction[], key: string): MonthTotals {
  const transactions = all
    .filter((t) => monthKey(t.date) === key)
    .sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const income = transactions.filter((t) => t.kind === "income");
  const expenses = transactions.filter((t) => t.kind === "expense");
  const earned = income.reduce((s, t) => s + t.amount, 0);
  const spent = expenses.reduce((s, t) => s + t.amount, 0);

  const byCategory = new Map<string, number>();
  expenses.forEach((t) => byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount));
  const categories = [...byCategory.entries()]
    .map(([label, amount]) => ({ label, amount, percent: spent > 0 ? Math.round((amount / spent) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return { earned, spent, kept: earned - spent, incomeCount: income.length, categories, transactions };
}

/** What you kept each month, for the `count` months ending with `key`. */
export function keptHistory(all: Transaction[], key: string, count = 6) {
  return monthsEnding(key, count).map((k) => ({ key: k, kept: monthTotals(all, k).kept }));
}

/** "Up $220 from August", "Down $40 from August", or "Same as August" */
export function changeFromLastMonth(thisKept: number, lastKept: number, lastMonthName: string): string {
  const diff = thisKept - lastKept;
  if (diff === 0) return `Same as ${lastMonthName}`;
  return `${diff > 0 ? "Up" : "Down"} ${formatMoney(Math.abs(diff))} from ${lastMonthName}`;
}
