// Content page: the Haiku prompts and tools, the checks on briefs and captions, and the
// plain-code fallback briefs. Used only by src/app/api/content/route.ts.
//
// Each idea is a short creative brief: what to post, format, 2 or 3 phone shots, a hook, best day.

import type Anthropic from "@anthropic-ai/sdk";
import { HOOK_MAX_CHARS, POST_FORMATS, POST_TYPES, SHOT_MAX_CHARS, type PostFormat, type PostType } from "./content";
import type { ContentTone, Mode } from "./store";
import { addDaysToKey } from "./timezone";
import type { Facts } from "./week-facts";
import { inventedNames } from "./week-plan";

export const CONTENT_MODEL = "claude-haiku-4-5-20251001";
/** 5 briefs (what, why, format, 2-3 shots, hook) fit comfortably; was 600 before briefs. */
export const IDEAS_MAX_TOKENS = 1200;
export const CAPTION_MAX_TOKENS = 300;

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type Brief = { format: PostFormat; shots: string[]; hook: string };
export type PlannedIdea = { type: PostType; title: string; why: string; day: string } & Brief;

// ---------- Ideas (briefs) ----------

export const IDEAS_SYSTEM = `You are Second, a warm, plain-spoken business partner for a small local business owner. You plan this week's Instagram posts as short creative briefs they can shoot themselves.

Each idea:
- type: promo (a service or booking), tip (a useful tip from their craft), behind_the_scenes, client_love (thanks to clients in general, no names), slow_day (fill a day with nothing booked), launch_countdown (only if they're not open yet), or other.
- title: what to post, in sentence case, under 60 characters, like "Show your table set up for Saturday".
- why: one short line, under 120 characters, saying why this post helps this week. In at least two of them, use a real number from the facts, like "6 days this week have nothing booked" or "Your deep tissue is $110". Never make up a number.
- day: the weekday to post it, from the days listed as left this week.
- format: photo, carousel (2 to 5 photos), or reel (a short video under 15 seconds).
- shots: 2 or 3 simple shots, each one plain sentence under 100 characters, like "Close-up of your oils on the table". Each one takes under a minute on their own phone.
- hook: the first line of the caption, or for a reel the words on screen in the first 3 seconds. Under 100 characters. Make people want to stop scrolling.

Rules:
- Exactly the number of ideas asked for. At least 3 different types. Mix formats. Don't repeat recent types or titles.
- Phone only, one person: no tripod, ring light, gimbal, drone, studio lights or fancy camera, and nobody else filming or holding the phone. For hands-free shots, say to prop the phone on a shelf or a stack of books.
- Shots show only the owner, their hands, their space, tools and products. Never a client or anyone else, not even their back, hands or feet (they'd need a second person and the client's permission).
- Never mention a client by name. Never invent prices, discounts, free offers or deals: only use the prices in the facts.
- No health or medical topics (no headaches, back pain, injuries or anxiety, and nothing "relieves", "heals" or "treats" anything). Focus on how it feels: relaxing, a reset, time for yourself.
- If they're not open yet, use launch_countdown and behind_the_scenes, never slow_day. If they're open, never launch_countdown.
- Plain English, no jargon.`;

export const IDEAS_TOOL: Anthropic.Tool = {
  name: "save_post_ideas",
  description: "Save this week's post briefs.",
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
            format: { type: "string", enum: [...POST_FORMATS] },
            shots: { type: "array", items: { type: "string" } },
            hook: { type: "string" },
          },
          required: ["type", "title", "why", "day", "format", "shots", "hook"],
          additionalProperties: false,
        },
      },
    },
    required: ["ideas"],
    additionalProperties: false,
  },
};

/** The tool, with `day` limited to the days left this week (so a past day can't be picked). */
export function ideasTool(daysLeft: string[]): Anthropic.Tool {
  const tool = structuredClone(IDEAS_TOOL);
  const items = (tool.input_schema.properties as { ideas: { items: { properties: { day: { enum: string[] } } } } }).ideas.items;
  items.properties.day.enum = daysLeft;
  return tool;
}

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

// ---------- Shared checks (briefs, hooks, captions) ----------

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

// Phone only, one person.
const EQUIPMENT = /\b(tripods?|ring ?lights?|gimbals?|drones?|studio lights?|softbox\w*|light stands?|dslr|mirrorless|professional camera|external mic\w*|lav(alier)? mic\w*|green ?screen|teleprompter|selfie stick)\b/i;
const SECOND_PERSON =
  /\b(have|ask|get|let)\s+(a |your |another |an? )?(friend|partner|client|someone|somebody|helper|assistant|co-?worker|spouse|husband|wife|kid|model|person|photographer)\b|\b(someone|somebody|another person|a second person|a helper|an assistant|a photographer|a model)\s+(else\s+)?(to\s+)?(films?|filming|records?|recording|shoots?|holds?|holding|takes?|taking)\b|\b(a|your|the) (client|customer|model|friend)('s|’s)? (lying|on the|getting|receiving|relaxing|smiling|face|shoulders?|back|hands?|feet|hair|reaction)\b/i;

export type TextRules = { servicePrices: number[]; clientNames: string[]; ownerText: string };

/** Health, price, offer and name problems in owner-facing text (a brief or a hook). */
export function textProblems(text: string, rules: TextRules): string[] {
  const problems: string[] = [];
  const claim = healthClaim(text);
  if (claim) problems.push(`no health or medical claims ("${claim}")`);
  const prices = new Set(rules.servicePrices.map((p) => String(p)));
  const madeUp = (text.match(/\$\s?\d[\d,]*(\.\d+)?/g) ?? []).map((a) => norm(a.replace(/\s/g, ""))).filter((a) => !prices.has(a) && !prices.has(String(Number(a))));
  if (madeUp.length) problems.push(`$${madeUp.join(", $")} isn't one of their prices`);
  if (/\b(dollars?|bucks)\b/i.test(text)) problems.push("write prices with a $ and digits, like $110");
  if (/\d+\s?%/.test(text)) problems.push("no percentages or discounts");
  const offer = text.match(OFFER)?.[0];
  if (offer) problems.push(`"${offer}" sounds like an offer that isn't in their data`);
  const named = rules.clientNames
    .flatMap((full) => full.split(/\s+/))
    .filter((w) => w.length > 1 && new RegExp(`\\b${w.replace(/[^\p{L}'-]/gu, "")}\\b`, "i").test(text));
  if (named.length) problems.push(`no client names (${[...new Set(named)].join(", ")})`);
  return problems;
}

/** Problems with a hook (also used when the owner edits it). */
export function hookProblems(hook: string, rules: TextRules): string[] {
  const problems: string[] = [];
  if (!hook.trim()) problems.push("the hook is empty");
  if (hook.length > HOOK_MAX_CHARS) problems.push(`keep the hook under ${HOOK_MAX_CHARS} characters`);
  if (/[\u0000-\u001f]/.test(hook)) problems.push("the hook must be one line");
  if (/#\w/.test(hook)) problems.push("no hashtags in the hook");
  return [...problems, ...textProblems(hook, rules)];
}

/** Problems with the shots (phone only, one person, short and plain). */
export function shotProblems(shots: unknown, rules: TextRules): string[] {
  if (!Array.isArray(shots) || shots.length < 2 || shots.length > 3) return ["give 2 or 3 shots"];
  const problems: string[] = [];
  shots.forEach((s, i) => {
    const shot = typeof s === "string" ? s.trim() : "";
    if (shot.length < 5 || shot.length > SHOT_MAX_CHARS) problems.push(`shot ${i + 1} must be under ${SHOT_MAX_CHARS} characters`);
    const gear = shot.match(EQUIPMENT)?.[0];
    if (gear) problems.push(`shot ${i + 1}: phone only, no ${gear}`);
    if (SECOND_PERSON.test(shot)) problems.push(`shot ${i + 1}: the owner films it alone, with no clients or other people in it`);
    textProblems(shot, rules).forEach((p) => problems.push(`shot ${i + 1}: ${p}`));
  });
  return problems;
}

export function checkIdeas(
  raw: unknown,
  want: number,
  facts: Facts,
  mode: Mode,
  daysLeft: string[],
  recentTitles: string[],
  rules: TextRules,
): { ok: true; ideas: PlannedIdea[] } | { ok: false; problems: string[]; ideas?: PlannedIdea[]; bad?: Set<number> } {
  const list = (raw as { ideas?: unknown })?.ideas;
  if (!Array.isArray(list) || list.length !== want) return { ok: false, problems: [`return exactly ${want} ideas`] };
  const bad = new Set<number>();
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
    const format = x.format as PostFormat;
    const hook = typeof x.hook === "string" ? x.hook.trim() : "";
    const shots = Array.isArray(x.shots) ? x.shots.map((s) => (typeof s === "string" ? s.trim() : "")) : [];
    if (!POST_TYPES.includes(type)) problems.push(`idea ${n}: unknown type`);
    if (!POST_FORMATS.includes(format)) problems.push(`idea ${n}: format must be photo, carousel or reel`);
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
    textProblems(title, rules).forEach((p) => problems.push(`idea ${n} title: ${p}`));
    const claim = healthClaim(why);
    if (claim) problems.push(`idea ${n}: no health or medical topics ("${claim}"); focus on how it feels`);
    const names = inventedNames(`${title}. ${why}. ${hook}. ${shots.join(". ")}`, facts.ownerText);
    if (names.length) problems.push(`idea ${n}: don't name ${names.join(", ")}`);
    hookProblems(hook, rules).forEach((p) => problems.push(`idea ${n} hook: ${p}`));
    shotProblems(shots, rules).forEach((p) => problems.push(`idea ${n}: ${p}`));
    if (problems.some((p) => p.startsWith(`idea ${n}:`) || p.startsWith(`idea ${n} `))) bad.add(i);
    ideas.push({ type, title, why, day, format, shots, hook });
  });
  if (new Set(ideas.map((i) => i.type)).size < Math.min(3, want)) problems.push("use at least 3 different types");
  if (withNumbers < Math.min(2, want)) problems.push("use a real number from the facts in at least two why lines");
  return problems.length ? { ok: false, problems, ideas, bad } : { ok: true, ideas };
}

/**
 * After the retry: keep the AI briefs that pass, and swap only the ones that still fail for a
 * ready-made brief of the same type (from real data). Null if fewer than 3 AI briefs pass.
 */
export function keepGoodIdeas(ideas: PlannedIdea[], bad: Set<number>, fallback: PlannedIdea[], mode: Mode): PlannedIdea[] | null {
  if (ideas.length - bad.size < 3) return null;
  return ideas.map((idea, i) => {
    if (!bad.has(i)) return idea;
    const okType = mode === "launch" ? idea.type !== "slow_day" : idea.type !== "launch_countdown";
    const same = fallback.find((f) => f.type === idea.type && okType) ?? fallback[i % fallback.length];
    return { ...same, day: idea.day };
  });
}

/** A ready-made brief for a type, built from real data. Used by fallback ideas and the This Week idea. */
export function briefFor(
  type: PostType,
  data: { service: { name: string; price: number; minutes?: number } | null; freeDayNames: string[]; daysToOpening: number | null },
): Brief {
  const s = data.service;
  const days = data.freeDayNames.slice(0, 3).join(", ");
  switch (type) {
    case "promo":
      return {
        format: "photo",
        shots: ["Close-up of your space set up and ready for the day", `Your hands getting things ready for a ${s?.name.toLowerCase() ?? "session"}`],
        hook: s ? `${s.name}: $${s.price}${s.minutes ? ` for ${s.minutes} minutes` : ""}. Here's what that hour feels like.` : "Here's what an hour with me feels like.",
      };
    case "slow_day":
      return {
        format: "reel",
        shots: ["Wide shot of your space, ready and waiting", "Slow pan across your booking calendar on your screen", "You waving at the camera, phone propped on a shelf"],
        hook: days ? `I have open spots this week: ${days}.` : "I have a few open spots this week.",
      };
    case "tip":
      return {
        format: "reel",
        shots: ["You facing the camera, phone propped at eye level on a stack of books", "Close-up of your hands showing the tip"],
        hook: "One simple thing you can try today.",
      };
    case "behind_the_scenes":
      return {
        format: "carousel",
        shots: ["Your space before anyone arrives", "Close-up of your tools laid out neatly", "Your coffee and your list for the day"],
        hook: "Here's what happens before you walk in.",
      };
    case "client_love":
      return {
        format: "photo",
        shots: ["A handwritten thank-you note on your table", "Your space in warm light at the end of the day"],
        hook: "Thank you for trusting me with your time.",
      };
    case "launch_countdown":
      return {
        format: "photo",
        shots: ["Your space mid-setup, boxes and all", "Close-up of a calendar with opening day circled"],
        hook: data.daysToOpening !== null && data.daysToOpening >= 0 ? `${data.daysToOpening} days until we open.` : "Opening soon. Here's a peek.",
      };
    default:
      return {
        format: "photo",
        shots: ["You in your space, phone propped on a shelf", "Close-up of the part of your work you love most"],
        hook: "Why I started this.",
      };
  }
}

/** Briefs made by plain code: used when the AI isn't used (tries used up) or doesn't pass the checks. */
export function fallbackIdeas(
  facts: Facts,
  mode: Mode,
  want: number,
  daysLeft: string[],
  mainService: { name: string; price: number; minutes?: number } | null,
): PlannedIdea[] {
  const day = (i: number) => daysLeft[Math.min(i, daysLeft.length - 1)] ?? "Saturday";
  const data = { service: mainService, freeDayNames: facts.freeDayNames, daysToOpening: facts.launch?.daysToOpening ?? null };
  const price = mainService ? `$${mainService.price}` : "";
  const base: Omit<PlannedIdea, "format" | "shots" | "hook">[] =
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
  return base.slice(0, want).map((idea) => ({ ...idea, ...briefFor(idea.type, data) }));
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
  description: "Save the Instagram caption.",
  strict: true,
  input_schema: {
    type: "object",
    properties: { caption: { type: "string", description: "The caption after the hook, ending with 5 to 8 hashtags" } },
    required: ["caption"],
    additionalProperties: false,
  },
};

export function captionPrompt(input: {
  idea: { type: PostType; title: string; why: string; format: PostFormat | null; hook: string | null };
  tone: ContentTone;
  business: { ownerName: string; businessName: string; typeLabel: string; area: string; services: string };
  notes: string[];
  localTags: string[];
  openingDay: string | null;
}): { system: string; user: string } {
  const system = `You write Instagram captions for a small local business owner. Tone: ${TONES[input.tone]}

Rules (these are checked):
- The post starts with a hook the owner already has. Write what comes right AFTER it. Don't repeat the hook.
- Under 120 words, then 5 to 8 hashtags on the last line. Include at least one local hashtag: ${input.localTags.map((t) => `#${t}`).join(" or ")}.
- Write prices with a dollar sign and digits, exactly as listed (like $110). Never invent a price, discount, deal, free offer or gift.
- Never use a client's name.
- No health or medical claims. Don't say a service cures, treats, heals or relieves pain or any condition, and don't name conditions (like anxiety, back pain, arthritis, injuries). Talk about how it feels instead: relaxing, calming, a reset, time for yourself.
- Never say it was posted or sent: the owner posts it themselves.
- Plain English. No markdown.`;
  const user = `The owner: ${input.business.ownerName}${input.business.businessName ? ` of ${input.business.businessName}` : ""}, ${input.business.typeLabel} in ${input.business.area || "their town"}.
Services and prices: ${input.business.services || "none listed"}.${input.openingDay ? `\nOpening day: ${input.openingDay}.` : ""}${
    input.notes.length ? `\nNotes from past chats:\n${input.notes.slice(0, 10).map((n) => `- ${n}`).join("\n")}` : ""
  }
The post (${input.idea.type.replace(/_/g, " ")}${input.idea.format ? `, ${input.idea.format}` : ""}): "${input.idea.title}" (because: ${input.idea.why}).
Hook (already the first line, don't repeat it): ${input.idea.hook ? `"${input.idea.hook}"` : "(none)"}

Write the caption.`;
  return { system, user };
}

export function checkCaption(caption: string, ctx: { servicePrices: number[]; clientNames: string[]; localTags: string[]; hook: string | null }): string[] {
  const problems: string[] = [];
  if (!caption.trim()) problems.push("the caption is empty");
  if (ctx.hook && caption.trim().toLowerCase().startsWith(ctx.hook.trim().toLowerCase().slice(0, 40))) problems.push("don't repeat the hook at the start");
  problems.push(...textProblems(caption, { servicePrices: ctx.servicePrices, clientNames: ctx.clientNames, ownerText: "" }));
  const tags = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
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
