"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Handshake, MapPin, Sparkles } from "lucide-react";
import { authInputClass, FormMessage, SubmitButton } from "@/components/AuthShell";
import { Logo, LogoMark } from "@/components/Logo";
import { TextLink } from "@/components/TextLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BETA_LIMITS, BETA_STAGES, checkBetaSignup, type BetaProblems, type BetaSignup } from "@/lib/beta";
import { businessTypes } from "@/lib/business-types";
import { joinBeta } from "@/lib/store";

const empty: BetaSignup = { name: "", email: "", businessName: "", businessType: "", town: "", stage: "" };

// Order the problems are checked in, so we can jump to the first one.
const FIELD_ORDER: (keyof BetaSignup)[] = ["name", "email", "businessName", "businessType", "town", "stage"];

export function BetaPage() {
  const [done, setDone] = useState(false);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-4 desk:px-8">
          <Link href="/" className="rounded-lg no-underline" aria-label="Second, home">
            <Logo />
          </Link>
          <TextLink href="/login" className="ml-auto inline-flex min-h-11 items-center px-1 text-[15px]">
            Log in
          </TextLink>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1120px] flex-1 grid-cols-1 items-start gap-8 px-4 pt-8 pb-12 desk:grid-cols-[minmax(0,1fr)_minmax(0,460px)] desk:gap-14 desk:px-8 desk:pt-16 desk:pb-20">
        <section className="flex flex-col items-start gap-5 desk:pt-4">
          <p className="m-0 inline-flex items-center gap-1.5 rounded-chip bg-mint-tint px-3 py-1.5 text-[14px] font-semibold text-mint-deep">
            <Sparkles size={16} aria-hidden="true" />
            Free beta
          </p>
          <h1 className="m-0 text-[36px] leading-[1.08] font-semibold tracking-[-1.1px] desk:text-[52px] desk:tracking-[-1.8px]">
            Be one of the first 25 businesses on Second.
          </h1>
          <p className="m-0 text-[18px] leading-normal text-ink-soft desk:text-[20px]">
            Second is a business partner in your pocket. It plans the busywork, drafts the emails and posts, and you just
            say yes.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0 text-[16px] leading-normal text-ink-soft desk:text-[17px]">
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-tint text-sky-ink">
                <Handshake size={17} aria-hidden="true" />
              </span>
              <span>
                Beta members also get connected with other local businesses near them, so you can send each other
                customers.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-tint text-sky-ink">
                <MapPin size={17} aria-hidden="true" />
              </span>
              <span>We&apos;re starting at the Jersey Shore.</span>
            </li>
          </ul>
        </section>

        <div className="w-full">{done ? <ThankYou /> : <SignupForm onDone={() => setDone(true)} />}</div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-4 px-4 py-6 desk:px-8">
          <TextLink href="/" className="text-[15px] font-normal">
            What is Second?
          </TextLink>
          <ThemeToggle tone="page" className="ml-auto w-[260px] max-w-full" />
        </div>
      </footer>
    </div>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState<BetaSignup>(empty);
  const [problems, setProblems] = useState<BetaProblems>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  const set = (key: keyof BetaSignup) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear a field's problem as soon as they fix it.
    if (problems[key]) {
      const rest = { ...problems, [key]: undefined };
      setProblems(rest);
      // Everything fixed: drop the "Almost there" note too.
      if (!Object.values(rest).some(Boolean)) setMessage(null);
    }
  };

  function showProblems(found: BetaProblems) {
    setProblems(found);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const found = checkBetaSignup(form);
    if (Object.keys(found).length > 0) {
      setMessage("Almost there. Please check the answers marked below.");
      return showProblems(found);
    }
    setBusy(true);
    const result = await joinBeta(form, honeypot.current?.value ?? "");
    setBusy(false);
    if (result.ok) return onDone();
    setMessage(result.message);
    if (result.problems) showProblems(result.problems);
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5 rounded-card border border-line bg-card p-5 desk:p-7"
      aria-labelledby="beta-form-title"
    >
      <div>
        <h2 id="beta-form-title" className="m-0 text-[22px] font-semibold tracking-[-0.4px]">
          Save my spot
        </h2>
        <p className="mt-1 mb-0 text-[15px] text-muted">Takes about a minute. It&apos;s free.</p>
      </div>

      {message && <FormMessage tone="error">{message}</FormMessage>}

      <TextField
        id="beta-name"
        field="name"
        label="Your name"
        autoComplete="name"
        value={form.name}
        onChange={set("name")}
        problem={problems.name}
        max={BETA_LIMITS.name}
      />
      <TextField
        id="beta-email"
        field="email"
        label="Your email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={form.email}
        onChange={set("email")}
        problem={problems.email}
        max={BETA_LIMITS.email}
      />
      <TextField
        id="beta-business"
        field="businessName"
        label="Business name (optional)"
        autoComplete="organization"
        value={form.businessName}
        onChange={set("businessName")}
        problem={problems.businessName}
        max={BETA_LIMITS.businessName}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="beta-type" className="text-[16px] font-medium">
          Type of business
        </label>
        <div className="relative">
          <select
            id="beta-type"
            data-field="businessType"
            value={form.businessType}
            onChange={(e) => set("businessType")(e.target.value)}
            aria-invalid={problems.businessType ? true : undefined}
            aria-describedby={problems.businessType ? "beta-type-problem" : undefined}
            className={`${authInputClass} appearance-none pr-12 ${form.businessType ? "" : "text-muted"}`}
          >
            <option value="" disabled>
              Pick the closest one
            </option>
            {businessTypes.map((t) => (
              <option key={t.id} value={t.id} className="text-ink">
                {t.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
          />
        </div>
        <Problem id="beta-type-problem" text={problems.businessType} />
      </div>

      <TextField
        id="beta-town"
        field="town"
        label="Your town"
        autoComplete="address-level2"
        value={form.town}
        onChange={set("town")}
        problem={problems.town}
        max={BETA_LIMITS.town}
      />

      <fieldset
        className="m-0 flex flex-col gap-2.5 border-0 p-0"
        aria-describedby={problems.stage ? "beta-stage-problem" : undefined}
      >
        <legend className="mb-1.5 p-0 text-[16px] font-medium">Which sounds like you?</legend>
        {BETA_STAGES.map((stage, i) => (
          <label
            key={stage.id}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-row border border-line-strong bg-card px-4 text-[16px] has-[:checked]:border-sky has-[:checked]:bg-sky-tint has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-sky"
          >
            <input
              type="radio"
              name="stage"
              value={stage.id}
              checked={form.stage === stage.id}
              onChange={() => set("stage")(stage.id)}
              data-field={i === 0 ? "stage" : undefined}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-on-sky peer-checked:border-sky peer-checked:bg-sky"
            >
              {form.stage === stage.id && <Check size={14} strokeWidth={3} />}
            </span>
            {stage.label}
          </label>
        ))}
        <Problem id="beta-stage-problem" text={problems.stage} />
      </fieldset>

      {/* Honeypot: hidden from people and screen readers. Bots fill it in; the server then saves nothing. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="beta-website">Leave this empty</label>
        <input ref={honeypot} id="beta-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <SubmitButton busy={busy} busyLabel="Saving your spot…">
        Save my spot
      </SubmitButton>
      <p className="m-0 text-center text-[14px] text-muted">
        We&apos;ll only use your email to talk with you about the beta.
      </p>
    </form>
  );
}

function TextField({
  id,
  field,
  label,
  value,
  onChange,
  problem,
  max,
  type = "text",
  inputMode,
  autoComplete,
}: {
  id: string;
  field: keyof BetaSignup;
  label: string;
  value: string;
  onChange: (value: string) => void;
  problem?: string;
  max: number;
  type?: "text" | "email";
  inputMode?: "text" | "email";
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[16px] font-medium">
        {label}
      </label>
      <input
        id={id}
        data-field={field}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={problem ? true : undefined}
        aria-describedby={problem ? `${id}-problem` : undefined}
        className={authInputClass}
      />
      <Problem id={`${id}-problem`} text={problem} />
    </div>
  );
}

function Problem({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} className="m-0 text-[15px] font-medium text-amber-ink">
      {text}
    </p>
  );
}

function ThankYou() {
  // Move focus here so screen readers read it and phones scroll to it.
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4 rounded-card bg-mint-tint p-6 text-mint-heading desk:p-8"
    >
      <LogoMark tone="mint" width={56} />
      <h2 ref={heading} tabIndex={-1} className="m-0 text-[28px] leading-tight font-semibold tracking-[-0.6px] outline-none">
        You&apos;re on the list!</h2>
      <p className="m-0 text-[18px] leading-normal">I&apos;ll reach out soon. - Noah</p>
      <TextLink href="/" className="inline-flex min-h-11 items-center text-[16px]">
        See what Second does
      </TextLink>
    </div>
  );
}
