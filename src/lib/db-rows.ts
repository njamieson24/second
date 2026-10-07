// How app data maps to database rows (see supabase/schema.sql).
// Shared by store-supabase.ts (browser) and the demo-data route (server).

import type { Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";

export type BusinessRow = {
  user_id: string;
  mode: Mode | null;
  owner_name: string | null;
  business_name: string;
  type: Business["type"] | null;
  type_label: string | null;
  area: string | null;
  services: Business["services"];
  pay_goal: number | string;
  goal_note: string | null;
  opening_day: string | null;
  launched_at: string | null;
  created_at: string;
  show_samples?: boolean | null;
};

export type MoneyPlanRow = {
  user_id: string;
  monthly_costs: MoneyPlan["monthlyCosts"];
  startup_costs: MoneyPlan["startupCosts"];
  saved: number | string;
};

export type TransactionRow = Omit<Transaction, "amount"> & { amount: number | string; user_id: string };

export function toBusiness(row: BusinessRow | null): Business | null {
  // A row can exist with only the mode set, before setup is finished.
  if (!row || row.owner_name === null || row.type === null) return null;
  return {
    ownerName: row.owner_name,
    businessName: row.business_name,
    type: row.type,
    typeLabel: row.type_label ?? "",
    area: row.area ?? "",
    services: row.services ?? [],
    payGoal: Number(row.pay_goal),
    goalNote: row.goal_note ?? undefined,
    openingDay: row.opening_day ?? undefined,
    createdAt: row.created_at,
    launchedAt: row.launched_at ?? undefined,
  };
}

/** Profile columns only. Leaves mode and show_samples alone. */
export function businessProfileRow(userId: string, b: Business) {
  return {
    user_id: userId,
    owner_name: b.ownerName,
    business_name: b.businessName,
    type: b.type,
    type_label: b.typeLabel,
    area: b.area,
    services: b.services,
    pay_goal: b.payGoal,
    goal_note: b.goalNote ?? null,
    opening_day: b.openingDay ?? null,
    launched_at: b.launchedAt ?? null,
    created_at: b.createdAt,
  };
}

export function toMoneyPlan(row: MoneyPlanRow | null): MoneyPlan | null {
  if (!row) return null;
  return { monthlyCosts: row.monthly_costs ?? [], startupCosts: row.startup_costs ?? [], saved: Number(row.saved) };
}

export function moneyPlanRow(userId: string, p: MoneyPlan): MoneyPlanRow {
  return { user_id: userId, monthly_costs: p.monthlyCosts, startup_costs: p.startupCosts, saved: p.saved };
}

export function toTransaction(t: TransactionRow): Transaction {
  return { id: t.id, date: t.date, kind: t.kind, amount: Number(t.amount), label: t.label, category: t.category };
}

export function transactionRow(userId: string, t: Transaction): TransactionRow {
  return { ...t, user_id: userId };
}

export type EventRow = {
  id: string;
  user_id: string;
  title: string;
  type: CalendarEvent["type"];
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_date: string | null;
  end_date: string | null;
  time_zone: string;
  client_name: string | null;
  price: number | string | null;
  location: string | null;
  notes: string | null;
  repeats_weekly: boolean;
  repeat_until: string | null;
  source: CalendarEvent["source"];
  roadmap_task_id: string | null;
};

export function toEvent(r: EventRow): CalendarEvent {
  return {
    id: r.id,
    title: r.title,
    type: r.type,
    allDay: r.all_day,
    // Timed: normalize to an ISO string in UTC. All-day: the plain date.
    start: r.all_day ? (r.start_date ?? "") : new Date(r.starts_at ?? 0).toISOString(),
    end: r.all_day ? (r.end_date ?? r.start_date ?? "") : new Date(r.ends_at ?? r.starts_at ?? 0).toISOString(),
    timeZone: r.time_zone,
    clientName: r.client_name ?? undefined,
    price: r.price === null ? undefined : Number(r.price),
    location: r.location ?? undefined,
    notes: r.notes ?? undefined,
    repeatsWeekly: r.repeats_weekly,
    repeatUntil: r.repeat_until ?? undefined,
    source: r.source,
    roadmapTaskId: r.roadmap_task_id ?? undefined,
  };
}

export function eventRow(userId: string, e: CalendarEvent): EventRow {
  return {
    id: e.id,
    user_id: userId,
    title: e.title,
    type: e.type,
    all_day: e.allDay,
    starts_at: e.allDay ? null : e.start,
    ends_at: e.allDay ? null : e.end,
    start_date: e.allDay ? e.start : null,
    end_date: e.allDay ? e.end : null,
    time_zone: e.timeZone,
    client_name: e.clientName ?? null,
    price: e.price ?? null,
    location: e.location ?? null,
    notes: e.notes ?? null,
    repeats_weekly: e.repeatsWeekly,
    repeat_until: e.repeatUntil ?? null,
    source: e.source,
    roadmap_task_id: e.roadmapTaskId ?? null,
  };
}

/** The tables that hold one person's business data. */
export const DATA_TABLES = ["events", "transactions", "roadmap_tasks", "money_plans", "businesses"] as const;
