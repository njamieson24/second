"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { SampleTag, EmptyState } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { LeadCard } from "@/components/outreach/LeadCard";
import { OsmCredit } from "@/components/outreach/SearchPanel";
import { LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/outreach";
import { getLeads } from "@/lib/store";

// Outreach (both modes): the businesses the owner saved from Chat with Second ("Save to
// Outreach"), with their email, a draft, a note and a status. The owner sends emails from their
// own email. Second never does.
//
// Searching the map and adding a business by hand used to live on this page. They're hidden on
// purpose (the page felt cluttered), not deleted: SearchPanel and AddLeadForm are still in
// src/components/outreach/, and the /api/outreach "search" and "add_manual" actions still work
// (chat uses the same search). To bring them back, render them here again.

const PAGE = 12;

export default function OutreachPage() {
  return (
    <AppShell mode="current">
      <Outreach />
    </AppShell>
  );
}

function Outreach() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [sample, setSample] = useState(false);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [visible, setVisible] = useState(PAGE);

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

  const change = (lead: Lead) => setLeads((all) => (all ?? []).map((l) => (l.id === lead.id ? lead : l)));
  const removed = (id: string) => setLeads((all) => (all ?? []).filter((l) => l.id !== id));
  const all = leads ?? [];
  const shown = all.filter((l) => filter === "all" || l.status === filter);
  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of leads ?? []) c.set(l.status, (c.get(l.status) ?? 0) + 1);
    return c;
  }, [leads]);

  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Outreach"
        subtitle="Businesses you saved from your chats with Second. Second writes the email. You send it from your own email."
        eyebrow={sample ? <SampleTag /> : undefined}
        actions={
          <Button href="/chat" variant="soft" size="sm" weight="medium" icon={<MessageCircle size={16} aria-hidden="true" />}>
            Find more with Second
          </Button>
        }
      />

      {all.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show by status">
          {[{ id: "all" as const, label: "All" }, ...LEAD_STATUSES].map((s) => {
            const n = s.id === "all" ? all.length : (counts.get(s.id) ?? 0);
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

      {leads === null ? (
        <p role="status" className="m-0 text-[15px] text-muted">
          Loading your businesses…
        </p>
      ) : all.length === 0 ? (
        <EmptyState
          text="Nothing saved yet. Ask Second in chat to find local businesses you could team up with, then tap Save to Outreach on the ones you like."
          action={
            <Button href="/chat" size="sm" icon={<MessageCircle size={16} aria-hidden="true" />}>
              Ask Second
            </Button>
          }
        />
      ) : shown.length === 0 ? (
        <EmptyState text="Nothing with that status yet." />
      ) : (
        <>
          <div className="flex max-w-[860px] flex-col gap-4">
            {shown.slice(0, visible).map((l) => (
              <LeadCard key={l.id} lead={l} onChange={change} onRemoved={removed} />
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

      {all.some((l) => l.source === "osm") && <OsmCredit />}
    </PageBody>
  );
}
