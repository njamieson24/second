// Outreach: drafting the email. Server only. Second NEVER sends it: the owner copies it (or opens
// it in their own email app) and sends it themselves.

import type Anthropic from "@anthropic-ai/sdk";
import { healthClaim } from "./content-plan";
import { OPT_OUT_LINE } from "./outreach";

export const DRAFT_MODEL = "claude-haiku-4-5-20251001";
export const OUTREACH_DRAFT_MAX_TOKENS = 400;
export const MAX_WORDS = 120;

export const DRAFT_SYSTEM = `You write short emails from a small local business owner to another local business they'd like to work with. The owner copies the email and sends it themselves.

The email must:
- Be under 100 words in the body (a hard limit is 120), plain and friendly, like a neighbor writing to a neighbor. No marketing language, no buzzwords.
- Suggest ONE specific idea that fits both businesses (for example: a bakery and a café, day-old bread for toast; a yoga studio and a smoothie shop, a post-class deal; a massage therapist and a gym, a recovery day).
- Have one clear ask: a quick chat or a reply.
- Sign off with the owner's first name, then their business name if they have one. If they don't, sign with just their first name. Never make up a business name, and never use the kind of business ("Massage and wellness") as a name.
- End with this exact line on its own: "${OPT_OUT_LINE}"

Never:
- invent facts, numbers, prices, discounts, awards, reviews, years in business or customer counts. Only use what's given.
- pretend they've met, talked, or been in before ("great meeting you", "as we discussed", "I loved my visit").
- make health or medical claims.
- mention clients by name.
Subject: under 60 characters, specific and plain, no clickbait.`;

export const DRAFT_TOOL: Anthropic.Tool = {
  name: "save_email",
  description: "Save the email draft.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      subject: { type: "string" },
      body: { type: "string", description: "The email body, ending with the opt-out line" },
    },
    required: ["subject", "body"],
    additionalProperties: false,
  },
};

export function draftPrompt(input: {
  owner: { name: string; business: string; typeLabel: string; town: string; services: string };
  notes: string[];
  lead: { name: string; category: string; town: string | null };
  goal: string;
}): string {
  return `From: ${input.owner.name}, who runs a ${input.owner.typeLabel.toLowerCase()} business in ${input.owner.town || "town"}.
Their business name: ${input.owner.business ? input.owner.business : "none yet (sign with just their first name)"}.
Their services and prices: ${input.owner.services || "none listed"}.${
    input.notes.length ? `\nWhat you know about them (from past chats):\n${input.notes.slice(0, 12).map((n) => `- ${n}`).join("\n")}` : ""
  }
To: ${input.lead.name}, a ${input.lead.category.toLowerCase()} in ${input.lead.town || "the same area"}.
The owner's goal for this email: ${input.goal.trim() ? `"${input.goal.trim()}"` : "introduce themselves and suggest one way to work together"}.

Write the email.`;
}

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const MET = /\b(great (meeting|to meet|seeing|chatting)|nice (meeting|to meet|chatting)|as (we )?discussed|when we (met|spoke|talked)|loved (my|our) (visit|time)|our (last )?(chat|conversation|call)|following up on)\b/i;

/** Problems with a draft (the opt-out line is checked separately so it can be added in code). */
export function draftProblems(
  d: { subject: string; body: string },
  ctx: { ownerFirstName: string; business: string; allowedNumbers: Set<string>; clientNames: string[] },
): string[] {
  const problems: string[] = [];
  const all = `${d.subject}\n${d.body}`;
  if (!d.subject.trim() || d.subject.length > 80) problems.push("the subject must be 1 to 60 characters");
  if (wordCount(d.body) > MAX_WORDS) problems.push(`keep the body under ${MAX_WORDS} words (it has ${wordCount(d.body)})`);
  if (!d.body.toLowerCase().includes(ctx.ownerFirstName.toLowerCase())) problems.push(`sign off with ${ctx.ownerFirstName}`);
  if (ctx.business && !d.body.toLowerCase().includes(ctx.business.toLowerCase())) problems.push(`include the business name "${ctx.business}" in the sign-off`);
  if (MET.test(all)) problems.push("don't pretend you've met or talked before");
  const claim = healthClaim(all);
  if (claim) problems.push(`no health claims ("${claim}")`);
  const numbers = (all.replace(/\b\d{1,2}(:\d\d)?\s?(am|pm)\b/gi, "").match(/\$?\d[\d,.]*%?/g) ?? []).map((n) => n.replace(/[$,%]/g, "").replace(/\.$/, ""));
  const madeUp = numbers.filter((n) => n && !ctx.allowedNumbers.has(n));
  if (madeUp.length) problems.push(`don't use numbers that aren't in their info (${madeUp.join(", ")})`);
  const named = ctx.clientNames.flatMap((f) => f.split(/\s+/)).filter((w) => w.length > 2 && new RegExp(`\\b${w.replace(/[^\p{L}'-]/gu, "")}\\b`, "i").test(all) && w.toLowerCase() !== ctx.ownerFirstName.toLowerCase());
  if (named.length) problems.push(`no client names (${[...new Set(named)].join(", ")})`);
  return problems;
}

/** Make sure the body ends with the opt-out line (added in code if the model left it out). */
export function withOptOut(body: string): string {
  const trimmed = body.trim();
  if (trimmed.toLowerCase().includes(OPT_OUT_LINE.toLowerCase().slice(0, 30))) return trimmed;
  return `${trimmed}\n\n${OPT_OUT_LINE}`;
}
