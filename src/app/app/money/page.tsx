"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus, Trash2 } from "lucide-react";
import { AddMoneyDialog, type MoneyKind } from "@/components/AddMoneyDialog";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { ChartEmptyNote, EmptyState } from "@/components/EmptyStates";
import { StatTile } from "@/components/StatTile";
import { useLoadedData } from "@/lib/data";
import { currentMonthKey, monthName, shiftMonth, shortDay } from "@/lib/dates";
import { changeFromLastMonth, formatMoney, keptHistory, monthTotals, sessionMath } from "@/lib/money";
import { deleteTransaction, type Transaction } from "@/lib/store";

const CHART_HEIGHT = 178;

// General advice (true for any small business), not based on made-up numbers.
const MONEY_TIP =
  "When you work for yourself, no one takes taxes out for you. Many people set aside about 25 to 30% of each payment.";

export default function MoneyPage() {
  const { business, moneyPlan, transactions, typeInfo } = useLoadedData();
  const [month, setMonth] = useState(currentMonthKey());
  const [adding, setAdding] = useState<MoneyKind | null>(null);
  const isThisMonth = month === currentMonthKey();

  const totals = monthTotals(transactions, month);
  const last = monthTotals(transactions, shiftMonth(month, -1));
  const history = keptHistory(transactions, month);
  const maxKept = Math.max(1, ...history.map((h) => h.kept));
  const hasAnyHistory = history.some((h) => h.kept !== 0);
  const incomeCategory = typeInfo.unit[0].toUpperCase() + typeInfo.unit.slice(1);
  const plan = sessionMath(moneyPlan, business.services[0]?.price ?? 0, business.payGoal);
  const goalPercent =
    business.payGoal > 0 ? Math.max(0, Math.min(100, Math.round((totals.kept / business.payGoal) * 100))) : 0;

  return (
    <PageBody gap="md">
      <PageHeader
        size="sm"
        title="Money"
        subtitle={`${monthName(month)} at a glance`}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-full border border-line-strong bg-card p-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
                className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <span className="min-w-24 text-center text-[15px]" aria-live="polite">
                {monthName(month)}
              </span>
              <button
                type="button"
                aria-label="Next month"
                disabled={isThisMonth}
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="flex size-11 items-center justify-center rounded-full hover:bg-line-soft disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
            <Button
              variant="ghost"
              weight="medium"
              pad="tight"
              icon={<Minus size={16} aria-hidden="true" />}
              onClick={() => setAdding("expense")}
            >
              Add expense
            </Button>
            <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding("income")}>
              Add income
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 desk:grid-cols-3">
        <StatTile
          size="lg"
          label="Earned"
          value={formatMoney(totals.earned)}
          note={`${totals.incomeCount} ${totals.incomeCount === 1 ? "payment" : "payments"}`}
        />
        <StatTile
          size="lg"
          label="Spent"
          value={formatMoney(totals.spent)}
          note={`${totals.categories.length} ${totals.categories.length === 1 ? "category" : "categories"}`}
        />
        <StatTile
          size="lg"
          dark
          label="You kept"
          value={formatMoney(totals.kept)}
          note={changeFromLastMonth(totals.kept, last.kept, monthName(shiftMonth(month, -1)))}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 desk:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card
          padding="lg"
          title="What you kept each month"
          aside={
            <div className="flex gap-3.5 text-[13px] text-muted" aria-hidden="true">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-sky" />
                Past months
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px] bg-mint" />
                {isThisMonth ? "This month" : monthName(month)}
              </span>
            </div>
          }
        >
          <div className="relative mt-4">
            <div
              className="grid h-[200px] grid-cols-6 items-end gap-2 border-b border-line desk:gap-[18px]"
              aria-hidden="true"
            >
              {history.map((h, i) => {
                const selected = i === history.length - 1;
                if (!hasAnyHistory) return <div key={h.key} />;
                return (
                  <div key={h.key} className="flex flex-col items-center gap-1.5">
                    <span className={`text-[13px] ${selected ? "font-semibold text-mint-deep" : "text-muted"}`}>
                      {formatMoney(h.kept)}
                    </span>
                    <div
                      className={`w-full rounded-[8px_8px_3px_3px] ${selected ? "bg-mint" : "bg-sky"}`}
                      style={{ height: Math.max(4, Math.round((Math.max(0, h.kept) / maxKept) * CHART_HEIGHT)) }}
                    />
                  </div>
                );
              })}
            </div>
            {!hasAnyHistory && (
              <ChartEmptyNote text="Your monthly totals will show here once you add money in or out." />
            )}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2 text-center text-[13px] text-muted desk:gap-[18px]" aria-hidden="true">
            {history.map((h) => (
              <span key={h.key}>{monthName(h.key, "short")}</span>
            ))}
          </div>
          <p className="sr-only">
            What you kept each month: {history.map((h) => `${monthName(h.key)} ${formatMoney(h.kept)}`).join(", ")}.
          </p>
        </Card>

        <Card padding="lg" className="flex flex-col gap-3.5">
          <h2 className="m-0 text-[17px] font-semibold">Where the money went</h2>
          {totals.categories.length === 0 ? (
            <EmptyState
              text={`Add an expense to see where your money goes in ${monthName(month)}.`}
              action={
                <Button size="sm" variant="ghost" weight="medium" icon={<Minus size={16} aria-hidden="true" />} onClick={() => setAdding("expense")}>
                  Add expense
                </Button>
              }
            />
          ) : (
            totals.categories.map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex justify-between text-[15px]">
                  <span>{row.label}</span>
                  <span className="font-medium">{formatMoney(row.amount)}</span>
                </div>
                <ProgressBar percent={row.percent} label={`${row.label}, ${row.percent}% of spending`} />
              </div>
            ))
          )}
          <div className="mt-auto rounded-row bg-mint-tint px-4 py-3.5">
            <h3 className="m-0 text-sm font-semibold text-mint-deep">Tip from Second</h3>
            <p className="mt-1 mb-0 text-[15px] leading-[1.45] text-mint-heading">{MONEY_TIP}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padding="lg" title="Recent activity" aside={<span className="text-sm text-muted">Newest first</span>}>
          {totals.transactions.length === 0 ? (
            <div className="mt-3 flex flex-col items-start gap-3">
              <p className="m-0 text-[15px] text-muted">
                Your payments and expenses for {monthName(month)} will show here.
              </p>
              <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAdding("income")}>
                Add income
              </Button>
            </div>
          ) : (
            <ul className="mt-1.5 mb-0 list-none p-0">
              {totals.transactions.map((t, i) => (
                <ActivityRow key={t.id} t={t} last={i === totals.transactions.length - 1} />
              ))}
            </ul>
          )}
        </Card>

        <Card padding="lg" title="Your goal" aside={<Chip tone="sky">From your money plan</Chip>}>
          <p className="mt-3 mb-0 text-[15px] leading-normal">
            You want to take home <b className="font-semibold">{formatMoney(business.payGoal)}</b> a month.
          </p>
          <div className="mt-3.5">
            <div className="flex justify-between text-sm text-muted">
              <span>Kept in {monthName(month)}</span>
              <span className="font-semibold text-ink">
                {formatMoney(Math.max(0, totals.kept))} of {formatMoney(business.payGoal)}
              </span>
            </div>
            <ProgressBar percent={goalPercent} label="Progress toward your pay goal" className="mt-2" />
          </div>
          <p className="mt-3.5 mb-0 text-sm leading-normal text-muted">
            Your plan says about {plan.toGoal} {typeInfo.units} a month gets you there. You&apos;ve logged{" "}
            {totals.incomeCount} {totals.incomeCount === 1 ? "payment" : "payments"} so far.
          </p>
        </Card>
      </div>

      <AddMoneyDialog kind={adding} incomeCategory={incomeCategory} onClose={() => setAdding(null)} />
    </PageBody>
  );
}

function ActivityRow({ t, last }: { t: Transaction; last: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const income = t.kind === "income";
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 text-[15px] desk:grid-cols-[76px_minmax(0,1fr)_130px_90px_44px] ${
        last ? "pt-3" : "border-b border-line-soft py-3"
      }`}
    >
      <span className="text-muted max-desk:col-span-3 max-desk:text-[13px]">{shortDay(t.date)}</span>
      <span className="min-w-0">{t.label}</span>
      <span className="max-desk:hidden">
        <Chip tone={income ? "mint" : "sky"} weight="normal">
          {t.category}
        </Chip>
      </span>
      <span className={`text-right font-semibold ${income ? "text-mint-deep" : ""}`}>
        {income ? "+" : "-"}
        {formatMoney(t.amount)}
      </span>
      {confirming ? (
        <span className="col-span-full flex flex-wrap items-center justify-end gap-2 pt-1">
          <span className="text-sm text-muted">Delete this?</span>
          <Button size="sm" variant="dark" onClick={() => deleteTransaction(t.id)}>
            Yes, delete
          </Button>
          <Button size="sm" variant="ghost" weight="medium" onClick={() => setConfirming(false)}>
            Keep it
          </Button>
        </span>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${t.label}`}
          onClick={() => setConfirming(true)}
          className="flex size-11 items-center justify-center justify-self-end rounded-full text-muted hover:bg-line-soft hover:text-ink"
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      )}
    </li>
  );
}
