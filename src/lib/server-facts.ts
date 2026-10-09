// Server-only helpers shared by the This Week and Content routes: read everything plain code
// needs for the week's facts, AS the owner (row level security).

import type { SupabaseClient } from "@supabase/supabase-js";
import { toEvent, toTransaction, type EventRow, type TransactionRow } from "./db-rows";
import type { Business, Mode } from "./store";
import { addDaysToKey } from "./timezone";
import { weekFacts, type LastWeekAction } from "./week-facts";

const DAY = 86_400_000;

export function validTimeZone(tz: unknown): string {
  if (typeof tz !== "string" || tz.length > 64) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "America/New_York";
  }
}
export function intSetting(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Everything plain code needs for the facts, read AS the owner. */
export async function gatherFacts(db: SupabaseClient, userId: string, business: Business, mode: Mode, weekStart: string, now: Date, timeZone: string) {
  const lastWeekStart = addDaysToKey(weekStart, -7);
  const monthAgo = new Date(now.getTime() - 30 * DAY).toISOString();
  const [tasks, txs, evs, notes, lastPlans, chat, done, posted] = await Promise.all([
    db.from("roadmap_tasks").select("task_id").eq("user_id", userId),
    db.from("transactions").select("*").eq("user_id", userId),
    db.from("events").select("*").eq("user_id", userId),
    db.from("business_notes").select("note").eq("user_id", userId).order("updated_at", { ascending: false }).limit(30),
    db.from("weekly_plans").select("id").eq("user_id", userId).eq("week_start", lastWeekStart).eq("status", "ready").order("attempt", { ascending: false }).limit(1),
    db.from("chat_messages").select("content").eq("user_id", userId).eq("role", "user").gte("created_at", monthAgo).limit(40),
    db
      .from("plan_actions")
      .select("client_first_name, decided_at")
      .eq("user_id", userId)
      .eq("type", "client_message")
      .eq("status", "done")
      .not("decided_at", "is", null)
      .order("decided_at", { ascending: false })
      .limit(200),
    db.from("content_posts").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "posted").gte("day", lastWeekStart).lt("day", weekStart),
  ]);
  let lastWeek: LastWeekAction[] = [];
  const lastId = lastPlans.data?.[0]?.id as string | undefined;
  if (lastId) {
    const { data } = await db.from("plan_actions").select("type, title, status, client_first_name").eq("plan_id", lastId).order("position");
    lastWeek = (data ?? []) as LastWeekAction[];
  }
  const transactions = ((txs.data ?? []) as TransactionRow[]).map(toTransaction);
  const events = ((evs.data ?? []) as EventRow[]).map(toEvent);
  const facts = weekFacts({
    business,
    mode,
    completedTaskIds: (tasks.data ?? []).map((t) => t.task_id as string),
    transactions,
    events,
    notes: (notes.data ?? []).map((n) => n.note as string),
    ownerChat: (chat.data ?? []).map((m) => m.content as string),
    lastWeek,
    // Optional: the content tables may not exist yet (content.sql not run).
    ...(posted.error ? {} : { postedLastWeek: posted.count ?? 0 }),
    doneTexts: (done.data ?? [])
      .filter((d) => d.client_first_name && d.decided_at)
      .map((d) => ({ first: d.client_first_name as string, decidedAt: d.decided_at as string })),
    now,
    timeZone,
  });
  return { facts, transactions, events, notes: (notes.data ?? []).map((n) => n.note as string) };
}
