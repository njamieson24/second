"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { SampleTag } from "@/components/EmptyStates";
import { Logo } from "@/components/Logo";
import { MatchMap } from "@/components/partners/MatchMap";
import { useMatchActions, useWeeklyMatches } from "@/components/partners/Matches";
import { homeFor, RequireBusiness, useAppData } from "@/lib/data";
import { categoryLabel } from "@/lib/outreach";

// Onboarding's last step: "You're set up" + 3 businesses near you worth teaming up with.
// Their picks become this week's matches, so Home reuses them. If the search fails or finds
// nothing, it goes straight to Home (no error screen).
export default function StartMatchesPage() {
  return (
    <RequireBusiness>
      <StartMatches />
    </RequireBusiness>
  );
}

function StartMatches() {
  const data = useAppData();
  const router = useRouter();
  const home = homeFor(data);
  const state = useWeeklyMatches("onboarding", 25_000);
  const actions = useMatchActions();

  useEffect(() => {
    if (state.status === "none") router.replace(home);
  }, [state.status, home, router]);

  const matches = state.status === "ready" ? state.matches.slice(0, 3) : [];
  const pins = matches.filter((m) => m.lead.lat != null && m.lead.lon != null).map((m) => ({ lat: m.lead.lat!, lon: m.lead.lon! }));
  const center =
    state.status === "ready" && state.center
      ? state.center
      : pins.length
        ? { lat: pins.reduce((s, p) => s + p.lat, 0) / pins.length, lon: pins.reduce((s, p) => s + p.lon, 0) / pins.length }
        : null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-4 py-10 text-ink desk:py-12">
      <Logo size="lg" />
      <main className="mt-8 flex w-full max-w-[640px] flex-col gap-5">
        <div>
          <h1 className="m-0 text-[30px] leading-tight font-semibold tracking-[-0.8px]">You&apos;re set up</h1>
          <p className="m-0 mt-1.5 flex flex-wrap items-center gap-2 text-[17px] text-muted">
            {state.status === "ready" && matches.length === 1 ? "A business" : `${state.status === "ready" ? matches.length : 3} businesses`} near you worth teaming up with
            {state.status === "ready" && state.sample && <SampleTag />}
          </p>
        </div>

        {state.status !== "ready" ? (
          <div role="status" className="flex flex-col gap-3">
            <p className="m-0 text-[15px] text-muted">Second is looking around your area…</p>
            <div className="aspect-[2/1] w-full animate-pulse rounded-card bg-line-soft motion-reduce:animate-none" aria-hidden="true" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-row bg-line-soft motion-reduce:animate-none" aria-hidden="true" />
            ))}
          </div>
        ) : (
          <>
            {/* Real places only: the demo's sample businesses don't get a map. */}
            {center && pins.length > 0 && !state.sample && <MatchMap center={center} pins={pins} />}
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {matches.map((m, i) => (
                <li key={m.id} className="flex gap-3 rounded-row border border-line bg-card p-3.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mint text-[15px] font-semibold text-on-green" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold break-words">{m.lead.name}</div>
                    <div className="text-sm text-muted">
                      {[categoryLabel(m.lead.category), m.lead.distanceMi != null ? `${m.lead.distanceMi} mi away` : null].filter(Boolean).join(" · ")}
                    </div>
                    <p className="m-0 mt-1 text-sm text-ink-soft">{m.why}</p>
                  </div>
                </li>
              ))}
            </ol>
            {matches[0] && actions.problem[matches[0].lead.id] && (
              <p role="status" className="m-0 text-[15px]">
                {actions.problem[matches[0].lead.id]}
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => actions.draft(matches[0].lead)} disabled={actions.busy !== null} icon={<Sparkles size={18} aria-hidden="true" />}>
                {actions.busy ? "Opening…" : "Draft my first email"}
              </Button>
              <Button href={home} variant="ghost" weight="medium">
                I&apos;ll do it later
              </Button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
