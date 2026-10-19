"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyStates";
import { Field, MoneyInput } from "@/components/Field";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { TipCard } from "@/components/TipCard";
import type { CostIdea } from "@/lib/business-types";
import { useLoadedData } from "@/lib/data";
import { formatMoney, sessionMath, sumCosts } from "@/lib/money";
import { newId, saveMainPrice, saveMoneyPlan, savePayGoal, type CostLine, type MoneyPlan } from "@/lib/store";

// General advice, true for any new business.
const MONEY_PLAN_TIP =
  "Offer an intro price for your first 10 clients. It gets people in the door and helps you collect reviews fast.";

export default function MoneyPlanPage() {
  const { business, moneyPlan, typeInfo } = useLoadedData();
  const main = business.services[0];
  const price = main?.price ?? 0;
  const math = sessionMath(moneyPlan, price, business.payGoal);
  const savingsGoal = sumCosts(moneyPlan.startupCosts);
  const savedPercent = savingsGoal > 0 ? Math.min(100, Math.round((moneyPlan.saved / savingsGoal) * 100)) : 0;
  // "Fill in common costs" uses the business type chosen during setup.
  const kindOf = business.type === "other" ? "" : ` for ${typeInfo.label.toLowerCase()}`;
  const Units = typeInfo.units[0].toUpperCase() + typeInfo.units.slice(1);

  const savePlan = (patch: Partial<MoneyPlan>) => saveMoneyPlan({ ...moneyPlan, ...patch });

  return (
    <PageBody>
      <PageHeader
        size="lg"
        title="Money plan"
        subtitle="What to charge, what it costs, and how many clients you need. Change any number and everything updates."
      />

      <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-3">
        <Card title="Monthly costs">
          <CostList
            lines={moneyPlan.monthlyCosts}
            onChange={(monthlyCosts) => savePlan({ monthlyCosts })}
            addLabel="Add a cost"
            emptyText="Add what you spend each month, like supplies, insurance, and apps."
            ideas={typeInfo.monthlyCosts}
            fillLabel={`Fill in common costs${kindOf}`}
          />
          <div className="flex justify-between border-t border-line-soft pt-3 text-base font-semibold">
            <span>Total</span>
            <span>{formatMoney(math.monthlyCosts)} a month</span>
          </div>
          <div className="mt-4 rounded-[14px] bg-paper p-3.5">
            <Field label="Your pay goal each month" help="What you want to take home after costs.">
              {(id) => <MoneyInput id={id} value={business.payGoal} onChange={savePayGoal} />}
            </Field>
          </div>
        </Card>

        <Card title="Your price" tourId="money-plan">
          <div className="mt-3">
            <Field label={`Price for ${main?.name ?? "your main service"}`} labelHidden>
              {(id) => <MoneyInput id={id} value={price} onChange={saveMainPrice} size="lg" />}
            </Field>
          </div>
          <div className="mt-1.5 text-[15px] text-muted">
            per {main?.minutes ? `${main.minutes}-minute ` : ""}
            {main?.name ?? typeInfo.unit}
          </div>
          <p className="mt-4 mb-0 text-sm leading-normal text-muted">
            Not sure what to charge? Look at three businesses like yours nearby. Soon, Second will show you real
            prices from your area.
          </p>
        </Card>

        <section
          className="on-dark flex flex-col gap-4 rounded-card bg-panel p-[22px] text-on-panel ring-1 ring-ink-line"
          aria-live="polite"
        >
          <div>
            <div className="text-sm text-muted-dark">{Units} a month to cover costs</div>
            <div className="text-[44px] leading-tight font-semibold tracking-[-1px]">{math.toCover}</div>
          </div>
          <div className="h-px bg-ink-track" />
          <div>
            <div className="text-sm text-muted-dark">{Units} a month to hit your goal</div>
            <div className="text-[44px] leading-tight font-semibold tracking-[-1px] text-panel-accent">{math.toGoal}</div>
            <div className="text-sm text-on-dark">{math.perWeek}</div>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 desk:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card
          title="Save before you open"
          aside={
            <span className="text-[15px] font-semibold whitespace-nowrap">
              {formatMoney(moneyPlan.saved)} of {formatMoney(savingsGoal)}
            </span>
          }
        >
          <ProgressBar percent={savedPercent} height="md" label="Saved before you open" className="mt-3 mb-4" />
          <div className="max-w-60">
            <Field label="Saved so far">
              {(id) => <MoneyInput id={id} value={moneyPlan.saved} onChange={(saved) => savePlan({ saved })} />}
            </Field>
          </div>
          <h3 className="mt-5 mb-1 text-[15px] font-semibold">What you need before opening</h3>
          <CostList
            lines={moneyPlan.startupCosts}
            onChange={(startupCosts) => savePlan({ startupCosts })}
            addLabel="Add something"
            emptyText="Add what you need to buy before you open, like equipment and your first supplies."
            ideas={typeInfo.startupCosts}
            fillLabel={`Fill in common startup costs${kindOf}`}
          />
        </Card>

        <TipCard title="Tip from Second" style="eyebrow">
          <p className="mt-2 mb-0 text-base leading-normal text-mint-heading">{MONEY_PLAN_TIP}</p>
        </TipCard>
      </div>
    </PageBody>
  );
}

/** Editable list of named amounts: rename, change amount, remove, add. */
function CostList({
  lines,
  onChange,
  addLabel,
  emptyText,
  ideas,
  fillLabel,
}: {
  lines: CostLine[];
  onChange: (lines: CostLine[]) => void;
  addLabel: string;
  emptyText: string;
  /** Common costs for this kind of business, offered when the list is empty */
  ideas: CostIdea[];
  fillLabel: string;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        className="mt-3"
        text={emptyText}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onChange(ideas.map((c) => ({ ...c, id: newId() })))}>
              {fillLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              weight="medium"
              icon={<Plus size={16} aria-hidden="true" />}
              onClick={() => onChange([{ id: newId(), label: "", amount: 0 }])}
            >
              {addLabel}
            </Button>
          </div>
        }
      />
    );
  }

  const setLine = (id: string, patch: Partial<CostLine>) =>
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  return (
    <div className="mt-2">
      <ul className="m-0 list-none p-0">
        {lines.map((line) => (
          <li key={line.id} className="flex items-center gap-2 border-b border-line-soft py-2">
            <input
              aria-label="What it's for"
              // A row just added with "Add" starts empty: put the cursor there.
              autoFocus={line.label === "" && line.amount === 0}
              value={line.label}
              placeholder="What it's for"
              onChange={(e) => setLine(line.id, { label: e.target.value })}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-1.5 text-[15px] text-ink placeholder:text-muted hover:border-line-strong focus:border-sky"
            />
            <MoneyInput
              label={`Amount for ${line.label || "this cost"}`}
              value={line.amount}
              onChange={(amount) => setLine(line.id, { amount })}
              className="w-[92px] shrink-0"
            />
            <button
              type="button"
              aria-label={`Remove ${line.label || "this cost"}`}
              onClick={() => onChange(lines.filter((l) => l.id !== line.id))}
              className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="py-3">
        <Button
          variant="ghost"
          weight="medium"
          size="sm"
          icon={<Plus size={16} aria-hidden="true" />}
          onClick={() => onChange([...lines, { id: newId(), label: "", amount: 0 }])}
        >
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

