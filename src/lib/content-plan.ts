// Content page: the Haiku prompts and tools, the checks on ideas and captions, and the
// plain-code fallback ideas. Used only by src/app/api/content/route.ts.

import type Anthropic from "@anthropic-ai/sdk";
import { POST_TYPES, type PostType, type TemplateText } from "./content";
import type { ContentTone, Mode } from "./store";
import { addDaysToKey } from "./timezone";
import type { Facts } from "./week-facts";
import { inventedNames } from "./week-plan";

export const CONTENT_MODEL = "claude-haiku-4-5-20251001";
export const IDEAS_MAX_TOKENS = 600;
export const CAPTION_MAX_TOKENS = 300;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type PlannedIdea = { type: PostType; title: string; why: string; day: string };

// ---------- Ideas ----------

export const IDEAS_SYSTEM = `You are Second, a warm, plain-spoken business partner for a small local business owner. You suggest Instagram posts for this week.

Rules:
- Give exactly the number of ideas asked for. Each one is something the owner can post with a simple photo they take themselves.
- type: promo (a service or booking), tip (a useful tip from their craft), behind_the_scenes, client_love (thanks to clients in general, no names), slow_day (fill a day with nothing booked), launch_countdown (only if they're not open yet), or other.
- title: a short description of the post in sentence case, under 60 characters, like "Show your table set up for Saturday".
- why: one short line, under 120 characters, saying why this post helps this week. In at least two of them, use a real number from the facts, like "6 days this week have nothing booked" or "Your deep tissue is $110". Never make up a number.
- day: the weekday to post it, from the days listed as left this week.
- Use at least 3 different types. Don't repeat the post types used most recently, and don't repeat recent post titles.
- Never mention a client by name. Never invent prices, discounts or offers: only use the prices in the facts.
- No health or medical topics (no headaches, back pain, injuries or anxiety, and nothing "relieves" or "treats" anything). Focus on how it feels: relaxing, a reset, time for yourself.
- If they're not open yet, use launch_countdown and behind_the_scenes, never slow_day. If they're open, never launch_countdown.
- Plain English, no jargon.`;

/** The tool, with `day` limited to the days left this week (so a past day can't be picked). */
export function ideasTool(daysLeft: string[]): Anthropic.Tool {
  const tool = structuredClone(IDEAS_TOOL);
  const items = (tool.input_schema.properties as { ideas: { items: { properties: { day: { enum: string[] } } } } }).ideas.items;
  items.properties.day.enum = daysLeft;
  return tool;
}

export const IDEAS_TOOL: Anthropic.Tool = {
  name: "save_post_ideas",
  description: "Save this week's post ideas.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      ideas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...POST_TYPES] },
            title: { type: "string" },
            why: { type: "string" },
            day: { type: "string", enum: WEEKDAYS },
          },
          required: ["type", "title", "why", "day"],
          additionalProperties: false,
        },
      },
    },
    required: ["ideas"],
    additionalProperties: false,
  },
};

/** The week's facts for content: the same as This Week, minus any client names. */
export function contentFacts(facts: Facts, recentTypes: string[], recentTitles: string[], postedLastWeek: number, daysLeft: string[]): string {
  const lines = facts.text
    .split("\n")
    .filter((l) => !/^Clients who haven't been back|^No clients to text|^Do NOT suggest texting|^Last week's plan/.test(l))
    // drop the bullet list that follows "Last week's plan"
    .filter((l, i, all) => !(l.startsWith("- ") && all.slice(0, i).reverse().find((x) => !x.startsWith("- "))?.startsWith("Last week's plan")));
  lines.push(`Days left this week to post: ${daysLeft.join(", ")}.`);
  lines.push(recentTypes.length ? `Post types used in the last three weeks (most recent first): ${recentTypes.join(", ")}.` : "No posts planned in the last three weeks.");
  if (recentTitles.length) lines.push(`Recent post titles (don't repeat): ${recentTitles.slice(0, 12).map((t) => `"${t}"`).join(", ")}.`);
  lines.push(`Posts they marked as posted last week: ${postedLastWeek}.`);
  return lines.join("\n");
}

const norm = (n: string) => n.replace(/[,$]/g, "");
const sameText = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === b.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function checkIdeas(
  raw: unknown,
  want: number,
  facts: Facts,
  mode: Mode,
  daysLeft: string[],
  recentTitles: string[],
): { ok: true; ideas: PlannedIdea[] } | { ok: false; problems: string[] } {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list) || list.length !== want) return { ok: false, problems: [`return exactly ${want} ideas`] };
  const problems: string[] = [];
  const ideas: PlannedIdea[] = [];
  const seen = new Set<string>();
  let withNumbers = 0;
  list.forEach((x: Record<string, unknown>, i) => {
    const n = i + 1;
    const type = x.type as PostType;
    const title = typeof x.title === "string" ? x.title.trim() : "";
    const why = typeof x.why === "string" ? x.why.trim() : "";
    const day = typeof x.day === "string" ? x.day : "";
    if (!POST_TYPES.includes(type)) problems.push(`idea ${n}: unknown type`);
    if (title.length < 3 || title.length > 70) problems.push(`idea ${n}: title must be 3 to 70 characters`);
    if (why.length < 8 || why.length > 140) problems.push(`idea ${n}: why must be under 140 characters`);
    if (/[\u0000-\u001f]/.test(title + why)) problems.push(`idea ${n}: remove odd characters`);
    if (!daysLeft.includes(day)) problems.push(`idea ${n}: day must be one of ${daysLeft.join(", ")}`);
    const found = why.match(/\$?\d[\d,]*(\.\d+)?/g) ?? [];
    if (found.some((v) => facts.numbers.has(norm(v)))) withNumbers++;
    const madeUp = found.filter((v) => !facts.numbers.has(norm(v)) && (v.startsWith("$") || Number(norm(v)) > 60));
    if (madeUp.length) problems.push(`idea ${n}: ${madeUp.join(", ")} isn't in the facts`);
    if (mode === "running" && type === "launch_countdown") problems.push(`idea ${n}: they're open, so no launch_countdown`);
    if (mode === "launch" && type === "slow_day") problems.push(`idea ${n}: not open yet, so no slow_day`);
    if (seen.has(title.toLowerCase()) || recentTitles.some((t) => sameText(t, title))) problems.push(`idea ${n}: repeats a recent title`);
    seen.add(title.toLowerCase());
    const claim = healthClaim(`${title}. ${why}`);
    if (claim) problems.push(`idea ${n}: no health or medical topics ("${claim}"); focus on how it feels`);
    const names = inventedNames(`${title}. ${why}`, facts.ownerText);
    if (names.length) problems.push(`idea ${n}: don't name ${names.join(", ")}`);
    ideas.push({ type, title, why, day });
  });
  if (new Set(ideas.map((i) => i.type)).size < Math.min(3, want)) problems.push("use at least 3 different types");
  if (withNumbers < Math.min(2, want)) problems.push("use a real number from the facts in at least two why lines");
  return problems.length ? { ok: false, problems } : { ok: true, ideas };
}

/** Ideas made by plain code: used when the AI isn't used (tries used up) or doesn't pass the checks. */
export function fallbackIdeas(facts: Facts, mode: Mode, want: number, daysLeft: string[], mainService: { name: string; price: number } | null): PlannedIdea[] {
  const day = (i: number) => daysLeft[Math.min(i, daysLeft.length - 1)] ?? "Saturday";
  const price = mainService ? `$${mainService.price}` : "";
  const out: PlannedIdea[] =
    mode === "launch" && facts.launch
      ? [
          { type: "launch_countdown", title: "Count down to opening day", why: facts.launch.daysToOpening !== null ? `${facts.launch.daysToOpening} days until you open` : `${facts.launch.done} of ${facts.launch.total} steps done`, day: day(0) },
          { type: "behind_the_scenes", title: "Show your space getting ready", why: `${facts.launch.done} of ${facts.launch.total} launch steps done so far`, day: day(1) },
          { type: "tip", title: "Share one simple tip from your craft", why: `A tip builds trust before you open in ${facts.launch.daysToOpening ?? 30} days`, day: day(2) },
          { type: "promo", title: mainService ? `Introduce your ${mainService.name}` : "Introduce your main service", why: mainService ? `Your main service is ${price}` : `${facts.launch.done} steps done`, day: day(3) },
          { type: "other", title: "Tell people why you started", why: `${facts.launch.daysToOpening ?? 30} days to go: let people get to know you`, day: day(4) },
        ]
      : [
          { type: "promo", title: mainService ? `Remind people about your ${mainService.name}` : "Remind people what you offer", why: mainService ? `Your ${mainService.name} is ${price}` : `${facts.freeDays} days have nothing booked`, day: day(0) },
          { type: "slow_day", title: "Post your open spots this week", why: `${facts.freeDays} days in the next week have nothing booked`, day: day(1) },
          { type: "tip", title: "Share one simple tip from your craft", why: `${facts.freeDays} quiet days ahead: a tip keeps you in mind`, day: day(2) },
          { type: "behind_the_scenes", title: "Show your space before a client arrives", why: `${facts.freeDays} open days to fill this week`, day: day(3) },
          { type: "client_love", title: "Thank your clients this week", why: `${facts.freeDays} days to fill: a thank-you brings people back`, day: day(4) },
        ];
  return out.slice(0, want);
}

/** The weekdays from today to Sunday, and their dates. */
export function daysLeftInWeek(weekStart: string, today: string): { names: string[]; dateOf: (name: string) => string } {
  const names = WEEKDAYS.filter((_, i) => addDaysToKey(weekStart, i) >= today);
  return { names: names.length ? names : ["Sunday"], dateOf: (name) => addDaysToKey(weekStart, Math.max(0, WEEKDAYS.indexOf(name))) };
}

// ---------- Captions ----------

const TONES: Record<ContentTone, string> = {
  warm: "Warm and friendly, like talking to a neighbor. Personal and kind. One emoji at most.",
  fun: "Playful and upbeat, with a little humor. A couple of emojis are fine.",
  professional: "Polished, calm and confident. Clear and to the point. No emojis.",
};

export const CAPTION_TOOL: Anthropic.Tool = {
  name: "save_caption",
  description: "Save the Instagram caption and the short text for the post image.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      caption: { type: "string", description: "The caption, ending with 5 to 8 hashtags" },
      headline: { type: "string", description: "Big text on the image, under 40 characters" },
      line: { type: "string", description: "One supporting line on the image, under 90 characters" },
    },
    required: ["caption", "headline", "line"],
    additionalProperties: false,
  },
};

export function captionPrompt(input: {
  idea: { type: PostType; title: string; why: string };
  tone: ContentTone;
  business: { ownerName: string; businessName: string; typeLabel: string; area: string; services: string };
  ownerWords: string;
  notes: string[];
  localTags: string[];
  openingDay: string | null;
}): { system: string; user: string } {
  const system = `You write Instagram captions for a small local business owner. Tone: ${TONES[input.tone]}

Rules (these are checked):
- Under 120 words, then 5 to 8 hashtags on the last line. Include at least one local hashtag: ${input.localTags.map((t) => `#${t}`).join(" or ")}.
- Write prices with a dollar sign and digits, exactly as listed (like $110). Never invent a price, discount, deal, free offer or gift: only mention an offer if the owner typed it in "Owner's own words".
- Never use a client's name unless it's in "Owner's own words".
- No health or medical claims. Don't say a service cures, treats, heals or relieves pain or any condition, and don't name conditions (like anxiety, back pain, arthritis, injuries). Talk about how it feels instead: relaxing, calming, a reset, time for yourself.
- Never say it was posted or sent: the owner posts it themselves.
- Plain English. No markdown.`;
  const user = `The owner: ${input.business.ownerName}${input.business.businessName ? ` of ${input.business.businessName}` : ""}, ${input.business.typeLabel} in ${input.business.area || "their town"}.
Services and prices: ${input.business.services || "none listed"}.${input.openingDay ? `\nOpening day: ${input.openingDay}.` : ""}${
    input.notes.length ? `\nNotes from past chats:\n${input.notes.slice(0, 10).map((n) => `- ${n}`).join("\n")}` : ""
  }
The post idea (${input.idea.type.replace(/_/g, " ")}): "${input.idea.title}" (because: ${input.idea.why}).
Owner's own words: ${input.ownerWords.trim() ? `"${input.ownerWords.trim()}"` : "(none)"}

Write the caption, plus a short headline and one line for the post image.`;
  return { system, user };
}

// Health and medical claims. "Treat yourself" and "a little treat" are fine and removed first.
const HEALTH = [
  /\b(cure[sd]?|curing|heal(s|ed|ing)?|diagnos\w*|prescri\w*|medical(ly)?|clinically|therapeutic benefits?)\b/i,
  /\b(treats|treated|treating|treatment for)\b/i,
  /\b(relie\w*|eas(e|es|ing)|reduc\w*|end\w*|fix\w*|eliminat\w*|get rid of|say goodbye to|goodbye to|no more|banish\w*|erase\w*)\s+(\w+\s){0,2}(pain|aches?|anxiety|depression|stress disorders?|migraines?|headaches?|injur\w*|inflammation|arthritis|sciatica|insomnia)\b/i,
  /\b(anxiety|depression|arthritis|fibromyalgia|sciatica|insomnia|migraines?|headaches?|chronic pain|back pain|neck pain|injur(y|ies)|ptsd|cancer|diabetes|blood pressure|inflammation|detox\w*|immun\w*)\b/i,
];
/** The first health or medical claim in `text`, or null. "Treat yourself" and "a little treat" are fine. */
export function healthClaim(text: string): string | null {
  const cleaned = text.replace(/\btreat (yourself|your ?self|someone|them|her|him)\b|\ba (little |small |real |sweet )?treat\b|\btreat of\b/gi, "");
  return HEALTH.map((re) => cleaned.match(re)?.[0]).find(Boolean) ?? null;
}

const OFFER = /\b(for free|free (session|massage|facial|consult\w*|class|add-?ons?|gifts?|minutes?|upgrade|trial|cut|shoot)|complimentary|discount\w*|\d+\s?% off|% off|half[- ]price|bogo|buy one|giveaway|coupon|promo code|on the house|special price|limited[- ]time offer)\b/i;

export function checkCaption(
  out: { caption: string; headline: string; line: string },
  ctx: { servicePrices: number[]; ownerWords: string; clientNames: string[]; localTags: string[] },
): string[] {
  const problems: string[] = [];
  const all = `${out.caption}\n${out.headline}\n${out.line}`;
  const owner = ctx.ownerWords.toLowerCase();
  if (!out.caption.trim()) problems.push("the caption is empty");
  if (out.headline.length > 60) problems.push("the headline must be under 40 characters");
  if (out.line.length > 120) problems.push("the line must be under 90 characters");

  // Prices: every $ amount must be a saved price or something the owner typed.
  const allowed = new Set([...ctx.servicePrices.map((p) => String(p)), ...(owner.match(/\d[\d,]*(\.\d+)?/g) ?? []).map(norm)]);
  const amounts = (all.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? []).map((a) => norm(a.replace(/\s/g, "")));
  const madeUp = amounts.filter((a) => !allowed.has(a) && !allowed.has(String(Number(a))));
  if (madeUp.length) problems.push(`$${madeUp.join(", $")} isn't one of their prices; use only their real prices`);
  if (/\b(dollars?|bucks)\b/i.test(all)) problems.push("write prices with a $ and digits, like $110");
  const percents = all.match(/\d+\s?%/g) ?? [];
  if (percents.some((p) => !owner.includes(p.replace(/\s/g, "")))) problems.push("don't invent a percentage or discount");
  const offer = all.match(OFFER)?.[0];
  if (offer && !owner.includes(offer.toLowerCase())) problems.push(`"${offer}" sounds like an offer the owner didn't make; remove it`);

  // Client names
  const named = ctx.clientNames.flatMap((full) => full.split(/\s+/)).filter((w) => w.length > 1 && new RegExp(`\\b${w.replace(/[^\p{L}'-]/gu, "")}\\b`, "i").test(all) && !owner.includes(w.toLowerCase()));
  if (named.length) problems.push(`don't use client names (${[...new Set(named)].join(", ")})`);

  // Health claims
  const claim = healthClaim(all);
  if (claim) problems.push(`no health or medical claims ("${claim}"); describe how it feels instead`);

  // Hashtags
  const tags = out.caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (tags.length < 5 || tags.length > 8) problems.push("use 5 to 8 hashtags");
  if (ctx.localTags.length && !tags.some((t) => ctx.localTags.some((l) => t.toLowerCase().includes(l.toLowerCase()))))
    problems.push(`include a local hashtag like #${ctx.localTags[0]}`);
  return problems;
}

/** Local hashtag stems from their town, like "Asbury Park, NJ" -> ["AsburyPark", "AsburyParkNJ"]. */
export function localTags(area: string): string[] {
  const parts = area.split(",").map((p) => p.trim()).filter(Boolean);
  const town = (parts[0] ?? "").replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  if (!town) return [];
  const state = (parts[1] ?? "").replace(/[^\p{L}]/gu, "").toUpperCase();
  return state.length === 2 ? [town, `${town}${state}`] : [town];
}

/** Template text filled by plain code (always real numbers), plus Second's headline and line. */
export function templateTextFor(
  base: { headline: string; line: string },
  data: { price: string | null; days: string | null; countdown: string | null },
): TemplateText {
  return {
    headline: base.headline.slice(0, 60),
    line: base.line.slice(0, 120),
    ...(data.price ? { price: data.price } : {}),
    ...(data.days ? { days: data.days } : {}),
    ...(data.countdown ? { countdown: data.countdown } : {}),
  };
}
