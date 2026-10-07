// Beta sign-ups from the public /beta page. Runs on the SERVER.
//
// Saves with the public key as an anonymous visitor. Row level security only lets
// anonymous visitors ADD rows (supabase/beta.sql), so this route can't read the list
// either: no .select() after the insert, and no upsert. No secret key is used.
//
// POST { name, email, businessName, businessType, town, stage, website }
//   -> { ok: true } or { ok: false, message, problems? }
// "website" is a hidden honeypot field that only bots fill in.

import { createClient } from "@supabase/supabase-js";
import { checkBetaSignup, type BetaSignup } from "@/lib/beta";

export const dynamic = "force-dynamic";

const MAX_BODY = 5000; // characters; a real sign-up is a few hundred

function fail(status: number, message: string, problems?: object) {
  return Response.json({ ok: false, message, problems }, { status });
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail(500, "Sign-ups aren't set up yet. Please try again later.");

  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, "That's more than we expected. Please shorten your answers.");
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Something went wrong. Please try again.");
  }

  // A bot filled in the hidden field. Say thanks, save nothing.
  if (text(body.website).trim()) return Response.json({ ok: true });

  const signup: BetaSignup = {
    name: text(body.name),
    email: text(body.email),
    businessName: text(body.businessName),
    businessType: text(body.businessType) as BetaSignup["businessType"],
    town: text(body.town),
    stage: text(body.stage) as BetaSignup["stage"],
  };
  const problems = checkBetaSignup(signup);
  if (Object.keys(problems).length > 0) return fail(400, "Please check the highlighted answers.", problems);

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.from("beta_signups").insert({
    name: signup.name.trim(),
    email: signup.email.trim().toLowerCase(),
    business_name: signup.businessName.trim() || null,
    business_type: signup.businessType,
    town: signup.town.trim(),
    stage: signup.stage,
  });

  // 23505 = this email is already on the list. That's fine: show the thank-you again.
  if (error && error.code !== "23505") {
    console.error("beta sign-up failed:", error.code, error.message);
    return fail(500, "We couldn't save that just now. Please try again in a minute.");
  }
  return Response.json({ ok: true });
}
