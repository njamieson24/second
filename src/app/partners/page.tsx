"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { EmptyState, SampleTag } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { OsmCredit } from "@/components/outreach/SearchPanel";
import { NotInterestedRow, PartnerCard } from "@/components/partners/PartnerCard";
import { useLoadedData } from "@/lib/data";
import { formatMoney } from "@/lib/money";
import { PARTNER_STAGES, type Lead, type PartnerStage } from "@/lib/outreach";
import { getLeads } from "@/lib/store";

// Partners: the businesses you're teaming up with, from found to deal. You move each one along
// by hand ("Mark as emailed", "They replied", "We made a deal"). Second never sends anything.
// Find more starts a chat ("find me local businesses to team up with"), the same search as chat.

export default function PartnersPage() {
  return (
    <AppShell mode="current">
      <Suspense>
        <Partners />
      </Suspense>
    </AppShell>
  );
}

const ORDER: PartnerStage[] = ["replied", "emailed", "found", "deal"];

function Partners() {
  const { transactions, catalog } = useLoadedData();
  const params = useSearchParams();
  const draftFor = params.get("draft");
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [sample, setSample] = useState(false);
  const [showOut, setShowOut] = useState(false);

  useEffect(() => {
    let live = true;
    getLeads().then((r) => {
      if (!live) return;
      setLeads(r.leads);
      setSample(r.sample);
    });
    return () => {
      live = false;
    };
  }, []);

  const change = (lead: Lead) => setLeads((all) => (all ?? []).map((l) => (l.id === lead.id ? { ...l, ...lead } : l)));
  const setStatus = (id: string, status: Lead["status"]) => setLeads((all) => (all ?? []).map((l) => (l.id === id ? { ...l, status } : l)));

  const active = (leads ?? []).filter((l) => l.status !== "not_interested");
  const out = (leads ?? []).filter((l) => l.status === "not_interested");
  const byStage = (s: PartnerStage) => active.filter((l) => (l.stage ?? "found") === s);

  // Money from partners: income entries tagged "From a partner".
  const partnerIncome = transactions.filter((t) => t.kind === "income" && t.partnerLeadId);
  const earned = partnerIncome.reduce((s, t) => s + t.amount, 0);
  const monthKey = new Date().toISOString().slice(0, 7);
  const visitsThisMonth = partnerIncome.filter((t) => t.date.startsWith(monthKey)).length;
  const incomeFor = new Map<string, typeof partnerIncome>();
  for (const t of partnerIncome) incomeFor.set(t.partnerLeadId!, [...(incomeFor.get(t.partnerLeadId!) ?? []), t]);

  const card = (l: Lead) => (
    <PartnerCard
      key={l.id}
      lead={l}
      catalog={catalog}
      income={incomeFor.get(l.id) ?? []}
      onChange={change}
      onGone={(id) => setStatus(id, "not_interested")}
      autoDraft={draftFor === l.id}
    />
  );

  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Partners"
        subtitle="Local businesses you're teaming up with. Second writes the emails. You send them from your own email."
        eyebrow={sample ? <SampleTag /> : undefined}
        actions={
          <Button href={`/chat?ask=${encodeURIComponent("Find me local businesses I could team up with")}`} size="sm" icon={<Search size={16} aria-hidden="true" />}>
            Find more
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 desk:max-w-[560px]" data-tour="partners-money">
        <div className="rounded-card border border-line bg-card px-4 py-3">
          <div className="text-sm text-muted">Earned from partners</div>
          <div className="text-[26px] font-semibold text-mint-deep tabular-nums">{formatMoney(earned)}</div>
        </div>
        <div className="rounded-card border border-line bg-card px-4 py-3">
          <div className="text-sm text-muted">Partner visits this month</div>
          <div className="text-[26px] font-semibold tabular-nums">{visitsThisMonth}</div>
        </div>
      </div>

      {/* Phone: a 4-number pipeline strip */}
      <div className="grid grid-cols-4 overflow-hidden rounded-card border border-line bg-card desk:hidden" aria-label="Your pipeline">
        {PARTNER_STAGES.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-0.5 border-r border-line-soft py-3 last:border-r-0">
            <span className={`text-[22px] font-semibold tabular-nums ${s.id === "replied" ? "text-sky-ink" : s.id === "deal" ? "text-mint-deep" : ""}`}>{byStage(s.id).length}</span>
            <span className="text-xs text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {leads === null ? (
        <p role="status" className="m-0 text-[15px] text-muted">
          Loading your partners…
        </p>
      ) : active.length === 0 ? (
        <EmptyState
          text="No partners yet. Save a match from Home, or ask Second to find local businesses you could team up with."
          action={
            <Button href={`/chat?ask=${encodeURIComponent("Find me local businesses I could team up with")}`} size="sm" icon={<MessageCircle size={16} aria-hidden="true" />}>
              Ask Second
            </Button>
          }
        />
      ) : (
        <>
          {/* Phone: one list, what needs you first */}
          <div className="flex flex-col gap-3 desk:hidden" data-tour="partners-list">
            {ORDER.flatMap((s) => byStage(s)).map(card)}
          </div>
          {/* Computer: 4 columns */}
          <div className="hidden grid-cols-4 items-start gap-4 desk:grid" data-tour="partners-board">
            {PARTNER_STAGES.map((s) => (
              <section key={s.id} aria-labelledby={`col-${s.id}`} className="flex flex-col gap-3 rounded-card bg-line-soft/60 p-3">
                <h2 id={`col-${s.id}`} className="m-0 flex items-center justify-between px-1 text-[15px] font-semibold">
                  {s.label}
                  <span className={`text-sm ${s.id === "replied" ? "text-sky-ink" : "text-muted"}`}>{byStage(s.id).length}</span>
                </h2>
                {byStage(s.id).map(card)}
                {byStage(s.id).length === 0 && <p className="m-0 px-1 text-sm text-muted">Nothing here yet.</p>}
              </section>
            ))}
          </div>
        </>
      )}

      {out.length > 0 && (
        <section aria-labelledby="not-interested" className="flex flex-col gap-2">
          <button id="not-interested" type="button" onClick={() => setShowOut((s) => !s)} className="min-h-11 self-start text-[15px] text-sky-ink underline" aria-expanded={showOut}>
            Not interested ({out.length})
          </button>
          {showOut && (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {out.map((l) => (
                <NotInterestedRow key={l.id} lead={l} onBack={(id) => setStatus(id, "new")} />
              ))}
            </ul>
          )}
        </section>
      )}

      {active.some((l) => l.source === "osm") && <OsmCredit />}
    </PageBody>
  );
}
