// How app data maps to database rows (see supabase/schema.sql).
// Shared by store-supabase.ts (browser) and the demo-data route (server).

import type { CatalogItem } from "./catalog";
import type { Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";

export type BusinessRow = {
  user_id: string;
  mode: Mode | null;
  owner_name: string | null;
  business_name: string;
  type: Business["type"] | null;
  type_label: string | null;
  area: string | null;
  // businesses.services is no longer read or written (prices live in the catalog).
  pay_goal: number | string;
  goal_note: string | null;
  opening_day: string | null;
  launched_at: string | null;
  created_at: string;
  show_samples?: boolean | null;
  content_tone?: Business["contentTone"] | null;
};

export type MoneyPlanRow = {
  user_id: string;
  monthly_costs: MoneyPlan["monthlyCosts"];
  startup_costs: MoneyPlan["startupCosts"];
  saved: number | string;
};

export type TransactionRow = {
  id: string;
  date: string;
  kind: Transaction["kind"];
  amount: number | string;
  label: string;
  category: string;
  user_id: string;
  client_name?: string | null;
  item_id?: string | null;
  variant_id?: string | null;
  quantity?: number | null;
  unit_price?: number | string | null;
  discount?: number | string | null;
  tip?: number | string | null;
  event_id?: string | null;
  event_date?: string | null;
};

export function toBusiness(row: BusinessRow | null): Business | null {
  // A row can exist with only the mode set, before setup is finished.
  if (!row || row.owner_name === null || row.type === null) return null;
  return {
    ownerName: row.owner_name,
    businessName: row.business_name,
    type: row.type,
    typeLabel: row.type_label ?? "",
    area: row.area ?? "",
    // Filled from the catalog by store.ts and catalog-server.ts, never from businesses.services.
    services: [],
    payGoal: Number(row.pay_goal),
    goalNote: row.goal_note ?? undefined,
    openingDay: row.opening_day ?? undefined,
    createdAt: row.created_at,
    launchedAt: row.launched_at ?? undefined,
    ...(row.content_tone ? { contentTone: row.content_tone } : {}),
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
    // services: never written anymore. Prices live in the catalog (catalog.sql).
    pay_goal: b.payGoal,
    goal_note: b.goalNote ?? null,
    opening_day: b.openingDay ?? null,
    launched_at: b.launchedAt ?? null,
    created_at: b.createdAt,
    // Only sent once set, so profile saves still work before content.sql adds the columns.
    ...(b.contentTone ? { content_tone: b.contentTone } : {}),
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
  const num = (v: number | string | null | undefined) => (v === null || v === undefined ? undefined : Number(v));
  return {
    id: t.id,
    date: t.date,
    kind: t.kind,
    amount: Number(t.amount),
    label: t.label,
    category: t.category,
    ...(t.client_name ? { clientName: t.client_name } : {}),
    ...(t.item_id ? { itemId: t.item_id } : {}),
    ...(t.variant_id ? { variantId: t.variant_id } : {}),
    ...(t.quantity ? { quantity: t.quantity } : {}),
    ...(num(t.unit_price) !== undefined ? { unitPrice: num(t.unit_price) } : {}),
    ...(num(t.discount) ? { discount: num(t.discount) } : {}),
    ...(num(t.tip) ? { tip: num(t.tip) } : {}),
    ...(t.event_id ? { eventId: t.event_id } : {}),
    ...(t.event_date ? { eventDate: t.event_date } : {}),
  };
}

export function transactionRow(userId: string, t: Transaction): TransactionRow {
  // Optional columns are only sent when set, so saving still works before week.sql /
  // catalog.sql add them. With unit_price set, the database works out amount itself.
  return {
    id: t.id,
    date: t.date,
    kind: t.kind,
    amount: t.amount,
    label: t.label,
    category: t.category,
    user_id: userId,
    ...(t.clientName ? { client_name: t.clientName } : {}),
    ...(t.itemId ? { item_id: t.itemId } : {}),
    ...(t.variantId ? { variant_id: t.variantId } : {}),
    ...(t.unitPrice !== undefined ? { unit_price: t.unitPrice, quantity: t.quantity ?? 1, discount: t.discount ?? 0, tip: t.tip ?? 0 } : {}),
    ...(t.eventId ? { event_id: t.eventId, event_date: t.eventDate ?? t.date } : {}),
  };
}

export type CatalogItemRow = {
  id: string;
  user_id: string;
  name: string;
  kind: CatalogItem["kind"];
  active: boolean;
  position: number;
};

export type CatalogVariantRow = {
  id: string;
  user_id: string;
  item_id: string;
  label: string;
  minutes: number | null;
  price: number | string;
  is_default: boolean;
  active: boolean;
  position: number;
};

export function toCatalog(items: CatalogItemRow[], variants: CatalogVariantRow[]): CatalogItem[] {
  return items
    .map((i) => ({
      id: i.id,
      name: i.name,
      kind: i.kind,
      active: i.active,
      position: i.position,
      variants: variants
        .filter((v) => v.item_id === i.id)
        .map((v) => ({ id: v.id, label: v.label, minutes: v.minutes, price: Number(v.price), isDefault: v.is_default, active: v.active, position: v.position }))
        .sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => a.position - b.position);
}

export function catalogItemRow(userId: string, item: CatalogItem): CatalogItemRow {
  return { id: item.id, user_id: userId, name: item.name, kind: item.kind, active: item.active, position: item.position };
}

export function catalogVariantRows(userId: string, item: CatalogItem): CatalogVariantRow[] {
  return item.variants.map((v) => ({
    id: v.id,
    user_id: userId,
    item_id: item.id,
    label: v.label.trim(),
    minutes: v.minutes,
    price: v.price,
    is_default: v.isDefault,
    active: v.active,
    position: v.position,
  }));
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
// Order matters for Start over: money entries before the catalog and calendar they point to.
export const DATA_TABLES = ["transactions", "events", "catalog_variants", "catalog_items", "roadmap_tasks", "money_plans", "businesses"] as const;

/**
 * Also cleared by "Start over": what Second learned (notes), its suggestion cards, this
 * week's actions, content ideas and posts, and outreach leads. Not memory_runs, weekly_plans,
 * draft_runs, content_weeks or the outreach logs (the cost logs and caps), and not chat_messages
 * (chat history stays).
 */
export const MEMORY_TABLES = ["chat_proposals", "business_notes", "plan_actions", "content_posts", "outreach_leads"] as const;
