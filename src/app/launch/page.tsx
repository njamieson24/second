"use client";

import { MessageCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { HeroCard, HeroRow } from "@/components/HeroCard";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { RoadmapStepper } from "@/components/RoadmapStepper";
import { TextLink } from "@/components/TextLink";
import { TipCard } from "@/components/TipCard";
import { useLoadedData, useRoadmap } from "@/lib/data";
import { dayLabel, daysUntil, longDate } from "@/lib/dates";
import { brandKit, launchQuestions } from "@/lib/mock-data";
import { formatMoney, sessionMath, sumCosts } from "@/lib/money";
import { initialsOf } from "@/lib/text";

export default function LaunchHomePage() {
  const { business, moneyPlan, typeInfo } = useLoadedData();
  const roadmap = useRoadmap();
  const main = business.services[0];
  const math = sessionMath(moneyPlan, main?.price ?? 0, business.payGoal);
  const savingsGoal = sumCosts(moneyPlan.startupCosts);
  const savedPercent = savingsGoal > 0 ? Math.min(100, Math.round((moneyPlan.saved / savingsGoal) * 100)) : 0;
  const days = business.openingDay ? daysUntil(business.openingDay) : null;
  const nextSteps = roadmap.nextTasks(3);

  return (
    <PageBody>
      <PageHeader
        eyebrow={longDate()}
        title={`Let's keep building, ${business.ownerName}`}
        actions={
          <Button href="/chat" icon={<MessageCircle size={18} aria-hidden="true" />}>
            Ask Second
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <HeroCard
          eyebrow="Your launch plan"
          meta={`Step ${roadmap.currentIndex + 1} of ${roadmap.stages.length}`}
          heading={
            roadmap.allDone ? "Everything's done. You're ready to open!" : `You're ${roadmap.percent}% of the way to opening day`
          }
        >
          <RoadmapStepper
            stages={roadmap.stages.map((stage, i) => ({
              label: stage.label,
              status: roadmap.statuses[i],
              href: `/launch/roadmap?stage=${stage.id}`,
            }))}
          />
          {roadmap.allDone ? (
            <div>
              <Button href="/launched" variant="mint" icon={<PartyPopper size={18} aria-hidden="true" />}>
                I&apos;m open!
              </Button>
            </div>
          ) : (
            <>
              <h3 className="mt-1 mb-0 text-sm font-semibold text-on-dark">Your next steps</h3>
              {nextSteps.map(({ task, stage }, i) => (
                <HeroRow
                  key={task.id}
                  n={i + 1}
                  title={task.title}
                  detail={task.detail}
                  action={
                    <Button
                      href={`/launch/roadmap?stage=${stage.id}&task=${task.id}`}
                      variant={i === 0 ? "mint" : "ghost-dark"}
                    >
                      {i === 0 ? "Start" : "Show me how"}
                    </Button>
                  }
                />
              ))}
            </>
          )}
        </HeroCard>

        <div className="flex flex-col gap-6">
          <Card
            title="Opening day"
            aside={
              days === null ? null : days >= 0 ? (
                <Chip tone="mint">{days === 0 ? "Today!" : "On track"}</Chip>
              ) : (
                <Chip tone="neutral">Date passed</Chip>
              )
            }
          >
            {business.openingDay && days !== null ? (
              <>
                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="text-[52px] leading-none font-semibold tracking-[-1.5px]">{Math.max(days, 0)}</span>
                  <span className="text-[17px] text-muted">{days === 1 ? "day to go" : "days to go"}</span>
                </div>
                <p className="mt-1.5 mb-0 text-[15px] text-muted">Target: {dayLabel(business.openingDay, true)}</p>
              </>
            ) : (
              <p className="mt-3 mb-0 text-[15px] text-muted">No date picked yet.</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line-soft pt-4">
              <span className="text-[15px] text-muted">Already open?</span>
              <Button href="/launched" variant="ghost" weight="medium" size="sm" icon={<PartyPopper size={16} aria-hidden="true" />}>
                I&apos;m open!
              </Button>
            </div>
          </Card>

          <Card title="Your money plan">
            <p className="mt-2.5 mb-0 text-[15px] leading-normal">
              About{" "}
              <b className="font-semibold">
                {math.toCover} {math.toCover === 1 ? typeInfo.unit : typeInfo.units} a month
              </b>{" "}
              cover your costs. About <b className="font-semibold">{math.toGoal} a month</b> hits your{" "}
              {formatMoney(business.payGoal)} goal.
            </p>
            {savingsGoal > 0 && (
              <div className="mt-3.5">
                <div className="flex justify-between text-sm text-muted">
                  <span>Saved for launch</span>
                  <span className="font-semibold text-ink">
                    {formatMoney(moneyPlan.saved)} of {formatMoney(savingsGoal)}
                  </span>
                </div>
                <ProgressBar percent={savedPercent} label="Saved for launch" className="mt-2" />
              </div>
            )}
            <p className="mt-3.5 mb-0 text-sm">
              <TextLink href="/launch/money">Open money plan</TextLink>
            </p>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 desk:grid-cols-3">
        <Card title="Your business so far">
          <dl className="mt-3.5 mb-0 flex flex-col gap-3 text-[15px]">
            <div>
              <dt className="text-[13px] text-muted">Name</dt>
              <dd className="m-0 font-medium">{business.businessName || "Not picked yet"}</dd>
            </div>
            <div>
              <dt className="text-[13px] text-muted">Services</dt>
              <dd className="m-0">{business.services.map((s) => s.name).join(", ")}</dd>
            </div>
            {main && (
              <div>
                <dt className="text-[13px] text-muted">Starting price</dt>
                <dd className="m-0">
                  {formatMoney(main.price)}
                  {main.minutes ? ` for ${main.minutes} minutes` : ` per ${typeInfo.unit}`}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-[13px] text-muted">Where</dt>
              <dd className="m-0">{business.area}</dd>
            </div>
          </dl>
          <p className="mt-3.5 mb-0 text-sm">
            <TextLink href="/start/setup">Change my answers</TextLink>
          </p>
        </Card>

        <BrandKitCard name={business.businessName} />

        <TipCard title="Common questions right now" className="flex flex-col gap-2.5">
          {launchQuestions.map((q) => (
            <button
              key={q}
              type="button"
              className="min-h-12 rounded-[14px] bg-card px-3.5 py-3 text-left text-[15px] text-mint-heading hover:bg-paper"
            >
              {q}
            </button>
          ))}
          <div>
            <Button href="/chat" variant="green">
              Ask Second
            </Button>
          </div>
        </TipCard>
      </div>
    </PageBody>
  );
}

function BrandKitCard({ name }: { name: string }) {
  return (
    <Card title="Brand kit">
      <div className="my-3.5 flex items-center gap-3.5">
        <div
          className="flex size-16 items-center justify-center rounded-[18px] text-2xl font-semibold"
          style={{ background: brandKit.logoBackground, color: brandKit.logoText }}
          aria-label="Logo draft"
          role="img"
        >
          {name ? initialsOf(name) : "?"}
        </div>
        <div className="flex gap-1.5">
          {brandKit.colors.map((c) => (
            <span
              key={c.hex}
              className={`size-[26px] rounded-full ${c.light ? "border border-line" : ""}`}
              style={{ background: c.hex }}
              title={c.name}
            />
          ))}
        </div>
      </div>
      {brandKit.items.map((item, i) => (
        <div
          key={item.label}
          className={`flex items-center justify-between gap-3 border-t border-line-soft text-[15px] ${
            i === brandKit.items.length - 1 ? "pt-[9px]" : "py-[9px]"
          }`}
        >
          <span>{item.label}</span>
          <Chip tone={item.tone}>{item.status}</Chip>
        </div>
      ))}
    </Card>
  );
}
