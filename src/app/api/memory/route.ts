// The notes pass for "What Second knows". Runs on the SERVER only.
//
// Vercel has no background jobs, so the chat page asks for a pass (1) when it opens and
// (2) after every NOTES_EVERY messages. This route only calls the AI when there are new
// messages since the last pass, and never more than NOTES_DAILY_LIMIT times in 24 hours.
// Always Haiku, at most NOTES_MAX_TOKENS out. Token use is saved in memory_runs.
// Everything is read and written AS the person (row level security). Note text and
// messages are never logged.
//
// POST {}  ->  { ok, ran, changed }

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NOTES_DAILY_LIMIT } from "@/lib/chat";
import { toBusiness, type BusinessRow } from "@/lib/db-rows";
import { formatMoney } from "@/lib/money";
import { cleanNote, MAX_CHANGES, MAX_NOTES, NOTES_MAX_TOKENS, NOTES_MODEL, NOTES_SYSTEM, NOTES_TOOL } from "@/lib/notes-pass";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NEW_MESSAGES = 30;
const MESSAGE_CHARS = 1000;
// Notes come only from what the owner says. Second's replies are shortened context, so a deleted
// note can't come back just because Second repeated it.
const SECOND_CHARS = 200;

const json = (body: object, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function dailyLimit(): number {
  const n = Number.parseInt(process.env.NOTES_DAILY_LIMIT ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : NOTES_DAILY_LIMIT;
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.ANTHROPIC_API_KEY) return json({ ok: false, ran: false, changed: 0 }, 500);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, ran: false, changed: 0 }, 401);
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) return json({ ok: false, ran: false, changed: 0 }, 401);

  // ---------- Is there anything new, and are we under the daily cap? ----------
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [runsToday, lastRun] = await Promise.all([
    db.from("memory_runs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", dayAgo),
    db.from("memory_runs").select("covered_until").eq("user_id", user.id).order("covered_until", { ascending: false }).limit(1),
  ]);
  if (runsToday.error || lastRun.error) {
    console.error("memory: memory tables problem", runsToday.error?.code ?? lastRun.error?.code);
    return json({ ok: false, ran: false, changed: 0 }, 500);
  }
  if ((runsToday.count ?? 0) >= dailyLimit()) return json({ ok: true, ran: false, changed: 0, reason: "limit" });

  const since = (lastRun.data?.[0]?.covered_until as string | undefined) ?? "1970-01-01T00:00:00Z";
  const { data: fresh, error: freshError } = await db
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(NEW_MESSAGES);
  if (freshError) return json({ ok: false, ran: false, changed: 0 }, 500);
  const messages = (fresh ?? []).reverse();
  if (!messages.some((m) => m.role === "user")) return json({ ok: true, ran: false, changed: 0 });

  // ---------- What we already know ----------
  const [biz, notesRes, cardsRes] = await Promise.all([
    db.from("businesses").select("*").eq("user_id", user.id).maybeSingle(),
    db.from("business_notes").select("id, note").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(MAX_NOTES),
    db.from("chat_proposals").select("summary, status").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);
  const business = toBusiness(biz.data as BusinessRow | null);
  const notes = notesRes.data ?? [];
  const refs = new Map(notes.map((n, i) => [`N${i + 1}`, n.id as string]));

  const profile = business
    ? `Saved profile (don't save these as notes): ${business.ownerName}, ${business.businessName || "no business name"}, ${business.typeLabel}, ${business.area}. Services: ${business.services
        .map((s) => `${s.name} ${formatMoney(s.price)}`)
        .join(", ")}. Monthly pay goal ${formatMoney(business.payGoal)}.${business.openingDay ? ` Opening day ${business.openingDay}.` : ""}`
    : "Saved profile: not set up.";
  const current = notes.length ? notes.map((n, i) => `N${i + 1}: ${n.note}`).join("\n") : "(no notes yet)";
  const cardWord = { pending: "not answered yet", approved: "APPROVED (now in the profile)", ignored: "IGNORED (they did not make this change)", stale: "not applied" };
  const cards = (cardsRes.data ?? []) as { summary: string; status: keyof typeof cardWord }[];
  const cardList = cards.length ? cards.map((c) => `- ${c.summary}: ${cardWord[c.status]}`).join("\n") : "(none)";
  const serviceNames = business?.services.map((s) => s.name) ?? [];
  const transcript = messages
    .map((m) =>
      m.role === "user"
        ? `Owner: ${(m.content as string).slice(0, MESSAGE_CHARS)}`
        : `Second (context only, never save from this): ${(m.content as string).slice(0, SECOND_CHARS)}`,
    )
    .join("\n\n");

  // ---------- One small Haiku call ----------
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 25_000 });
  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: NOTES_MODEL,
      max_tokens: NOTES_MAX_TOKENS,
      system: NOTES_SYSTEM,
      tools: [NOTES_TOOL],
      tool_choice: { type: "tool", name: NOTES_TOOL.name },
      messages: [
        {
          role: "user",
          content: `${profile}\n\nSuggestion cards and what the owner did:\n${cardList}\n\nCurrent notes:\n${current}\n\n<new_messages>\n${transcript}\n</new_messages>`,
        },
      ],
    });
  } catch (error) {
    console.error("memory: notes pass failed", error instanceof Anthropic.APIError ? error.status : "network");
    return json({ ok: false, ran: false, changed: 0 }, 502);
  }

  // ---------- Check and apply the changes (as the person) ----------
  const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const raw = response.stop_reason === "max_tokens" ? [] : (((call?.input as { changes?: unknown[] })?.changes ?? []) as Record<string, unknown>[]);
  const newestUser = [...messages].reverse().find((m) => m.role === "user");
  const now = new Date().toISOString();
  let changed = 0;
  let count = notes.length;
  const seen = new Set(notes.map((n) => (n.note as string).toLowerCase()));

  for (const c of raw.slice(0, MAX_CHANGES)) {
    const id = typeof c.note_ref === "string" ? refs.get(c.note_ref) : undefined;
    if (c.action === "remove" && id) {
      const { error } = await db.from("business_notes").delete().eq("id", id);
      if (!error) {
        changed++;
        count--;
      }
      continue;
    }
    const note = cleanNote(c.text, serviceNames);
    if (!note || seen.has(note.toLowerCase())) continue;
    if (c.action === "update" && id) {
      const { error } = await db.from("business_notes").update({ note, updated_at: now }).eq("id", id);
      if (!error) changed++;
    } else if (c.action === "add" && count < MAX_NOTES) {
      const { error } = await db.from("business_notes").insert({ user_id: user.id, note, source_message_id: newestUser?.id ?? null });
      if (!error) {
        changed++;
        count++;
      }
    }
    seen.add(note.toLowerCase());
  }

  const { error: runError } = await db.from("memory_runs").insert({
    user_id: user.id,
    covered_until: messages[messages.length - 1].created_at,
    model: response.model,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    notes_changed: changed,
  });
  if (runError) console.error("memory: couldn't log the pass", runError.code);

  return json({ ok: true, ran: true, changed });
}
