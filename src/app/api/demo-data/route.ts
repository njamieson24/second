// "Load demo data" for screenshots and videos. Runs on the SERVER only.
//
// Who may use it is set by DEMO_DATA_EMAILS (server-only, comma-separated emails).
// That list never reaches the browser. The request must carry the person's own
// login token, and every database write is made AS that person with the public
// key, so row level security limits it to their own rows. No secret key is used.
//
// POST { action: "check" }  -> { allowed: boolean }
// POST { action: "load" }   -> fills the account with Maria's sample business
// POST { action: "remove" } -> empties the account (business data only; the login stays)

import { createClient } from "@supabase/supabase-js";
import { buildDemoAccount } from "@/lib/demo-content";
import { businessProfileRow, DATA_TABLES, eventRow, moneyPlanRow, transactionRow } from "@/lib/db-rows";

export const dynamic = "force-dynamic";

function allowedEmails(): string[] {
  return (process.env.DEMO_DATA_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function fail(status: number, message: string) {
  return Response.json({ ok: false, message }, { status });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return fail(500, "Supabase isn't set up on the server.");

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "Please log in first.");

  // A database connection that acts as this person.
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return fail(401, "Please log in again.");

  const allowed = allowedEmails().includes((user.email ?? "").toLowerCase());
  const body = (await request.json().catch(() => ({}))) as { action?: string; timeZone?: string };

  if (body.action === "check") return Response.json({ ok: true, allowed });
  if (!allowed) return fail(403, "Demo data isn't turned on for this account.");

  const clear = async () => {
    for (const table of DATA_TABLES) {
      const { error } = await db.from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    }
  };

  try {
    if (body.action === "remove") {
      await clear();
      return Response.json({ ok: true });
    }

    if (body.action === "load") {
      // The server runs in UTC, so place the sample appointments in the person's own zone.
      const demo = buildDemoAccount(new Date(), body.timeZone);
      await clear();
      const results = await Promise.all([
        db.from("businesses").insert({
          ...businessProfileRow(user.id, demo.business),
          mode: demo.mode,
          show_samples: true,
        }),
        db.from("money_plans").insert(moneyPlanRow(user.id, demo.moneyPlan)),
        db.from("roadmap_tasks").insert(demo.completedTasks.map((task_id) => ({ user_id: user.id, task_id }))),
        db.from("transactions").insert(demo.transactions.map((t) => transactionRow(user.id, t))),
        db.from("events").insert(demo.events.map((e) => eventRow(user.id, e))),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      return Response.json({ ok: true });
    }

    return fail(400, "Unknown action.");
  } catch (error) {
    console.error("Demo data failed:", error);
    const missingColumn = String((error as { message?: string })?.message ?? "").includes("show_samples");
    return fail(
      500,
      missingColumn
        ? "The database needs one more column. Run supabase/add-sample-content.sql in the Supabase SQL Editor."
        : "Something went wrong loading the demo data. Please try again.",
    );
  }
}
