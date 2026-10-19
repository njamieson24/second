"use client";

import { MessageCircle, Plus } from "lucide-react";
import { Button } from "@/components/Button";
import { TodaySchedule } from "@/components/calendar/TodaySchedule";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { ChartEmptyNote, ComingSoon, SampleTag } from "@/components/EmptyStates";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { TextLink } from "@/components/TextLink";
import { ThisWeek } from "@/components/ThisWeek";
import { TipCard } from "@/components/TipCard";
import { TourOffer } from "@/components/TourOffer";
import { useLoadedData } from "@/lib/data";
import { currentMonthKey, greeting, longDate, monthName, shiftMonth, todayISO, toISODate } from "@/lib/dates";
import { ideas, newReplies } from "@/lib/demo-content";
import { changeFromLastMonth, formatMoney, keptHistory, monthTotals } from "@/lib/money";

/** Monday of this week, as YYYY-MM-DD. */
function weekStartISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toISODate(d);
}

export default function DashboardPage() {
  const { business, transactions, showSamples } = useLoadedData();
  const month = currentMonthKey();
  const totals = monthTotals(transactions, month);
  const lastKept = monthTotals(transactions, shiftMonth(month, -1)).kept;
  const history = keptHistory(transactions, month);
  const maxKept = Math.max(1, ...history.map((h) => h.kept));
  const hasMoney = totals.transactions.length > 0;
  const hasAnyHistory = history.some((h) => h.kept !== 0);

  const weekStart = weekStartISO();
  const today = todayISO();
  const thisWeek = transactions.filter((t) => t.date >= weekStart && t.date <= today && t.kind === "income");
  const earnedThisWeek = thisWeek.reduce((s, t) => s + t.amount, 0);
  const goalPercent = business.payGoal > 0 ? Math.max(0, Math.round((totals.kept / business.payGoal) * 100)) : 0;

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

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <ThisWeek />

        <Card
          title="Money this month"
          aside={<span className="text-[13px] text-muted">{monthName(month)}</span>}
          padding="lg"
          className="flex flex-col"
        >
          <div className="mt-3.5 text-sm text-muted">You kept</div>
          <div className="text-[44px] leading-[1.1] font-semibold tracking-[-1px]">{formatMoney(totals.kept)}</div>
          <div className="mt-2">
            {hasMoney ? (
              <Chip tone={totals.kept >= lastKept ? "mint" : "neutral"} weight="medium">
                {changeFromLastMonth(totals.kept, lastKept, monthName(shiftMonth(month, -1)))}
              </Chip>
            ) : (
              <span className="text-sm text-muted">Nothing logged yet this month.</span>
            )}
          </div>
          <div className="relative mt-5">
            <div className="grid h-24 grid-cols-6 items-end gap-2.5 border-b border-line" aria-hidden="true">
              {history.map((h, i) => {
                const last = i === history.length - 1;
                const prev = i === history.length - 2;
                return h.kept > 0 ? (
                  <div
                    key={h.key}
                    className={`rounded-[6px_6px_2px_2px] ${last ? "bg-mint" : prev ? "bg-sky" : "bg-sky-tint"}`}
                    style={{ height: `${(h.kept / maxKept) * 100}%` }}
                  />
                ) : (
                  <div key={h.key} />
                );
              })}
            </div>
            {!hasAnyHistory && <ChartEmptyNote text="Your monthly totals will show here." />}
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-2.5 text-center text-xs text-muted" aria-hidden="true">
            {history.map((h, i) => (
              <span key={h.key} className={i === history.length - 1 ? "font-semibold text-mint-deep" : ""}>
                {monthName(h.key, "short")}
              </span>
            ))}
          </div>
          <p className="sr-only">
            What you kept each month: {history.map((h) => `${monthName(h.key)} ${formatMoney(h.kept)}`).join(", ")}.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-line-soft pt-3.5 text-sm">
            <div>
              <span className="text-muted">Earned </span>
              <span className="font-semibold">{formatMoney(totals.earned)}</span>
            </div>
            <div>
              <span className="text-muted">Spent </span>
              <span className="font-semibold">{formatMoney(totals.spent)}</span>
            </div>
            {hasMoney ? (
              <TextLink href="/app/money" className="ml-auto">
                Details
              </TextLink>
            ) : (
              <Button href="/app/money" size="sm" className="ml-auto" icon={<Plus size={16} aria-hidden="true" />}>
                Add money in or out
              </Button>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 desk:grid-cols-4">
        <StatTile
          label="Payments this week"
          value={String(thisWeek.length)}
          note={thisWeek.length === 0 ? "None yet" : undefined}
          inlineNote
        />
        <StatTile label="Earned this week" value={formatMoney(earnedThisWeek)} inlineNote />
        <StatTile label="Spent this month" value={formatMoney(totals.spent)} inlineNote />
        <StatTile
          label="Toward your pay goal"
          value={`${goalPercent}%`}
          note={`of ${formatMoney(business.payGoal)}`}
          noteGood={goalPercent >= 100}
          inlineNote
        />
      </div>

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-3">
        {showSamples ? (
          <Card title="New replies" aside={<SampleTag />}>
            <ul className="mt-2 mb-0 list-none p-0">
              {newReplies.map((r, i) => (
                <li
                  key={r.name}
                  className={`flex gap-3 ${i === newReplies.length - 1 ? "pt-3" : "border-b border-line-soft py-3"}`}
                >
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      r.tone === "mint" ? "bg-mint-tint text-mint-deep" : "bg-sky-tint text-sky-ink"
                    }`}
                    aria-hidden="true"
                  >
                    {r.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-[15px] font-medium">{r.name}</span>
                      <span className="text-xs text-muted">{r.when}</span>
                    </div>
                    <div className="text-sm text-muted">{r.text}</div>
                    {r.chip && (
                      <Chip tone="mint" size="sm" className="mt-1.5">
                        {r.chip}
                      </Chip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <ComingSoon
            title="New replies"
            text="When local businesses answer the emails Second sends for you, their replies will show up here."
          />
        )}

        <TodaySchedule />

        {showSamples ? (
          <TipCard title="Ideas from Second" withMark className="flex flex-col gap-3">
            <div>
              <SampleTag />
            </div>
            {ideas.map((idea) => (
              <div key={idea.lead} className="rounded-[14px] bg-card px-3.5 py-3 text-sm leading-[1.45] text-mint-heading">
                <span className="font-semibold">{idea.lead}</span> {idea.text}
              </div>
            ))}
          </TipCard>
        ) : (
          <ComingSoon
            title="Ideas from Second"
            text="Second will look at your numbers and suggest simple ways to earn more, like a holiday special."
          />
        )}
      </div>
    </PageBody>
  );
}
