"use client";

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { HeroCard, HeroRow } from "@/components/HeroCard";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { TextLink } from "@/components/TextLink";
import { TipCard } from "@/components/TipCard";
import { useLoadedData } from "@/lib/data";
import { currentMonthKey, greeting, longDate, monthName, shiftMonth } from "@/lib/dates";
import { dashboardStats, gamePlan, ideas, newReplies, todaySchedule } from "@/lib/mock-data";
import { changeFromLastMonth, formatMoney, keptHistory, monthTotals } from "@/lib/money";

export default function DashboardPage() {
  const { business, transactions } = useLoadedData();
  const month = currentMonthKey();
  const totals = monthTotals(transactions, month);
  const lastKept = monthTotals(transactions, shiftMonth(month, -1)).kept;
  const history = keptHistory(transactions, month);
  const maxKept = Math.max(1, ...history.map((h) => h.kept));
  const hasMoney = totals.transactions.length > 0;

  return (
    <PageBody>
      <PageHeader
        eyebrow={longDate()}
        title={`${greeting()}, ${business.ownerName}`}
        actions={
          <>
            <input
              type="search"
              aria-label="Search"
              placeholder="Search clients, places, posts"
              className="h-11 w-full rounded-full border border-line bg-card px-[18px] text-[15px] text-ink placeholder:text-muted desk:w-[280px]"
            />
            <Button href="/chat" icon={<MessageCircle size={18} aria-hidden="true" />}>
              Ask Second
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <HeroCard eyebrow="This week's game plan" meta={gamePlan.timeNeeded} heading={gamePlan.heading} gap="sm">
          {gamePlan.moves.map((move, i) => (
            <HeroRow
              key={move.title}
              n={i + 1}
              badgeTone={move.primary ? "mint" : "sky-light"}
              title={move.title}
              detail={move.detail}
              action={
                <Button
                  href={move.href}
                  variant={move.primary ? "mint" : "ghost-dark"}
                  weight={move.primary ? "semibold" : "medium"}
                  pad="tight"
                >
                  {move.action}
                </Button>
              }
            />
          ))}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[15px] text-on-dark">{gamePlan.footer}</span>
            <Button variant="light" pad="wide">
              Approve all {gamePlan.moves.length}
            </Button>
          </div>
        </HeroCard>

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
          <div className="mt-5 grid h-24 grid-cols-6 items-end gap-2.5" aria-hidden="true">
            {history.map((h, i) => {
              const last = i === history.length - 1;
              const prev = i === history.length - 2;
              return (
                <div
                  key={h.key}
                  className={`rounded-[6px_6px_2px_2px] ${last ? "bg-mint" : prev ? "bg-sky" : "bg-sky-tint"}`}
                  style={{ height: `${Math.max(4, (Math.max(0, h.kept) / maxKept) * 100)}%` }}
                />
              );
            })}
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
          <div className="mt-4 flex flex-wrap gap-5 border-t border-line-soft pt-3.5 text-sm">
            <div>
              <span className="text-muted">Earned </span>
              <span className="font-semibold">{formatMoney(totals.earned)}</span>
            </div>
            <div>
              <span className="text-muted">Spent </span>
              <span className="font-semibold">{formatMoney(totals.spent)}</span>
            </div>
            <TextLink href="/app/money" className="ml-auto">
              Details
            </TextLink>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4 desk:grid-cols-4">
        {dashboardStats.map((s) => (
          <StatTile key={s.label} label={s.label} value={s.value} note={s.note} noteGood={s.good} inlineNote />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-3">
        <Card title="New replies" aside={<TextLink href="/app/outreach" className="text-sm">See all</TextLink>}>
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

        <Card
          title="Today's schedule"
          aside={<span className="text-sm text-muted">{todaySchedule.length} sessions</span>}
        >
          <ul className="mt-2 mb-0 list-none p-0">
            {todaySchedule.map((s, i) => (
              <li
                key={s.time}
                className={`flex gap-3.5 ${i === todaySchedule.length - 1 ? "pt-[11px]" : "border-b border-line-soft py-[11px]"}`}
              >
                <span className="w-[72px] shrink-0 text-sm font-medium text-sky-ink">{s.time}</span>
                <div>
                  <div className="text-[15px] font-medium">{s.name}</div>
                  <div className="text-sm text-muted">{s.service}</div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <TipCard title="Ideas from Second" withMark className="flex flex-col gap-3">
          {ideas.map((idea) => (
            <div key={idea.lead} className="rounded-[14px] bg-card px-3.5 py-3 text-sm leading-[1.45] text-mint-heading">
              <span className="font-semibold">{idea.lead}</span> {idea.text}
            </div>
          ))}
          <div>
            <Button href="/chat" variant="green" pad="tight">
              Talk these through
            </Button>
          </div>
        </TipCard>
      </div>
    </PageBody>
  );
}
