"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { SampleTag, EmptyState } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { AddLeadForm } from "@/components/outreach/AddLeadForm";
import { LeadCard } from "@/components/outreach/LeadCard";
import { OsmCredit, SearchPanel, type SearchInput } from "@/components/outreach/SearchPanel";
import { useLoadedData } from "@/lib/data";
import { categoryLabel, DEFAULT_RADIUS, LEAD_STATUSES, type Lead, type LeadStatus, type OutreachUsage } from "@/lib/outreach";
import { getLeads, getOutreachUsage, searchLeads } from "@/lib/store";

// Outreach (Running mode): find local businesses to team up with, find their public email,
// and have Second draft an email. The owner sends it from their own email. Second never does.

/** "Asbury Park, NJ" -> town "Asbury Park", state "NJ". */
function splitArea(area: string): { town: string; state: string } {
  const parts = area.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { town: parts[0] ?? "", state: "" };
  return { town: parts.slice(0, -1).join(", "), state: parts[parts.length - 1] };
}

const PAGE = 12;

type Scope = { label: string; town: string; ids: Set<string> } | null;

export default function OutreachPage() {
  const { business } = useLoadedData();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [sample, setSample] = useState(false);
  const [usage, setUsage] = useState<OutreachUsage | null>(null);
  const [scope, setScope] = useState<Scope>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [searching, setSearching] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [lastSearch, setLastSearch] = useState<SearchInput | null>(null);
  const [reused, setReused] = useState(false);
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    let live = true;
    getLeads().then((r) => {
      if (!live) return;
      setLeads(r.leads);
      setSample(r.sample);
    });
    getOutreachUsage().then((u) => live && setUsage(u));
    return () => {
      live = false;
    };
  }, []);

  const area = splitArea(business.area ?? "");
  const initial: SearchInput = { ...area, category: business.type === "fitness" ? "cafes" : "gyms", hideChains: true, radiusMi: DEFAULT_RADIUS };

  async function search(input: SearchInput & { fresh?: boolean }) {
    const what = categoryLabel(input.category).toLowerCase();
    setSearching(`Looking at the map for ${what} within ${input.radiusMi} miles of ${input.town}…`);
    setProblem(null);
    setNote(null);
    const r = await searchLeads(input);
    setSearching(null);
    if (!r.ok) return setProblem(r.message);
    setUsage(r.usage);
    setLastSearch(input);
    setReused(r.reused);
    setLeads((all) => {
      const byId = new Map((all ?? []).map((l) => [l.id, l]));
      for (const l of r.leads) byId.set(l.id, l);
      return [...byId.values()];
    });
    // A fresh search can remove places the map no longer lists: reload the full list too.
    if (!r.reused) getLeads().then((all) => setLeads(all.leads));
    setScope({ label: `${categoryLabel(input.category)} within ${input.radiusMi} miles of ${r.town}`, town: r.town, ids: new Set(r.leads.map((l) => l.id)) });
    setFilter("all");
    setVisible(PAGE);
    if (!r.leads.length) setNote("We didn't find any on the map. Try a bigger distance, another kind of business, or turn off Hide chains.");
    else if (r.reused) setNote("These are from your last search. Saved results are kept for 30 days.");
    else if (r.leads.length >= 150) setNote("Showing the 150 closest.");
  }

  const change = (lead: Lead) => setLeads((all) => (all ?? []).map((l) => (l.id === lead.id ? { ...lead, distanceMi: lead.distanceMi ?? l.distanceMi } : l)));
  const added = (lead: Lead) => {
    setLeads((all) => [lead, ...(all ?? [])]);
    setScope((s) => (s ? { ...s, ids: new Set([lead.id, ...s.ids]) } : s));
  };

  const inScope = useMemo(() => (leads ?? []).filter((l) => !scope || scope.ids.has(l.id)), [leads, scope]);
  const shown = inScope.filter((l) => filter === "all" || l.status === filter);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of inScope) c.set(l.status, (c.get(l.status) ?? 0) + 1);
    return c;
  }, [inScope]);

  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Outreach"
        subtitle="Find local businesses to team up with. Second writes the email. You send it from your own email."
        eyebrow={sample ? <SampleTag /> : undefined}
      />

      <SearchPanel initial={initial} busy={searching !== null} onSearch={search} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OsmCredit />
        {usage && (
          <p className="m-0 text-sm text-muted">
            Today: {usage.lookupsLeft} email lookups and {usage.draftsLeft} drafts left
          </p>
        )}
      </div>

      {searching && (
        <p role="status" className="m-0 rounded-row bg-sky-tint px-4 py-3 text-[15px] text-sky-ink">
          {searching} Bigger distances can take up to 20 seconds.
        </p>
      )}
      {problem && (
        <p role="alert" className="m-0 rounded-row border border-line bg-card px-4 py-3 text-[15px] text-ink">
          {problem}
        </p>
      )}
      {note && !searching && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p role="status" className="m-0 text-[15px] text-muted">
            {note}
          </p>
          {reused && lastSearch && (
            <button type="button" onClick={() => search({ ...lastSearch, fresh: true })} className="min-h-11 text-[15px] text-sky-ink underline">
              Search the map again
            </button>
          )}
        </div>
      )}

      <section aria-labelledby="leads-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="leads-heading" className="m-0 text-[21px] font-semibold">
            {scope ? scope.label : "Your businesses"}
          </h2>
          {scope && (
            <button type="button" onClick={() => {
                setScope(null);
                setVisible(PAGE);
              }} className="min-h-11 text-[15px] text-sky-ink underline">
              Show all my businesses
            </button>
          )}
        </div>

        {inScope.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show by status">
            {[{ id: "all" as const, label: "All" }, ...LEAD_STATUSES].map((s) => {
              const n = s.id === "all" ? inScope.length : (counts.get(s.id) ?? 0);
              if (s.id !== "all" && n === 0) return null;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={filter === s.id}
                  onClick={() => {
                    setFilter(s.id);
                    setVisible(PAGE);
                  }}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium transition-colors ${
                    filter === s.id ? "bg-ink text-paper" : "border border-line-strong bg-card text-ink hover:border-ink"
                  }`}
                >
                  {s.label} ({n})
                </button>
              );
            })}
          </div>
        )}

        <AddLeadForm town={scope?.town ?? business.area ?? ""} onAdded={added} />

        {leads === null ? (
          <p role="status" className="m-0 text-[15px] text-muted">
            Loading your businesses…
          </p>
        ) : shown.length === 0 && !searching ? (
          <EmptyState
            text={
              inScope.length
                ? "Nothing with that status yet."
                : "No businesses yet. Pick a kind of business above and tap Find. Second will list the ones near you."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-4 desk:grid-cols-2">
              {shown.slice(0, visible).map((l) => (
                <LeadCard key={l.id} lead={l} showDistance={scope !== null} onChange={change} onUsage={(u) => setUsage((old) => (old ? { ...old, ...u } : old))} />
              ))}
            </div>
            {shown.length > visible && (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="soft" size="sm" weight="medium" onClick={() => setVisible((v) => v + PAGE)}>
                  Show {Math.min(PAGE, shown.length - visible)} more
                </Button>
                <span className="text-sm text-muted">
                  Showing {visible} of {shown.length}
                </span>
              </div>
            )}
          </>
        )}
      </section>
    </PageBody>
  );
}
