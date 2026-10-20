// Suggested updates: the tools Second can use to PROPOSE a change, and the checks that run
// on every proposal. Used only by the server route src/app/api/chat/route.ts.
//
// Claude never writes anything. It fills in one of these forms; the server checks it and
// saves it as a card. Only the owner's Approve button writes, through store.ts.

import type Anthropic from "@anthropic-ai/sdk";
import { activeItems, activeVariants, entryName, entryTotal, validAmount, variantName, CATALOG_LIMITS, type CatalogItem } from "./catalog";
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

/**
 * What the business sells, by short ID (V1, V2...), one per active option. Second must log
 * income with one of these IDs; the server rejects anything else.
 */
export type CatalogRef = { ref: string; itemId: string; variantId: string; label: string; itemName: string; optionName: string; price: number; minutes: number | null; optionCount: number };

export function catalogRefs(catalog: CatalogItem[]): CatalogRef[] {
  const refs: CatalogRef[] = [];
  for (const item of activeItems(catalog)) {
    const vs = activeVariants(item);
    for (const v of vs) {
      refs.push({
        ref: `V${refs.length + 1}`,
        itemId: item.id,
        variantId: v.id,
        label: entryName(item, v, vs.length),
        itemName: item.name,
        optionName: variantName(v),
        price: v.price,
        minutes: v.minutes,
        optionCount: vs.length,
      });
    }
  }
  return refs;
}

/** The catalog block for Claude: "V1 = Aromatherapy, 60 min, $120". */
export function catalogContext(refs: CatalogRef[]): string {
  if (!refs.length) return "What they sell: nothing listed yet, so you can't log income from chat. Tell them to add it in Settings, Services and prices.";
  return `What they sell (use these IDs to log income; never make up an ID):\n${refs.map((r) => `${r.ref} = ${r.label}, ${formatMoney(r.price)}`).join("\n")}`;
}

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
  tool("suggest_income", "Suggest logging money they were paid for something they sell, by its ID from 'What they sell'.", {
    option_id: { type: "string", description: "An ID from 'What they sell', like V2" },
    quantity: { ...nullable("integer"), description: "How many, or null for 1" },
    price: { ...nullable("number"), description: "Only if they said they charged a different price this time, else null" },
    tip: { ...nullable("number"), description: "Tip in dollars, or null" },
    discount: { ...nullable("number"), description: "Discount in dollars, or null" },
    date: { type: "string", description: "today, yesterday, or YYYY-MM-DD" },
    client_name: { ...nullable("string"), description: "Who paid, only if they said, else null" },
  }),
];

export const TOOL_RULES = `Suggesting changes to their saved information:
- When the owner tells you something that changes their saved information (a service price, a new or dropped service, their monthly pay goal, or something to add, move or cancel on their calendar), use the matching suggest_ tool. That puts a card in the chat with Approve and Ignore buttons.
- Before the tool, write one short sentence like "Want me to update Deep tissue to $120?" Never say or suggest you changed, saved, booked or cancelled anything. Nothing changes until they tap Approve.
- The card IS the question. Whenever you offer to update one of these things, call the tool in that same reply. Never ask "want me to update it?" in words alone, because they have no way to say yes except the card.
- Only suggest what they clearly asked for or clearly told you. At most 2 suggestions per reply. Don't suggest something they ignored earlier unless they bring it up again.
- Calendar items you can move or cancel are listed with E numbers. Repeating items and roadmap dates can't be changed from chat: tell them to use the Calendar page.
- Logging money in: when they tell you they did a session, sold something or got paid for something they sell ("just did a 60 min aromatherapy"), use suggest_income with the ID from "What they sell". Use the listed price unless they said they charged something else. Add a tip, discount, how many or a name only if they said so.
- If what they did has more than one option (like 60 min and 90 min) and they didn't say which, don't call the tool: ask which one, listing the options with prices. If it isn't in "What they sell" at all, say so and suggest adding it in Settings. Never guess an ID.
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

export type ToolCheckContext = {
  business: Business;
  events: CalendarEvent[];
  refs: EventRef[];
  timeZone: string;
  now: Date;
  /** What they sell, by ID (for suggest_income) */
  catalog?: CatalogRef[];
  /** The owner's message (to tell whether they said which option) */
  message?: string;
};

/** A tool call that can't become a card because it's unclear: Second asks this instead. */
export type ToolAsk = { ask: string };

/** Did the owner's message say which option this is ("60 min", "90", "large")? */
function saidOption(message: string, r: CatalogRef): boolean {
  const m = message.toLowerCase();
  if (r.optionName && m.includes(r.optionName.toLowerCase())) return true;
  if (r.minutes && new RegExp(`\\b${r.minutes}\\b`).test(m)) return true;
  if (r.minutes === 60 && /\b(an? hour|one hour|1 ?hr|1 ?hour)\b/.test(m)) return true;
  if (r.minutes === 90 && /\b(hour and a half|1\.5 ?h)/.test(m)) return true;
  if (r.minutes === 30 && /\b(half (an )?hour|half-hour)\b/.test(m)) return true;
  return false;
}

/** Check one tool call. Returns the change and its card summary, a question to ask instead, or null. */
export function checkToolCall(name: string, input: unknown, ctx: ToolCheckContext): Omit<ChatProposal, "id" | "messageId" | "status"> | ToolAsk | null {
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
    case "suggest_income": {
      // Only an ID from this business's own catalog. Anything else is rejected.
      const r = (ctx.catalog ?? []).find((c) => typeof i.option_id === "string" && c.ref === i.option_id.trim().toUpperCase());
      if (!r) return null;
      // More than one option and they didn't say which: ask, never guess.
      if (r.optionCount > 1 && ctx.message !== undefined && !saidOption(ctx.message, r)) {
        const options = (ctx.catalog ?? []).filter((c) => c.itemId === r.itemId);
        return { ask: `Which ${r.itemName} was it: ${options.map((o) => `${o.optionName} (${formatMoney(o.price)})`).join(" or ")}?` };
      }
      const quantity = i.quantity === null || i.quantity === undefined ? 1 : Number.isInteger(i.quantity) && (i.quantity as number) >= 1 && (i.quantity as number) <= CATALOG_LIMITS.maxQuantity ? (i.quantity as number) : null;
      const unitPrice = i.price === null || i.price === undefined ? r.price : validAmount(i.price) ? (i.price as number) : null;
      const tip = i.tip === null || i.tip === undefined ? 0 : validAmount(i.tip) ? (i.tip as number) : null;
      const discount = i.discount === null || i.discount === undefined ? 0 : validAmount(i.discount) ? (i.discount as number) : null;
      if (quantity === null || unitPrice === null || tip === null || discount === null) return null;
      const total = entryTotal({ unitPrice, quantity, discount, tip });
      if (total <= 0 || total > CATALOG_LIMITS.maxEntry) return null;
      // "today", "yesterday" or a date in the last 60 days, in their time zone. Never the future.
      const raw = typeof i.date === "string" ? i.date.trim().toLowerCase() : "today";
      const date = raw === "today" ? today : raw === "yesterday" ? addDaysToKey(today, -1) : isDateKey(raw) ? raw : null;
      if (!date || date > today || date < addDaysToKey(today, -60)) return null;
      const clientName = i.client_name === null || i.client_name === undefined ? null : text(i.client_name, 80);
      change = { kind: "log_income", itemId: r.itemId, variantId: r.variantId, label: r.label, quantity, unitPrice, catalogPrice: r.price, tip, discount, total, date, clientName };
      const parts = [
        `${quantity > 1 ? `${quantity} x ` : ""}${r.label}${unitPrice !== r.price ? ` at ${formatMoney(unitPrice)}` : ""}`,
        tip ? `${formatMoney(tip)} tip` : "",
        discount ? `${formatMoney(discount)} off` : "",
      ].filter(Boolean);
      summary = `Log ${formatMoney(total)} in: ${parts.join(", ")}, ${date === today ? "today" : date === addDaysToKey(today, -1) ? "yesterday" : dayLabel(date)}${clientName ? `, ${clientName}` : ""}`;
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
