"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Bookmark, Check, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/Button";
import { SampleTag } from "@/components/EmptyStates";
import { StatTile } from "@/components/StatTile";
import type { Match } from "@/lib/matches";
import { formatMoney } from "@/lib/money";
import { categoryLabel, type Lead } from "@/lib/outreach";
import { getWeeklyMatches, saveLeadToOutreach, type Transaction } from "@/lib/store";

export const FIND_MORE_HREF = `/chat?ask=${encodeURIComponent("Find me local businesses I could team up with")}`;

export type MatchesState =
  | { status: "loading" }
  | { status: "ready"; matches: Match[]; center: { lat: number; lon: number } | null; stale: boolean; sample: boolean }
  | { status: "none" };

/**
 * This week's matches. Never blocks the page: it starts as "loading" (show a skeleton) and the
 * server does the map search + 1 Haiku call at most once a week. If that fails, the server hands
 * back the last saved matches, or nothing (then show a "Find partners" button, not an error).
 */
export function useWeeklyMatches(source: "weekly" | "onboarding" = "weekly", maxWaitMs?: number): MatchesState {
  const [state, setState] = useState<MatchesState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    getWeeklyMatches(source, maxWaitMs).then((r) => {
      if (!live) return;
      setState(r.ok && r.matches.length ? { status: "ready", matches: r.matches, center: r.center, stale: r.stale, sample: r.matches.some((m) => m.lead.id.startsWith("sample-")) } : { status: "none" });
    });
    return () => {
      live = false;
    };
  }, [source, maxWaitMs]);
  return state;
}

/** Draft email = save to Partners, then open it there and start writing. */
export function useMatchActions() {
  const router = useRouter();
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<Record<string, string>>({});
  async function save(lead: Lead) {
    setBusy(lead.id);
    const r = await saveLeadToOutreach(lead.id);
    setBusy(null);
    if (!r.ok) {
      setProblem((p) => ({ ...p, [lead.id]: r.message }));
      return false;
    }
    setSaved((s) => ({ ...s, [lead.id]: true }));
    return true;
  }
  async function draft(lead: Lead) {
    if (await save(lead)) router.push(`/partners?draft=${encodeURIComponent(lead.id)}`);
  }
  return { saved, busy, problem, save, draft };
}

/** A match: name, type, distance, one line on why, the deal idea, Draft email + Save. */
export function MatchCard({ match, big = false, actions }: { match: Match; big?: boolean; actions: ReturnType<typeof useMatchActions> }) {
  const { lead } = match;
  const isSaved = Boolean(lead.saved) || actions.saved[lead.id];
  const details = [categoryLabel(lead.category), lead.distanceMi != null ? `${lead.distanceMi} mi away` : null].filter(Boolean).join(" · ");
  return (
    <article aria-label={lead.name} className={`flex flex-col gap-3 rounded-card border border-line bg-card text-ink ${big ? "p-[22px] desk:p-[18px]" : "p-[18px]"}`}>
      <div>
        <h3 className={`m-0 leading-snug font-semibold break-words ${big ? "text-[19px] desk:text-[16px]" : "text-[16px]"}`}>{lead.name}</h3>
        {details && <p className="m-0 mt-0.5 text-sm text-muted">{details}</p>}
      </div>
      <p className={`m-0 text-ink-soft ${big ? "text-[15px] desk:line-clamp-2 desk:text-sm" : "line-clamp-2 text-sm"}`}>{match.why}</p>
      <div className="flex flex-col gap-1 rounded-row bg-mint-tint px-3.5 py-3 text-mint-heading">
        <span className="text-xs font-semibold tracking-[0.08em] uppercase">Deal idea</span>
        <span className={big ? "text-[15px] desk:line-clamp-3 desk:text-sm" : "line-clamp-3 text-sm"}>{match.dealIdea}</span>
      </div>
      {actions.problem[lead.id] && (
        <p role="status" className="m-0 text-sm">
          {actions.problem[lead.id]}
        </p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" icon={<Sparkles size={15} aria-hidden="true" />} onClick={() => actions.draft(lead)} disabled={actions.busy !== null}>
          {actions.busy === lead.id ? "Opening…" : "Draft email"}
        </Button>
        {isSaved ? (
          <Link href="/partners" className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-mint-deep">
            <Check size={15} aria-hidden="true" /> In your Partners
          </Link>
        ) : (
          <Button size="sm" variant="soft" weight="medium" icon={<Bookmark size={15} aria-hidden="true" />} onClick={() => actions.save(lead)} disabled={actions.busy !== null}>
            Save
          </Button>
        )}
      </div>
    </article>
  );
}

function Skeleton({ count, className = "" }: { count: number; className?: string }) {
  return (
    <div className={className} role="status" aria-label="Finding your matches">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`animate-pulse rounded-card border border-line bg-card motion-reduce:animate-none ${i === 0 ? "h-[260px]" : "h-[200px]"}`} aria-hidden="true" />
      ))}
    </div>
  );
}

/**
 * "Your matches this week". Phone: one big top match, smaller cards, "See more matches".
 * Computer: 3 cards in a row. `compact` (Launch Home): 3 small cards, no big one.
 */
export function MatchesSection({ compact = false, title = "Your matches this week" }: { compact?: boolean; title?: string }) {
  const state = useWeeklyMatches();
  const actions = useMatchActions();
  return (
    <section aria-labelledby="matches-title" className="flex flex-col gap-3" data-tour="matches">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="matches-title" className="m-0 flex items-center gap-2 text-[20px] font-semibold tracking-[-0.3px]">
          {title}
          {state.status === "ready" && state.sample && <SampleTag />}
        </h2>
        {state.status === "ready" && (
          <Link href="/partners" className="hidden min-h-11 items-center gap-1 text-[15px] font-medium text-sky-ink desk:inline-flex">
            Your partners <ArrowRight size={16} aria-hidden="true" />
          </Link>
        )}
      </div>

      {state.status === "loading" && <Skeleton count={3} className={`grid gap-3 ${compact ? "grid-cols-1 desk:grid-cols-3" : "grid-cols-1 desk:grid-cols-3 desk:gap-4"}`} />}

      {state.status === "none" && (
        <div className="flex flex-col items-start gap-3 rounded-card border border-line bg-card p-[22px]">
          <p className="m-0 text-[15px] text-ink-soft">Second looks for local businesses you could team up with, like a gym that sends you clients. Want it to look now?</p>
          <Button href={FIND_MORE_HREF} size="sm" icon={<Search size={16} aria-hidden="true" />}>
            Find partners
          </Button>
        </div>
      )}

      {state.status === "ready" && (
        <>
          {state.stale && <p className="m-0 text-sm text-muted">From your last search. Second will look again next week.</p>}
          <div className={`grid grid-cols-1 gap-3 desk:grid-cols-3 desk:gap-4`}>
            {state.matches.slice(0, 3).map((m, i) => (
              <MatchCard key={m.id} match={m} big={!compact && i === 0} actions={actions} />
            ))}
          </div>
          <Link href={FIND_MORE_HREF} className="inline-flex min-h-11 items-center gap-1 self-start text-[15px] font-medium text-sky-ink">
            See more matches <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </>
      )}
    </section>
  );
}

/** emailed · replied · deals · $ from partners. Phone: one tappable strip. Computer: 4 tiles. */
export function PartnerProgress({ leads, transactions }: { leads: Lead[] | null; transactions: Transaction[] }) {
  const all = (leads ?? []).filter((l) => l.status !== "not_interested");
  const reached = (stages: string[]) => all.filter((l) => stages.includes(l.stage ?? "found")).length;
  const emailed = reached(["emailed", "replied", "deal"]);
  const replied = reached(["replied", "deal"]);
  const deals = reached(["deal"]);
  const earned = transactions.filter((t) => t.kind === "income" && t.partnerLeadId).reduce((s, t) => s + t.amount, 0);
  const show = (n: number) => (leads === null ? "–" : String(n));
  const items: [string, string, string?][] = [
    ["Emailed", show(emailed)],
    ["Replied", show(replied), "text-sky-ink"],
    ["Deals", show(deals), "text-mint-deep"],
    ["From partners", formatMoney(earned), "text-mint-deep"],
  ];
  const label = `Your partners: ${emailed} emailed, ${replied} replied, ${deals} deals, ${formatMoney(earned)} earned from partners. Open Partners.`;
  return (
    <>
      <Link href="/partners" aria-label={label} className="grid grid-cols-4 overflow-hidden rounded-card border border-line bg-card text-ink no-underline desk:hidden" data-tour="partner-progress">
        {items.map(([name, value, tone]) => (
          <span key={name} className="flex flex-col items-center gap-0.5 border-r border-line-soft px-1 py-3 text-center last:border-r-0">
            <span className={`text-[19px] font-semibold tabular-nums ${tone ?? ""}`}>{value}</span>
            <span className="text-xs text-muted">{name}</span>
          </span>
        ))}
      </Link>
      <Link href="/partners" aria-label={label} className="hidden grid-cols-4 gap-4 rounded-tile text-ink no-underline desk:grid" data-tour="partner-progress-desk">
        <StatTile label="Businesses emailed" value={show(emailed)} />
        <StatTile label="Replied" value={show(replied)} />
        <StatTile label="Deals made" value={show(deals)} valueGood={deals > 0} />
        <StatTile label="Earned from partners" value={formatMoney(earned)} valueGood={earned > 0} />
      </Link>
    </>
  );
}
