"use client";

import { useEffect, useState } from "react";
import { MessageCircle, Plus } from "lucide-react";
import { AddMoneyDialog } from "@/components/AddMoneyDialog";
import { Button } from "@/components/Button";
import { TodaySchedule } from "@/components/calendar/TodaySchedule";
import { Card } from "@/components/Card";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { MatchesSection, PartnerProgress } from "@/components/partners/Matches";
import { TextLink } from "@/components/TextLink";
import { ThisWeek } from "@/components/ThisWeek";
import { TourOffer } from "@/components/TourOffer";
import { capital, familyOf } from "@/lib/business-kinds";
import { useLoadedData } from "@/lib/data";
import { greeting, longDate, todayISO, toISODate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Lead } from "@/lib/outreach";
import { getLeads } from "@/lib/store";

/** Monday of this week, as YYYY-MM-DD. */
function weekStartISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

// Home (Running): partners first. Your matches this week, then what you've done with partners,
// then This Week's 3 tasks and money this week. The matches load on their own (a skeleton
// first), so nothing on the page waits for the search.
export default function DashboardPage() {
  const { business, transactions } = useLoadedData();
  const words = familyOf(business.type).words;
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let live = true;
    getLeads().then((r) => live && setLeads(r.leads));
    return () => {
      live = false;
    };
  }, []);

  const weekStart = weekStartISO();
  const today = todayISO();
  const thisWeek = transactions.filter((t) => t.date >= weekStart && t.date <= today && t.kind === "income");
  const earnedThisWeek = thisWeek.reduce((s, t) => s + t.amount, 0);
  const fromPartners = thisWeek.filter((t) => t.partnerLeadId).reduce((s, t) => s + t.amount, 0);

  return (
    <PageBody>
      <PageHeader
        eyebrow={longDate()}
        title={`${greeting()}, ${business.ownerName}`}
        actions={
          <Button href="/chat" icon={<MessageCircle size={18} aria-hidden="true" />}>
            Ask Second
          </Button>
        }
      />

      <TourOffer mode="running" />

      <PartnerProgress leads={leads} transactions={transactions} />

      <MatchesSection />

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ThisWeek />

        <Card title="Money this week" padding="lg" className="flex flex-col desk:self-start" tourId="money-week">
          <dl className="mt-3 mb-0 flex flex-col gap-3">
            <div>
              <dt className="text-sm text-muted">Earned</dt>
              <dd className="m-0 text-[40px] leading-[1.1] font-semibold tracking-[-1px] tabular-nums">{formatMoney(earnedThisWeek)}</dd>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-line-soft pt-3 text-[15px]">
              <div>
                <dt className="inline text-muted">From partners </dt>
                <dd className="inline font-semibold text-mint-deep tabular-nums">{formatMoney(fromPartners)}</dd>
              </div>
              <div>
                <dt className="inline text-muted">{capital(words.visits)} </dt>
                <dd className="inline font-semibold tabular-nums">{thisWeek.length}</dd>
              </div>
            </div>
          </dl>
          <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
            <Button size="sm" onClick={() => setAdding(true)} icon={<Plus size={16} aria-hidden="true" />}>
              Log income
            </Button>
            <TextLink href="/app/money" className="ml-auto">
              All your money
            </TextLink>
          </div>
        </Card>
      </div>

      <TodaySchedule />

      <AddMoneyDialog kind={adding ? "income" : null} incomeCategory={capital(words.visit)} onClose={() => setAdding(false)} />
    </PageBody>
  );
}
