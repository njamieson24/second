"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChefHat,
  Dumbbell,
  Hand,
  House,
  Plus,
  Scissors,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/Button";
import { SecondAvatar } from "@/components/ChatBubble";
import { Field, inputClass, MoneyInput } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { LogoMeet } from "@/components/LogoMeet";
import { ProgressBar } from "@/components/ProgressBar";
import { businessTypes, getBusinessType, type BusinessType } from "@/lib/business-types";
import { RequireAccount, useAppData } from "@/lib/data";
import { addDays, todayISO } from "@/lib/dates";
import { onboardingTaskIds } from "@/lib/roadmap";
import {
  completeTask,
  newId,
  saveBusiness,
  saveMode,
  saveMoneyPlan,
  type Business,
  type Mode,
  type MoneyPlan,
  type Service,
} from "@/lib/store";

const typeIcons: Record<BusinessType, LucideIcon> = {
  massage: Hand,
  food: ChefHat,
  fitness: Dumbbell,
  beauty: Scissors,
  home: House,
  photo: Camera,
  other: Sparkles,
};

type Draft = {
  ownerName: string;
  businessName: string;
  type: BusinessType | null;
  otherLabel: string;
  area: string;
  services: Service[];
  payGoal: number;
  goalNote: string;
  openingDay: string;
};

const STEPS = ["name", "type", "area", "services", "prices", "goal"] as const;

export default function SetupPage() {
  return (
    <RequireAccount>
      <Setup />
    </RequireAccount>
  );
}

function Setup() {
  const data = useAppData();
  const router = useRouter();
  const noMode = data !== null && !data.mode;

  // You pick a mode on /start first.
  useEffect(() => {
    if (noMode) router.replace("/start");
  }, [noMode, router]);

  if (!data?.mode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-muted" role="status">
        Loading…
      </div>
    );
  }
  return <SetupForm mode={data.mode} existing={data.business} hasPlan={data.moneyPlan !== null} />;
}

function draftFrom(existing: Business | null): Draft {
  return {
    ownerName: existing?.ownerName ?? "",
    businessName: existing?.businessName ?? "",
    type: existing?.type ?? null,
    otherLabel: existing?.type === "other" ? existing.typeLabel : "",
    area: existing?.area ?? "",
    services: existing?.services ?? [],
    payGoal: existing?.payGoal ?? 3000,
    goalNote: existing?.goalNote ?? "",
    openingDay: existing?.openingDay ?? addDays(todayISO(), 98),
  };
}

function SetupForm({ mode, existing, hasPlan }: { mode: Mode; existing: Business | null; hasPlan: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(existing));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"next" | "back">("next");
  // Little in-between moments: "Nice to meet you" after the name, "All set" at the end.
  const [interlude, setInterlude] = useState<"hello" | "done" | null>(null);
  const [greeted, setGreeted] = useState(false);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new question so screen readers read it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, interlude]);

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const stepId = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const canContinue = (() => {
    switch (stepId) {
      case "name":
        return draft.ownerName.trim().length > 0;
      case "type":
        return draft.type !== null && (draft.type !== "other" || draft.otherLabel.trim().length > 0);
      case "area":
        return draft.area.trim().length > 0;
      case "services":
        return draft.services.length > 0;
      case "prices":
        return draft.services.every((s) => s.name.trim()) && draft.services[0]?.price > 0;
      case "goal":
        return draft.payGoal > 0 && (mode === "running" || draft.openingDay.length === 10);
    }
  })();

  const hint: Record<(typeof STEPS)[number], string> = {
    name: "Please tell me your name to continue.",
    type: draft.type === "other" ? "Tell me what you do to continue." : "Pick one to continue.",
    area: "Add your town or area to continue.",
    services: "Add at least one service to continue.",
    prices: "Add a price for your main service to continue.",
    goal: mode === "launch" ? "Add a pay goal and an opening day to continue." : "Add a pay goal to continue.",
  };

  async function finish() {
    if (!draft.type) return;
    setSaving(true);
    setInterlude("done");
    const started = Date.now();
    const info = getBusinessType(draft.type);
    const business: Business = {
      ownerName: draft.ownerName.trim(),
      businessName: draft.businessName.trim(),
      type: draft.type,
      typeLabel: draft.type === "other" ? draft.otherLabel.trim() : info.label,
      area: draft.area.trim(),
      services: draft.services.map((s) => ({ ...s, name: s.name.trim() })),
      payGoal: draft.payGoal,
      goalNote: draft.goalNote.trim() || undefined,
      openingDay: mode === "launch" ? draft.openingDay : existing?.openingDay,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      launchedAt: existing?.launchedAt,
    };
    await saveBusiness(business);

    if (!hasPlan) {
      const plan: MoneyPlan = {
        monthlyCosts: info.monthlyCosts.map((c) => ({ ...c, id: newId() })),
        startupCosts: info.startupCosts.map((c) => ({ ...c, id: newId() })),
        saved: 0,
      };
      await saveMoneyPlan(plan);
    }
    if (mode === "launch") {
      for (const id of onboardingTaskIds(business.type)) await completeTask(id);
    }
    await saveMode(mode);
    // Let the "All set" moment play before moving on.
    const linger = prefersReducedMotion() ? 1200 : 2600;
    const wait = Math.max(0, linger - (Date.now() - started));
    setTimeout(() => router.push(mode === "launch" ? "/launch" : "/app"), wait);
  }

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setDir("next");
    if (isLast) finish();
    else if (stepId === "name" && !greeted) {
      setGreeted(true);
      setInterlude("hello");
    } else setStep((s) => s + 1);
  }

  function back() {
    setDir("back");
    setStep((s) => s - 1);
  }

  const continueAfterHello = useCallback(() => {
    setInterlude(null);
    setStep(1);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-4 py-10 desk:py-12">
      <Logo size="lg" />
      <div className="mt-8 w-full max-w-[640px]">
        <div className="mb-2 flex justify-between text-sm text-muted">
          <span>
            Step {step + 1} of {STEPS.length}
          </span>
          <span>{mode === "launch" ? "Setting up your launch plan" : "Setting up your business"}</span>
        </div>
        <ProgressBar percent={((step + 1) / STEPS.length) * 100} label="Setup progress" />

        {interlude ? (
          <Interlude
            kind={interlude}
            name={draft.ownerName.trim()}
            businessName={draft.businessName.trim()}
            mode={mode}
            onContinue={continueAfterHello}
          />
        ) : (
        <form onSubmit={next} className="mt-6 flex flex-col gap-6 overflow-hidden rounded-card border border-line bg-card p-6 desk:p-8">
          <div
            key={step}
            className={`flex flex-col gap-6 motion-reduce:animate-none ${dir === "next" ? "animate-step-next" : "animate-step-back"}`}
          >
          <h1 ref={headingRef} tabIndex={-1} className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px] outline-none">
            {stepId === "name" && "Nice to meet you. What should I call you?"}
            {stepId === "type" && "What kind of business is it?"}
            {stepId === "area" && "Where do you work?"}
            {stepId === "services" && "What do you offer?"}
            {stepId === "prices" && "What do you charge?"}
            {stepId === "goal" && "Last one: what's your goal?"}
          </h1>

          {stepId === "name" && (
            <>
              <Field label="Your first name">
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={draft.ownerName}
                    onChange={(e) => update({ ownerName: e.target.value })}
                    autoComplete="given-name"
                    autoFocus
                  />
                )}
              </Field>
              <Field
                label="Business name (if you have one)"
                help={mode === "launch" ? "No name yet? That's fine. We'll pick one together later." : undefined}
              >
                {(id) => (
                  <input
                    id={id}
                    className={inputClass}
                    value={draft.businessName}
                    onChange={(e) => update({ businessName: e.target.value })}
                    autoComplete="organization"
                  />
                )}
              </Field>
            </>
          )}

          {stepId === "type" && (
            <>
              <div role="radiogroup" aria-label="Kind of business" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {businessTypes.map((t) => {
                  const Icon = typeIcons[t.id];
                  const selected = draft.type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => update({ type: t.id })}
                      className={`flex min-h-16 items-center gap-3 rounded-row px-4 py-3 text-left text-base ${
                        selected ? "border-2 border-sky bg-sky-tint font-medium" : "border border-line-strong bg-card hover:border-ink"
                      }`}
                    >
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${selected ? "bg-card text-sky" : "bg-sky-tint text-sky"}`}
                      >
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      {t.label}
                      {selected && <Check size={20} className="ml-auto text-sky" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
              {draft.type && (
                <div key={draft.type} className="flex items-start gap-3 animate-fade-up motion-reduce:animate-none" aria-live="polite">
                  <SecondAvatar />
                  <p className="m-0 rounded-[6px_18px_18px_18px] border border-line bg-paper px-4 py-3 text-[15px] leading-normal">
                    {draft.type === "other"
                      ? "Great. Tell me a little more and I'll shape everything around it."
                      : `Great choice. I'll shape everything around ${getBusinessType(draft.type).label.toLowerCase()}.`}
                  </p>
                </div>
              )}
              {draft.type === "other" && (
                <Field label="What do you do?" help="A few words is plenty, like “dog grooming” or “tutoring.”">
                  {(id) => (
                    <input
                      id={id}
                      className={inputClass}
                      value={draft.otherLabel}
                      onChange={(e) => update({ otherLabel: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </>
          )}

          {stepId === "area" && (
            <Field label="Your town or area" help="Something like “Asbury Park, NJ” is enough.">
              {(id) => (
                <input
                  id={id}
                  className={inputClass}
                  value={draft.area}
                  onChange={(e) => update({ area: e.target.value })}
                  autoComplete="address-level2"
                  autoFocus
                />
              )}
            </Field>
          )}

          {stepId === "services" && draft.type && <ServicesStep draft={draft} update={update} />}

          {stepId === "prices" && draft.type && <PricesStep draft={draft} update={update} />}

          {stepId === "goal" && (
            <>
              <Field
                label="How much do you want to pay yourself each month?"
                help="What you'd like to take home after costs. A guess is fine."
              >
                {(id) => (
                  <MoneyInput id={id} value={draft.payGoal} onChange={(payGoal) => update({ payGoal })} size="lg" />
                )}
              </Field>
              {mode === "launch" ? (
                <Field label="When would you like to open?" help="You can move this date any time.">
                  {(id) => (
                    <input
                      id={id}
                      type="date"
                      min={todayISO()}
                      className={inputClass}
                      value={draft.openingDay}
                      onChange={(e) => update({ openingDay: e.target.value })}
                    />
                  )}
                </Field>
              ) : (
                <Field label="Anything else you're working toward? (optional)">
                  {(id) => (
                    <input
                      id={id}
                      className={inputClass}
                      placeholder="Like “10 new clients by December”"
                      value={draft.goalNote}
                      onChange={(e) => update({ goalNote: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </>
          )}

          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line-soft pt-5">
            {step > 0 && (
              <Button variant="ghost" weight="medium" onClick={back}>
                Back
              </Button>
            )}
            <button
              type="submit"
              disabled={!canContinue || saving}
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full bg-sky px-6 text-[15px] font-semibold text-on-sky hover:bg-sky-ink disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-muted"
            >
              {isLast ? (saving ? "Saving…" : mode === "launch" ? "Show me my launch plan" : "Take me to my dashboard") : "Next"}
            </button>
            {!canContinue && (
              <p className="m-0 w-full text-right text-sm text-muted" aria-live="polite">
                {hint[stepId]}
              </p>
            )}
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

function ServicesStep({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const [custom, setCustom] = useState("");
  const ideas = getBusinessType(draft.type!).services;
  const chosen = new Set(draft.services.map((s) => s.name.toLowerCase()));

  const toggleIdea = (name: string, price: number, minutes?: number) => {
    if (chosen.has(name.toLowerCase())) {
      update({ services: draft.services.filter((s) => s.name.toLowerCase() !== name.toLowerCase()) });
    } else {
      update({ services: [...draft.services, { id: newId(), name, price, minutes }] });
    }
  };

  const addCustom = () => {
    const name = custom.trim();
    if (!name || chosen.has(name.toLowerCase())) return;
    update({ services: [...draft.services, { id: newId(), name, price: 0 }] });
    setCustom("");
  };

  return (
    <>
      {ideas.length > 0 && (
        <div>
          <p className="mt-0 mb-2.5 text-[15px] text-muted">Tap the ones you offer. Your main one first.</p>
          <div className="flex flex-wrap gap-2">
            {ideas.map((idea) => {
              const on = chosen.has(idea.name.toLowerCase());
              return (
                <button
                  key={idea.name}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleIdea(idea.name, idea.price, idea.minutes)}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-[15px] ${
                    on ? "bg-sky text-on-sky" : "border border-line-strong bg-card text-ink hover:border-ink"
                  }`}
                >
                  {on ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                  {idea.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label={ideas.length > 0 ? "Something else? Add it here" : "Add a service"}>
        {(id) => (
          <div className="flex gap-2">
            <input
              id={id}
              className={inputClass}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button variant="ghost" weight="medium" onClick={addCustom}>
              Add
            </Button>
          </div>
        )}
      </Field>

      {draft.services.length > 0 && (
        <div>
          <h2 className="mt-0 mb-2 text-[15px] font-semibold">Your services</h2>
          <ul className="m-0 list-none p-0">
            {draft.services.map((s, i) => (
              <li key={s.id} className="flex min-h-11 items-center justify-between gap-3 border-b border-line-soft text-[15px]">
                <span>
                  {s.name}
                  {i === 0 && <span className="ml-2 text-sm text-muted">(main)</span>}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${s.name}`}
                  onClick={() => update({ services: draft.services.filter((x) => x.id !== s.id) })}
                  className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-line-soft hover:text-ink"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function PricesStep({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  const info = getBusinessType(draft.type!);
  const setService = (id: string, patch: Partial<Service>) =>
    update({ services: draft.services.map((s) => (s.id === id ? { ...s, ...patch } : s)) });

  return (
    <>
      <p className="m-0 text-[15px] text-muted">
        I filled in common prices near you as a start. Change them to what you really charge. Your first one is your
        main {info.unit}, and your money plan uses its price.
      </p>
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {draft.services.map((s, i) => (
          <li key={s.id} className="rounded-row border border-line p-4">
            <div className="text-base font-medium">
              {s.name}
              {i === 0 && <span className="ml-2 text-sm font-normal text-muted">(main)</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Price">
                {(id) => <MoneyInput id={id} value={s.price} onChange={(price) => setService(s.id, { price })} />}
              </Field>
              <Field label="Minutes (optional)">
                {(id) => (
                  <input
                    id={id}
                    inputMode="numeric"
                    className={inputClass}
                    value={s.minutes ?? ""}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
                      setService(s.id, { minutes: Number.isFinite(n) ? n : undefined });
                    }}
                  />
                )}
              </Field>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The in-between moment: animated logo and a warm line. */
function Interlude({
  kind,
  name,
  businessName,
  mode,
  onContinue,
}: {
  kind: "hello" | "done";
  name: string;
  businessName: string;
  mode: Mode;
  onContinue: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    if (kind !== "hello") return;
    // Moves on by itself, or right away with the button.
    const timer = setTimeout(onContinue, prefersReducedMotion() ? 2200 : 3200);
    return () => clearTimeout(timer);
  }, [kind, onContinue]);

  const hello = kind === "hello";
  const line = hello
    ? businessName
      ? mode === "launch"
        ? `Let's get ${businessName} ready for opening day.`
        : `Let's help ${businessName} grow.`
      : "I'm Second, your business partner. I'll be right here with you."
    : mode === "launch"
      ? "Your launch plan is ready. Taking you there now…"
      : "Your dashboard is ready. Taking you there now…";

  return (
    <section
      role="status"
      className="mt-6 flex min-h-[420px] flex-col items-center justify-center gap-6 overflow-hidden rounded-card border border-line bg-card px-6 py-12 text-center"
    >
      <LogoMeet confetti={!hello} />
      <div className="flex flex-col items-center gap-2">
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="m-0 text-[32px] leading-tight font-semibold tracking-[-0.8px] outline-none animate-fade-up [animation-delay:500ms] motion-reduce:animate-none"
        >
          {hello ? `Nice to meet you, ${name}!` : `You're all set, ${name}!`}
        </h1>
        <p className="m-0 max-w-md text-[17px] leading-normal text-muted animate-fade-up [animation-delay:750ms] motion-reduce:animate-none">
          {line}
        </p>
        {hello && (
          <p className="m-0 text-[15px] text-muted animate-fade-up [animation-delay:950ms] motion-reduce:animate-none">
            Just a few quick questions.
          </p>
        )}
      </div>
      {hello && (
        <div className="animate-fade-up [animation-delay:1100ms] motion-reduce:animate-none">
          <Button onClick={onContinue} arrow>
            Let&apos;s go
          </Button>
        </div>
      )}
    </section>
  );
}
