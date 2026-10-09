// "This Week": the facts, worked out by plain code before Claude sees anything.
// Used only by the server route src/app/api/week/route.ts.
//
// Clients are only ever shown to Claude by FIRST name. Full names stay on the server.

import { occurrencesBetween } from "./calendar";
import { formatMoney, monthTotals } from "./money";
import { roadmapProgress } from "./roadmap";
import type { Business, CalendarEvent, Mode, Transaction } from "./store";
import { addDaysToKey, dateKeyIn } from "./timezone";
import type { ActionStatus, ActionType } from "./week";

const DAY = 86_400_000;
const LAPSED_DAYS = 35;
/** After a check-in text is marked Done, that client rests this long before another one. */
export const TEXT_REST_DAYS = 21;
/** After this many Done texts with no new visit or payment, stop suggesting that client. */
export const MAX_UNANSWERED_TEXTS = 2;

export type LastWeekAction = { type: ActionType; title: string; status: ActionStatus; client_first_name?: string | null };

export type FactsInput = {
  business: Business;
  mode: Mode;
  completedTaskIds: string[];
  transactions: Transaction[];
  events: CalendarEvent[];
  notes: string[];
  /** The owner's own recent chat messages (never sent to Claude here; only used to allow real business names) */
  ownerChat: string[];
  lastWeek: LastWeekAction[];
  /** Posts marked as posted on the Content page last week (optional) */
  postedLastWeek?: number;
  /** Every check-in text the owner marked Done: client first name and when */
  doneTexts: { first: string; decidedAt: string }[];
  /** "Now", already moved forward by the test-only week offset */
  now: Date;
  timeZone: string;
};

export type LapsedClient = { first: string; full: string; daysSince: number };
/** A lapsed client Second won't suggest texting this week, and why. */
export type RestingClient = { first: string; reason: "texted_recently" | "no_answer" };

export type Facts = {
  text: string;
  /** Every number that appears in the facts (no commas), so "why" lines can be checked */
  numbers: Set<string>;
  lapsed: LapsedClient[];
  /** Lapsed clients held back by the texting rules (never offered to Claude) */
  resting: RestingClient[];
  /** Text the owner wrote (notes), where a real business name may appear */
  ownerText: string;
  /** Last week's SKIPPED actions: not repeated this week (checked on the server) */
  skipped: { title: string; client: string | null }[];
  /** For the plain-code fallback plan */
  money: { gap: number; kept: number; goal: number } | null;
  freeDays: number;
  /** Weekday names of the days with nothing booked, like ["Thu", "Fri"] */
  freeDayNames: string[];
  launch: { steps: { title: string; stage: string }[]; done: number; total: number; daysToOpening: number | null } | null;
};

/** Monday of the week that contains `key` (YYYY-MM-DD). */
export function mondayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDaysToKey(key, -((dow + 6) % 7));
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

const daysBetween = (fromKey: string, toKey: string) => Math.round((Date.parse(toKey) - Date.parse(fromKey)) / DAY);
const firstName = (full: string) => full.trim().split(/\s+/)[0].replace(/[^\p{L}'-]/gu, "") || full.trim();

/** Clients whose last visit (calendar appointment or income entry) was 5+ weeks ago, with nothing booked ahead. */
function lapsedClients(input: FactsInput, today: string): (LapsedClient & { lastVisit: string })[] {
  const { events, transactions, now, timeZone } = input;
  const last = new Map<string, { full: string; day: string }>();
  const seen = (name: string | undefined, day: string) => {
    const full = name?.trim();
    if (!full) return;
    const key = full.toLowerCase();
    const prev = last.get(key);
    if (!prev || day > prev.day) last.set(key, { full, day });
  };
  const past = occurrencesBetween(events, new Date(now.getTime() - 400 * DAY), now).filter((o) => o.event.type === "appointment");
  past.forEach((o) => seen(o.event.clientName, o.allDay ? o.firstDay : dateKeyIn(o.start, timeZone)));
  transactions.filter((t) => t.kind === "income" && t.date <= today).forEach((t) => seen(t.clientName, t.date));

  const ahead = new Set(
    occurrencesBetween(events, now, new Date(now.getTime() + 120 * DAY))
      .filter((o) => o.event.type === "appointment" && o.event.clientName)
      .map((o) => o.event.clientName!.trim().toLowerCase()),
  );
  return [...last.entries()]
    .filter(([key]) => !ahead.has(key))
    .map(([, v]) => ({ first: firstName(v.full), full: v.full, daysSince: daysBetween(v.day, today), lastVisit: v.day }))
    .filter((c) => c.daysSince >= LAPSED_DAYS)
    .sort((a, b) => b.daysSince - a.daysSince);
}

/**
 * The texting rules, checked here so a held-back client never reaches Claude:
 * - a Done check-in text rests that client for TEXT_REST_DAYS;
 * - MAX_UNANSWERED_TEXTS Done texts since their last visit or payment stops suggestions
 *   entirely, until they book or pay again (a newer visit resets the count).
 * Skipped texts follow the skip rule in week-plan.ts.
 */
export function applyTextingRules(
  clients: (LapsedClient & { lastVisit: string })[],
  doneTexts: { first: string; decidedAt: string }[],
  now: Date,
): { allowed: LapsedClient[]; resting: RestingClient[] } {
  const allowed: LapsedClient[] = [];
  const resting: RestingClient[] = [];
  for (const c of clients) {
    const texts = doneTexts.filter((t) => t.first.toLowerCase() === c.first.toLowerCase());
    // Texts sent after their last visit or payment (a Done text on the visit day doesn't count against them)
    const sinceVisit = texts.filter((t) => t.decidedAt.slice(0, 10) > c.lastVisit);
    const latest = Math.max(0, ...texts.map((t) => Date.parse(t.decidedAt)));
    if (sinceVisit.length >= MAX_UNANSWERED_TEXTS) resting.push({ first: c.first, reason: "no_answer" });
    else if (latest && now.getTime() - latest < TEXT_REST_DAYS * DAY) resting.push({ first: c.first, reason: "texted_recently" });
    else allowed.push({ first: c.first, full: c.full, daysSince: c.daysSince });
  }
  return { allowed, resting };
}

export function weekFacts(input: FactsInput): Facts {
  const { business: b, now, timeZone } = input;
  const today = dateKeyIn(now, timeZone);
  const lines: string[] = [];

  lines.push(`Today is ${dayLabel(today)}.`);
  lines.push(`Owner's first name: ${b.ownerName}. Business: ${b.typeLabel}, in ${b.area || "their town"}.`);
  if (b.services.length)
    lines.push(`Services: ${b.services.map((s) => `${s.name} ${formatMoney(s.price)}${s.minutes ? ` (${s.minutes} min)` : ""}`).join("; ")}.`);

  let money: Facts["money"] = null;
  let freeDays = 0;
  let freeDayNames: string[] = [];
  let lapsed: LapsedClient[] = [];
  let resting: RestingClient[] = [];
  let launch: Facts["launch"] = null;

  if (input.mode === "running") {
    lines.push("Stage: open and running.");
    // Money vs. pay goal, and pace
    const month = today.slice(0, 7);
    const [y, m, d] = today.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const t = monthTotals(input.transactions, month);
    lines.push(`Money this month, day ${d} of ${daysInMonth}: earned ${formatMoney(t.earned)}, spent ${formatMoney(t.spent)}, kept ${formatMoney(t.kept)}.`);
    if (b.payGoal > 0) {
      const onPace = Math.round((b.payGoal * d) / daysInMonth);
      const gap = onPace - t.kept;
      const projected = d > 0 ? Math.round((t.kept / d) * daysInMonth) : 0;
      lines.push(
        `Monthly pay goal: ${formatMoney(b.payGoal)}. To be on pace by today they'd have kept about ${formatMoney(onPace)}, so they are ${formatMoney(Math.abs(gap))} ${gap > 0 ? "BEHIND" : "AHEAD of"} pace. At this rate they'll keep about ${formatMoney(projected)} this month.`,
      );
      money = { gap, kept: t.kept, goal: b.payGoal };
    } else lines.push("No monthly pay goal set.");

    // Days with nothing booked (there are no business hours in the app yet)
    const booked = occurrencesBetween(input.events, now, new Date(now.getTime() + 7 * DAY)).filter((o) => o.event.type === "appointment");
    const bookedDays = new Set(booked.map((o) => (o.allDay ? o.firstDay : dateKeyIn(o.start, timeZone))));
    const free = Array.from({ length: 7 }, (_, i) => addDaysToKey(today, i)).filter((k) => !bookedDays.has(k));
    freeDays = free.length;
    freeDayNames = free.map((k) => dayLabel(k).split(",")[0]);
    lines.push(
      `Next seven days: ${booked.length} client ${booked.length === 1 ? "appointment" : "appointments"} booked; ${free.length} ${free.length === 1 ? "day" : "days"} with nothing booked (${free.map(dayLabel).join(", ") || "none"}). The app doesn't know their opening hours, so some of these may be days off.`,
    );

    const rules = applyTextingRules(lapsedClients(input, today), input.doneTexts, now);
    lapsed = rules.allowed.slice(0, 5);
    resting = rules.resting;
    lines.push(
      lapsed.length
        ? `Clients who haven't been back in five weeks or more, with nothing booked, and OK to text this week (first names only): ${lapsed.map((c) => `${c.first}, last visit ${c.daysSince} days ago`).join("; ")}.`
        : "No clients to text this week.",
    );
    if (resting.length)
      lines.push(`Do NOT suggest texting these clients this week (they were texted recently or haven't answered): ${resting.map((c) => c.first).join(", ")}.`);
  } else {
    const roadmap = roadmapProgress(b.type, input.completedTaskIds);
    const steps = roadmap.nextTasks(3).map(({ task, stage }) => ({ title: task.title, stage: stage.label }));
    const daysToOpening = b.openingDay ? daysBetween(today, b.openingDay) : null;
    launch = { steps, done: roadmap.doneCount, total: roadmap.total, daysToOpening };
    lines.push(`Stage: not open yet (getting ready to open). Roadmap: ${roadmap.doneCount} of ${roadmap.total} steps done.`);
    if (steps.length) {
      lines.push(`Current roadmap step: "${steps[0].title}" (stage: ${steps[0].stage}).`);
      if (steps.length > 1) lines.push(`After that: ${steps.slice(1).map((s) => `"${s.title}" (${s.stage})`).join(", ")}.`);
    } else lines.push("Every roadmap step is done.");
    lines.push(daysToOpening !== null ? `Opening day: ${dayLabel(b.openingDay!)}, ${daysToOpening} days away.` : "No opening day picked yet.");
  }

  if (input.postedLastWeek !== undefined) lines.push(`Social posts they marked as posted last week: ${input.postedLastWeek}.`);
  lines.push(input.notes.length ? `Notes from past chats:\n${input.notes.map((n) => `- ${n}`).join("\n")}` : "Notes from past chats: none.");
  lines.push(
    input.lastWeek.length
      ? `Last week's plan (don't repeat anything SKIPPED, and don't text a client they skipped):\n${input.lastWeek
          .map((a) => `- ${a.title} (${a.type}${a.client_first_name ? `, client ${a.client_first_name}` : ""}): ${a.status === "open" ? "not marked" : a.status.toUpperCase()}`)
          .join("\n")}`
      : "Last week's plan: none.",
  );

  const text = lines.join("\n");
  const numbers = new Set((text.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, "")));
  // Names that are the owner's own (their town, business, services, clients) are fine to mention.
  const ownNames = [b.area, b.businessName, b.ownerName, ...b.services.map((s) => s.name), ...lapsed.map((c) => c.first)];
  const skipped = input.lastWeek.filter((a) => a.status === "skipped").map((a) => ({ title: a.title, client: a.client_first_name ?? null }));
  return { text, numbers, lapsed, resting, ownerText: [...ownNames, ...input.notes, ...input.ownerChat].join("\n"), money, freeDays, freeDayNames, launch, skipped };
}
