// What Second knows when it answers: its personality (fixed) and this owner's
// business (built fresh from their saved data on every message). Used only by the
// server route src/app/api/chat/route.ts.

import { roadmapDates, occurrencesBetween } from "./calendar";
import { dateKeyIn } from "./timezone";
import { formatMoney, monthTotals, sessionMath, sumCosts } from "./money";
import { roadmapProgress } from "./roadmap";
import type { BusinessNote, ChatProposal } from "./chat";
import type { EventRef } from "./chat-tools";
import type { Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";

// Fixed part first, so it can be cached later if it grows. Nothing in here changes per request.
export const SECOND_PERSONA = `You are Second, a business partner in the pocket of a small local business owner. Many of the people you help are great at their craft (massage, catering, training, hair, cleaning, photography) but new to the business side, and some are older and not comfortable with technology.

How you talk:
- Warm, calm and encouraging, like a friend who ran a small shop for 30 years.
- Plain English and short sentences. No business jargon or buzzwords. If a business word is needed (like LLC or EIN), explain it in a few words.
- Short and practical. Usually 2 to 5 sentences, or up to 5 short bullet points that start with "- ". Give one clear next step when it helps.
- Plain text only: no headings, tables, bold or other formatting.
- Use what you know about their business (below) so the answer fits them. Use their real numbers when they help. If you don't know something, say so or ask one short question.

What you can and can't do:
- You can explain, plan, do the math, and write drafts (emails, posts, texts, price lists) for them to copy.
- You can't send, post, book, file, buy or change anything yourself, you can't see their email, and you can't browse the internet. Never say or suggest you did. If they ask, write the draft and tell them where to use it.
- When they ask you to find local businesses to partner or do a deal with, you CAN look them up on the map, and look up a business's public email (rules below).
- You CAN suggest changes to their saved information with the suggest_ tools (rules below). A suggestion is only a card they can approve.
- For legal, tax or license rules, give the general picture, then point them to the official office for their state or town, or a local accountant.
- The Second app has: a launch plan with roadmap steps, a money plan, money tracking, a calendar, This Week (a weekly game plan on Home), Content (weekly post ideas and captions), and Outreach (find local businesses, find their public email, and draft emails they send themselves). Point them there when it helps.`;

const DAY = 86_400_000;

function fmtDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function fmtTime(date: Date, timeZone: string): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(":00", "");
}

const TYPE_NAMES: Record<CalendarEvent["type"], string> = {
  appointment: "client appointment",
  business: "business event",
  deadline: "deadline",
  reminder: "reminder",
};

export type ChatContextData = {
  business: Business;
  mode: Mode;
  completedTaskIds: string[];
  moneyPlan: MoneyPlan | null;
  transactions: Transaction[];
  events: CalendarEvent[];
  timeZone: string;
  now: Date;
};

/** A plain-text snapshot of this owner's business for the system prompt, plus the E numbers for calendar items. */
export function businessContext(d: ChatContextData): { text: string; refs: EventRef[] } {
  const { business: b, timeZone, now } = d;
  const today = dateKeyIn(now, timeZone);
  const lines: string[] = [];

  lines.push(`Today is ${fmtDay(today)}, ${today.slice(0, 4)}.`);
  lines.push(`Owner's first name: ${b.ownerName || "unknown"}.`);
  lines.push(`Business: ${b.businessName ? `"${b.businessName}"` : "no name yet"}, ${b.typeLabel}, in ${b.area || "an area they haven't given"}.`);

  if (d.mode === "launch") {
    const opening = b.openingDay
      ? `Their target opening day is ${fmtDay(b.openingDay)}, ${b.openingDay.slice(0, 4)} (${Math.max(0, Math.round((Date.parse(b.openingDay) - Date.parse(today)) / DAY))} days away).`
      : "They haven't picked an opening day yet.";
    lines.push(`Stage: NOT OPEN YET (Launch mode). They are getting ready to open. ${opening}`);
  } else {
    lines.push(`Stage: OPEN AND RUNNING (Running mode)${b.launchedAt ? `, open since ${b.launchedAt.slice(0, 10)}` : ""}.`);
  }

  if (b.services.length) {
    const services = b.services
      .map((s) => `${s.name} ${s.price > 0 ? formatMoney(s.price) : "(no price yet)"}${s.minutes ? `, ${s.minutes} min` : ""}`)
      .join("; ");
    lines.push(`Services and prices: ${services}. The first one is their main service.`);
  } else {
    lines.push("Services: none added yet.");
  }
  lines.push(`Monthly pay goal for themselves: ${b.payGoal > 0 ? formatMoney(b.payGoal) : "not set"}.${b.goalNote ? ` Their own goal: "${b.goalNote}".` : ""}`);

  // Roadmap (mostly matters before opening)
  const roadmap = roadmapProgress(b.type, d.completedTaskIds);
  if (d.mode === "launch") {
    const stages = roadmap.stages.map((s, i) => `${s.label} (${roadmap.statuses[i]})`).join(", ");
    const next = roadmap.nextTasks(3).map(({ task, stage }) => `"${task.title}" (${stage.label})`);
    lines.push(`Launch roadmap: ${roadmap.doneCount} of ${roadmap.total} steps done (${roadmap.percent}%). Stages: ${stages}.`);
    lines.push(next.length ? `Next steps on their roadmap: ${next.join(", ")}.` : "Every roadmap step is done.");
  }

  // Money tracked
  const month = today.slice(0, 7);
  const [py, pm] = month.split("-").map(Number);
  const lastMonth = pm === 1 ? `${py - 1}-12` : `${py}-${String(pm - 1).padStart(2, "0")}`;
  if (d.transactions.length === 0) {
    lines.push("Money tracking: nothing logged yet.");
  } else {
    const t = monthTotals(d.transactions, month);
    const last = monthTotals(d.transactions, lastMonth);
    const top = t.categories.slice(0, 3).map((c) => `${c.label} ${formatMoney(c.amount)}`).join(", ");
    lines.push(
      `Money this month so far: earned ${formatMoney(t.earned)} from ${t.incomeCount} payments, spent ${formatMoney(t.spent)}, kept ${formatMoney(t.kept)}${top ? ` (biggest costs: ${top})` : ""}. Last month they kept ${formatMoney(last.kept)} (earned ${formatMoney(last.earned)}, spent ${formatMoney(last.spent)}).`,
    );
    // Each entry on its own line with its date, so who PAID is never confused with who is only BOOKED.
    // The description is what the owner typed; it often includes the client's name.
    const MAX_ENTRIES = 15;
    const entries = t.transactions.slice(0, MAX_ENTRIES).map((x) =>
      x.kind === "income"
        ? `- ${fmtDay(x.date)}: PAYMENT RECEIVED ${formatMoney(x.amount)}, "${x.label}"`
        : `- ${fmtDay(x.date)}: EXPENSE ${formatMoney(x.amount)}, "${x.label}" (${x.category})`,
    );
    if (entries.length) {
      const more = t.transactions.length > MAX_ENTRIES ? `\n- (${t.transactions.length - MAX_ENTRIES} older entries this month not shown)` : "";
      lines.push(
        `Money entries this month, newest first. These already happened. The words in quotes are what the owner typed, and often include the client's name:\n${entries.join("\n")}${more}`,
      );
    }
  }

  // Money plan
  const plan = d.moneyPlan;
  if (plan && (plan.monthlyCosts.length || plan.startupCosts.length || plan.saved)) {
    const monthly = plan.monthlyCosts.map((c) => `${c.label} ${formatMoney(c.amount)}`).join(", ");
    const price = b.services[0]?.price ?? 0;
    const math = sessionMath(plan, price, b.payGoal);
    lines.push(
      `Money plan: monthly costs ${formatMoney(sumCosts(plan.monthlyCosts))}${monthly ? ` (${monthly})` : ""}. Startup costs ${formatMoney(sumCosts(plan.startupCosts))}, saved so far ${formatMoney(plan.saved)}.` +
        (price > 0 ? ` At ${formatMoney(price)} per visit they need ${math.toCover} visits a month to cover costs and ${math.toGoal} to also hit their pay goal (${math.perWeek.toLowerCase()}).` : ""),
    );
  } else {
    lines.push("Money plan: no costs added yet.");
  }

  // Calendar: the next 14 days
  const from = now;
  const to = new Date(now.getTime() + 14 * DAY);
  const extras = d.mode === "launch" ? roadmapDates(b, roadmap) : [];
  const upcoming = occurrencesBetween(d.events, from, to, extras).slice(0, 10);
  const refs: EventRef[] = [];
  if (upcoming.length === 0) {
    lines.push("Calendar, next 14 days: nothing planned.");
  } else {
    const items = upcoming.map((o, i) => {
      const day = o.allDay ? o.firstDay : dateKeyIn(o.start, timeZone);
      const when = o.allDay ? `${fmtDay(day)} (all day)` : `${fmtDay(day)} ${fmtTime(o.start, timeZone)}`;
      const who = o.event.clientName ? `, client ${o.event.clientName}` : "";
      const editable = !o.link && !o.event.repeatsWeekly;
      const ref = `E${i + 1}`;
      refs.push({ ref, eventId: o.event.id, title: o.event.title, editable, when });
      const note = o.link ? ", roadmap date" : o.event.repeatsWeekly ? ", repeats weekly" : "";
      return `- ${ref}: ${when}: ${o.event.title} (${TYPE_NAMES[o.event.type]}${who}${note})`;
    });
    lines.push(
      `Calendar, next 14 days. These are bookings and plans that haven't happened yet. A booked client has NOT paid unless a matching payment appears above:\n${items.join("\n")}`,
    );
  }

  return { text: `What you know about this owner's business (from their Second account, kept up to date):\n${lines.join("\n")}`, refs };
}

/** Notes saved from past chats, newest first. */
export function notesContext(notes: BusinessNote[]): string {
  if (notes.length === 0) return "Notes from past chats: none yet.";
  return `Notes from past chats. These are things the owner told you before: their goals, plans, preferences and worries. Use them in your answers whenever they're relevant. When the owner asks about their goals, include the goals in these notes, not only the monthly pay goal. The owner can see, edit and delete these notes, so trust them over older messages:\n${notes
    .map((n) => `- ${n.note}`)
    .join("\n")}`;
}

/** Recent suggestion cards and what the owner did with them. */
export function proposalsContext(proposals: Pick<ChatProposal, "summary" | "status">[]): string {
  if (proposals.length === 0) return "";
  const label = { pending: "waiting for their answer", approved: "APPROVED and saved", ignored: "they IGNORED it", stale: "could not be applied" };
  return `Your recent suggestion cards:\n${proposals.map((p) => `- ${p.summary}: ${label[p.status]}`).join("\n")}`;
}
