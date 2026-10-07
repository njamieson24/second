// Account storage: data lives in Supabase, one set of rows per signed-in person.
// Only store.ts uses this file.
//
// Reads load everything once per sign-in and keep a copy in memory. Writes update
// that copy right away (so typing feels instant), then go to the database in the
// background, in order. Fast typing in a money box is grouped into one save.

import {
  businessProfileRow,
  DATA_TABLES,
  eventRow,
  toEvent,
  type EventRow,
  moneyPlanRow,
  toBusiness,
  toMoneyPlan,
  toTransaction,
  transactionRow,
  type BusinessRow,
  type MoneyPlanRow,
  type TransactionRow,
} from "./db-rows";
import { supabase } from "./supabase";
import type { Backend, Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";

function check<T extends { error: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}

type Cache = {
  business: Business | null;
  mode: Mode | null;
  showSamples: boolean;
  tasks: string[];
  plan: MoneyPlan | null;
  transactions: Transaction[];
  events: CalendarEvent[];
};

export function createSupabaseBackend(userId: string, reportError: (error: unknown) => void): Backend & {
  /** Send every waiting save right now (used when the page is closing). */
  flush: () => void;
  /** Finish every waiting save, in order. */
  settle: () => Promise<void>;
} {
  const db = supabase();
  let cache: Cache | null = null;
  let loading: Promise<Cache> | null = null;

  // Writes run one after another, in the order they were made.
  type Write = () => PromiseLike<unknown>;
  const waiting: Write[] = [];
  let running = false;
  let idleWaiters: (() => void)[] = [];
  const pump = async () => {
    if (running) return;
    running = true;
    while (waiting.length) {
      const write = waiting.shift()!;
      try {
        await write();
      } catch (error) {
        reportError(error);
      }
    }
    running = false;
    idleWaiters.forEach((resolve) => resolve());
    idleWaiters = [];
  };
  const enqueue = (write: Write) => {
    waiting.push(write);
    void pump();
  };
  const idle = () =>
    running || waiting.length ? new Promise<void>((resolve) => idleWaiters.push(resolve)) : Promise.resolve();

  // Group rapid changes (typing) into one save.
  const timers = new Map<string, { timer: ReturnType<typeof setTimeout>; write: Write }>();
  const later = (key: string, write: Write, ms = 400) => {
    const pending = timers.get(key);
    if (pending) clearTimeout(pending.timer);
    timers.set(key, {
      write,
      timer: setTimeout(() => {
        timers.delete(key);
        enqueue(write);
      }, ms),
    });
  };
  // The page is closing: there's no time to go one by one, so send everything at
  // once. Requests use keepalive (see supabase.ts) so they finish after the page is gone.
  const flush = () => {
    timers.forEach(({ timer, write }) => {
      clearTimeout(timer);
      waiting.push(write);
    });
    timers.clear();
    waiting.splice(0).forEach((write) => {
      Promise.resolve(write()).catch(reportError);
    });
  };
  // Before signing out or resetting: finish every save, in order.
  const settle = async () => {
    timers.forEach(({ timer, write }) => {
      clearTimeout(timer);
      enqueue(write);
    });
    timers.clear();
    await idle();
  };

  async function load(): Promise<Cache> {
    if (cache) return cache;
    if (!loading) {
      loading = (async () => {
        const [business, tasks, plan, transactions, events] = await Promise.all([
          db.from("businesses").select("*").eq("user_id", userId).maybeSingle(),
          db.from("roadmap_tasks").select("task_id").eq("user_id", userId),
          db.from("money_plans").select("*").eq("user_id", userId).maybeSingle(),
          db.from("transactions").select("*").eq("user_id", userId).order("date"),
          // The calendar is optional: if its table isn't set up yet, the rest still loads.
          db.from("events").select("*").eq("user_id", userId).then((r) => {
            if (r.error) console.warn("Calendar not available yet:", r.error.message);
            return { ...r, error: null, data: r.error ? [] : r.data };
          }),
        ]).then((results) => results.map(check));
        const row = business.data as BusinessRow | null;
        cache = {
          business: toBusiness(row),
          mode: row?.mode ?? null,
          showSamples: row?.show_samples === true,
          tasks: ((tasks.data ?? []) as { task_id: string }[]).map((t) => t.task_id),
          plan: toMoneyPlan(plan.data as MoneyPlanRow | null),
          transactions: ((transactions.data ?? []) as TransactionRow[]).map(toTransaction),
          events: ((events.data ?? []) as EventRow[]).map(toEvent),
        };
        return cache;
      })().catch((error) => {
        loading = null; // let the next read try again
        throw error;
      });
    }
    return loading;
  }

  const saveBusinessRow = () => {
    const b = cache?.business;
    if (!b) return Promise.resolve();
    return db.from("businesses").upsert(businessProfileRow(userId, b)).then(check);
  };

  const savePlanRow = () => {
    const p = cache?.plan;
    if (!p) return Promise.resolve();
    return db.from("money_plans").upsert(moneyPlanRow(userId, p)).then(check);
  };

  return {
    flush,
    settle,

    async getBusiness() {
      return (await load()).business;
    },
    async saveBusiness(business) {
      const c = await load();
      c.business = business;
      later("business", saveBusinessRow);
    },

    async getMode() {
      return (await load()).mode;
    },
    async saveMode(mode) {
      const c = await load();
      c.mode = mode;
      enqueue(() => db.from("businesses").upsert({ user_id: userId, mode }).then(check));
    },

    async getShowSamples() {
      return (await load()).showSamples;
    },

    async getTasks() {
      return [...(await load()).tasks];
    },
    async completeTask(taskId) {
      const c = await load();
      if (c.tasks.includes(taskId)) return;
      c.tasks = [...c.tasks, taskId];
      enqueue(() =>
        db
          .from("roadmap_tasks")
          .upsert({ user_id: userId, task_id: taskId }, { ignoreDuplicates: true })
          .then(check),
      );
    },
    async uncompleteTask(taskId) {
      const c = await load();
      c.tasks = c.tasks.filter((id) => id !== taskId);
      enqueue(() => db.from("roadmap_tasks").delete().eq("user_id", userId).eq("task_id", taskId).then(check));
    },

    async getMoneyPlan() {
      return (await load()).plan;
    },
    async saveMoneyPlan(plan) {
      const c = await load();
      c.plan = plan;
      later("plan", savePlanRow);
    },

    async getTransactions() {
      return [...(await load()).transactions];
    },
    async addTransaction(t) {
      const c = await load();
      c.transactions = [...c.transactions, t];
      enqueue(() => db.from("transactions").insert(transactionRow(userId, t)).then(check));
    },
    async deleteTransaction(id) {
      const c = await load();
      c.transactions = c.transactions.filter((t) => t.id !== id);
      enqueue(() => db.from("transactions").delete().eq("user_id", userId).eq("id", id).then(check));
    },

    async getEvents() {
      return [...(await load()).events];
    },
    async addEvent(event) {
      const c = await load();
      c.events = [...c.events, event];
      enqueue(() => db.from("events").insert(eventRow(userId, event)).then(check));
    },
    async updateEvent(event) {
      const c = await load();
      c.events = c.events.map((e) => (e.id === event.id ? event : e));
      enqueue(() => db.from("events").update(eventRow(userId, event)).eq("user_id", userId).eq("id", event.id).then(check));
    },
    async deleteEvent(id) {
      const c = await load();
      c.events = c.events.filter((e) => e.id !== id);
      enqueue(() => db.from("events").delete().eq("user_id", userId).eq("id", id).then(check));
    },

    async resetAll() {
      await settle();
      await Promise.all(DATA_TABLES.map((table) => db.from(table).delete().eq("user_id", userId).then(check)));
      cache = { business: null, mode: null, showSamples: false, tasks: [], plan: null, transactions: [], events: [] };
    },
  };
}
