// Suggested updates: the tools Second can use to PROPOSE a change, and the checks that run
// on every proposal. Used only by the server route src/app/api/chat/route.ts.
//
// Claude never writes anything. It fills in one of these forms; the server checks it and
// saves it as a card. Only the owner's Approve button writes, through store.ts.

import type Anthropic from "@anthropic-ai/sdk";
import type { ChatProposal, ProposalChange } from "./chat";
import { formatMoney } from "./money";
import type { Business, CalendarEvent } from "./store";
import { addDaysToKey, dateKeyIn, zonedToDate } from "./timezone";

/** A calendar item Second can see, by short reference (E1, E2...) instead of a long ID. */
export type EventRef = {
  ref: string;
  eventId: string;
  title: string;
  /** Repeating events and roadmap dates can't be moved or cancelled from chat. */
  editable: boolean;
  when: string;
};

const nullable = (type: string) => ({ type: [type, "null"] });
const eventKinds = ["appointment", "business", "deadline", "reminder"];

function tool(name: string, description: string, properties: Record<string, unknown>): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    strict: true,
    eager_input_streaming: true,
    input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

export const PROPOSAL_TOOLS: Anthropic.Beta.BetaTool[] = [
  tool("suggest_price_change", "Suggest a new price for one of the owner's existing services.", {
    service: { type: "string", description: "The service name exactly as listed in their services" },
    new_price: { type: "number", description: "New price in dollars" },
  }),
  tool("suggest_new_service", "Suggest adding a new service the owner says they now offer.", {
    name: { type: "string" },
    price: { type: "number", description: "Price in dollars" },
    minutes: { ...nullable("integer"), description: "Length in minutes, or null if not given" },
  }),
  tool("suggest_remove_service", "Suggest removing a service the owner says they no longer offer.", {
    service: { type: "string", description: "The service name exactly as listed" },
  }),
  tool("suggest_pay_goal", "Suggest a new monthly amount the owner wants to pay themselves.", {
    monthly_amount: { type: "number", description: "Dollars per month" },
  }),
  tool("suggest_new_event", "Suggest adding something to the owner's calendar (a booking, event, deadline or reminder).", {
    title: { type: "string", description: "Short title, like 'Deep tissue, Marcus R.'" },
    kind: { type: "string", enum: eventKinds },
    date: { type: "string", description: "YYYY-MM-DD" },
    all_day: { type: "boolean" },
    start_time: { ...nullable("string"), description: "24-hour HH:MM, or null if all day" },
    end_time: { ...nullable("string"), description: "24-hour HH:MM, or null to use one hour" },
    client_name: { ...nullable("string"), description: "Client's name for appointments, or null" },
  }),
  tool("suggest_move_event", "Suggest moving one of the calendar items listed in the context (by its E number).", {
    event_ref: { type: "string", description: "Like E1" },
    date: { type: "string", description: "New date, YYYY-MM-DD" },
    all_day: { type: "boolean" },
    start_time: { ...nullable("string"), description: "24-hour HH:MM, or null if all day" },
    end_time: { ...nullable("string"), description: "24-hour HH:MM, or null to keep the same length" },
  }),
  tool("suggest_cancel_event", "Suggest removing one of the calendar items listed in the context (by its E number).", {
    event_ref: { type: "string", description: "Like E1" },
  }),
];

export const TOOL_RULES = `Suggesting changes to their saved information:
- When the owner tells you something that changes their saved information (a service price, a new or dropped service, their monthly pay goal, or something to add, move or cancel on their calendar), use the matching suggest_ tool. That puts a card in the chat with Approve and Ignore buttons.
- Before the tool, write one short sentence like "Want me to update Deep tissue to $120?" Never say or suggest you changed, saved, booked or cancelled anything. Nothing changes until they tap Approve.
- The card IS the question. Whenever you offer to update one of these things, call the tool in that same reply. Never ask "want me to update it?" in words alone, because they have no way to say yes except the card.
- Only suggest what they clearly asked for or clearly told you. At most 2 suggestions per reply. Don't suggest something they ignored earlier unless they bring it up again.
- Calendar items you can move or cancel are listed with E numbers. Repeating items and roadmap dates can't be changed from chat: tell them to use the Calendar page.
- There's no tool for business hours or anything else. Just talk about it.`;

// ---------- Checking what Claude filled in ----------

const MAX_PRICE = 10_000;
const money = (n: unknown) => (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= MAX_PRICE ? Math.round(n * 100) / 100 : null);
const text = (s: unknown, max: number) => (typeof s === "string" && s.trim().length > 0 && s.trim().length <= max ? s.trim() : null);
const isDateKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function dayLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}
function timeLabel(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone }).replace(":00", "");
}
function whenLabel(allDay: boolean, start: string, timeZone: string): string {
  return allDay ? `${dayLabel(start)} (all day)` : `${dayLabel(dateKeyIn(new Date(start), timeZone))} at ${timeLabel(start, timeZone)}`;
}

/** Turn a date and times in the owner's time zone into the calendar's start/end. */
function eventTimes(
  date: string,
  allDay: boolean,
  startTime: unknown,
  endTime: unknown,
  timeZone: string,
  defaultMinutes: number,
): { start: string; end: string } | null {
  if (allDay) return { start: date, end: date };
  if (!isTime(startTime)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = startTime.split(":").map(Number);
  const start = zonedToDate({ y, m, d, h, min }, timeZone);
  let end: Date;
  if (isTime(endTime)) {
    const [eh, emin] = endTime.split(":").map(Number);
    end = zonedToDate({ y, m, d, h: eh, min: emin }, timeZone);
    if (end <= start) return null;
  } else end = new Date(start.getTime() + defaultMinutes * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export type ToolCheckContext = { business: Business; events: CalendarEvent[]; refs: EventRef[]; timeZone: string; now: Date };

/** Check one tool call. Returns the change and its card summary, or null if it doesn't hold up. */
export function checkToolCall(name: string, input: unknown, ctx: ToolCheckContext): Omit<ChatProposal, "id" | "messageId" | "status"> | null {
  if (!input || typeof input !== "object") return null;
  const i = input as Record<string, unknown>;
  const { business: b, timeZone } = ctx;
  const today = dateKeyIn(ctx.now, timeZone);
  const okDate = (s: unknown): s is string => isDateKey(s) && s >= addDaysToKey(today, -1) && s <= addDaysToKey(today, 730);
  let change: ProposalChange;
  let summary: string;

  switch (name) {
    case "suggest_price_change": {
      const service = b.services.find((s) => typeof i.service === "string" && sameName(s.name, i.service));
      const price = money(i.new_price);
      if (!service || price === null || price === service.price) return null;
      change = { kind: "set_price", service: service.name, oldPrice: service.price, newPrice: price };
      summary = `Change the price of ${service.name} from ${formatMoney(service.price)} to ${formatMoney(price)}`;
      break;
    }
    case "suggest_new_service": {
      const name = text(i.name, 60);
      const price = money(i.price);
      const minutes = i.minutes === null ? null : Number.isInteger(i.minutes) && (i.minutes as number) >= 5 && (i.minutes as number) <= 600 ? (i.minutes as number) : undefined;
      if (!name || price === null || minutes === undefined || b.services.some((s) => sameName(s.name, name))) return null;
      change = { kind: "add_service", name, price, minutes };
      summary = `Add a new service: ${name}, ${formatMoney(price)}${minutes ? `, ${minutes} minutes` : ""}`;
      break;
    }
    case "suggest_remove_service": {
      const service = b.services.find((s) => typeof i.service === "string" && sameName(s.name, i.service));
      if (!service || b.services.length < 2) return null;
      change = { kind: "remove_service", service: service.name };
      summary = `Remove the service ${service.name}`;
      break;
    }
    case "suggest_pay_goal": {
      const goal = typeof i.monthly_amount === "number" && i.monthly_amount >= 0 && i.monthly_amount <= 1_000_000 ? Math.round(i.monthly_amount) : null;
      if (goal === null || goal === b.payGoal) return null;
      change = { kind: "set_pay_goal", oldGoal: b.payGoal, newGoal: goal };
      summary = `Change your monthly pay goal from ${formatMoney(b.payGoal)} to ${formatMoney(goal)}`;
      break;
    }
    case "suggest_new_event": {
      const title = text(i.title, 120);
      const kind = typeof i.kind === "string" && eventKinds.includes(i.kind) ? (i.kind as CalendarEvent["type"]) : null;
      const allDay = i.all_day === true;
      if (!title || !kind || !okDate(i.date)) return null;
      const times = eventTimes(i.date, allDay, i.start_time, i.end_time, timeZone, 60);
      if (!times) return null;
      const clientName = i.client_name === null ? null : text(i.client_name, 80);
      change = { kind: "add_event", title, type: kind, allDay, ...times, timeZone, clientName };
      summary = `Add to your calendar: ${title}, ${whenLabel(allDay, times.start, timeZone)}`;
      break;
    }
    case "suggest_move_event": {
      const ref = ctx.refs.find((r) => r.ref === i.event_ref && r.editable);
      const event = ref && ctx.events.find((e) => e.id === ref.eventId);
      const allDay = i.all_day === true;
      if (!ref || !event || !okDate(i.date)) return null;
      const length = event.allDay ? 60 : Math.max(15, Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60_000));
      const times = eventTimes(i.date, allDay, i.start_time, i.end_time, timeZone, length);
      if (!times) return null;
      change = { kind: "move_event", eventId: event.id, title: event.title, allDay, ...times };
      summary = `Move "${event.title}" to ${whenLabel(allDay, times.start, timeZone)}`;
      break;
    }
    case "suggest_cancel_event": {
      const ref = ctx.refs.find((r) => r.ref === i.event_ref && r.editable);
      const event = ref && ctx.events.find((e) => e.id === ref.eventId);
      if (!ref || !event) return null;
      change = { kind: "cancel_event", eventId: event.id, title: event.title, when: ref.when };
      summary = `Remove "${event.title}" (${ref.when}) from your calendar`;
      break;
    }
    default:
      return null;
  }
  return { summary, change };
}
