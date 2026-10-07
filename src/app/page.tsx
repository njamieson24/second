"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  ChefHat,
  Dumbbell,
  Hand,
  House,
  Mail,
  Map,
  MessageCircle,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sprout,
  Store,
  Footprints,
  Tag,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/Button";
import { HomeDemo } from "@/components/HomeDemo";
import { Logo } from "@/components/Logo";
import { LogoMeet } from "@/components/LogoMeet";
import { Reveal } from "@/components/Reveal";
import { RotatingWord } from "@/components/RotatingWord";
import { ThemeToggle } from "@/components/ThemeToggle";
import { homeFor, useAppData } from "@/lib/data";
import { startDemo } from "@/lib/store";

// The front door: what Second is. "Get started" makes an account; "Try the demo" needs none.

const madeFor = [
  "massage therapists",
  "caterers",
  "personal trainers",
  "hairstylists",
  "house cleaners",
  "photographers",
  "people great at their craft",
];

const steps = [
  {
    title: "Tell Second about your business",
    text: "A few friendly questions: what you do, where, and what you charge. About 2 minutes.",
  },
  {
    title: "Second makes the plan",
    text: "A clear, step-by-step plan in plain English. Second drafts the emails, posts, and numbers for you.",
  },
  {
    title: "You say yes",
    text: "Look it over and approve. Nothing gets sent, posted, or filed without you.",
  },
];

const trades: { label: string; icon: LucideIcon }[] = [
  { label: "Massage and wellness", icon: Hand },
  { label: "Food and catering", icon: ChefHat },
  { label: "Personal trainers", icon: Dumbbell },
  { label: "Hair and beauty", icon: Scissors },
  { label: "Cleaning and home services", icon: House },
  { label: "Photographers", icon: Camera },
];

const helps: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "A roadmap to opening day", text: "Licenses, taxes, and insurance, explained simply, one small step at a time.", icon: Map },
  { title: "What to charge", text: "How many clients you need to cover costs and pay yourself.", icon: Tag },
  { title: "Finding new clients", text: "Second finds local places to partner with and writes the emails.", icon: Mail },
  { title: "Social posts, written", text: "A week of posts with photo ideas. Copy, paste, done.", icon: Camera },
  { title: "Money, kept simple", text: "What came in, what went out, and what you kept this month.", icon: Wallet },
  { title: "Ask anything", text: "No question is too basic. Ask in your own words.", icon: MessageCircle },
];

const promises: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "You're always in charge", text: "Second prepares. You decide. Nothing goes out without your okay.", icon: ShieldCheck },
  { title: "Plain English, always", text: "No business jargon. Any tricky word gets explained.", icon: MessageCircle },
  { title: "One clear next step", text: "You never have to wonder what to do next. Second tells you.", icon: Footprints },
];

export default function HomePage() {
  const data = useAppData();
  const router = useRouter();
  const home = data?.account ? homeFor(data) : null;
  const tryDemo = async () => {
    await startDemo();
    router.push("/app");
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-paper text-ink">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1120px] items-center gap-3 px-4 desk:px-8">
          <Link href="/" className="rounded-lg no-underline" aria-label="Second, home">
            <Logo />
          </Link>
          <nav aria-label="Page sections" className="ml-6 hidden gap-1 desk:flex">
            <a href="#how" className="rounded-full px-3 py-2.5 text-[15px] text-muted no-underline hover:text-ink">
              How it works
            </a>
            <a href="#modes" className="rounded-full px-3 py-2.5 text-[15px] text-muted no-underline hover:text-ink">
              Two ways to start
            </a>
            <a href="#promise" className="rounded-full px-3 py-2.5 text-[15px] text-muted no-underline hover:text-ink">
              Our promise
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {home ? (
              <Button href={home} variant="ghost" weight="medium" pad="tight" className="max-sm:hidden">
                {data?.account?.kind === "demo" ? "Back to the demo" : "Open my dashboard"}
              </Button>
            ) : (
              <Button href="/login" variant="ghost" weight="medium" pad="tight">
                Log in
              </Button>
            )}
            <Button href="/signup" className="max-sm:hidden">
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-[1120px] grid-cols-1 items-center gap-12 px-4 pt-12 pb-16 desk:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] desk:px-8 desk:pt-20 desk:pb-24">
          <div className="flex flex-col items-start gap-6">
            <LogoMeet width={88} surface="paper" />
            <p className="m-0 inline-flex items-center gap-1.5 rounded-chip bg-mint-tint px-3 py-1.5 text-[15px] font-semibold text-mint-deep">
              Made for <RotatingWord words={madeFor} />
            </p>
            <h1 className="m-0 text-[42px] leading-[1.05] font-semibold tracking-[-1.4px] desk:text-[60px] desk:tracking-[-2px]">
              Your business partner, in your pocket.
            </h1>
            <p className="m-0 max-w-[540px] text-lg leading-normal text-muted desk:text-xl">
              You&apos;re great at what you do. Second handles the business side: the plan, the paperwork, the
              pricing, finding clients, and keeping track of money. It does most of the work, and asks you before
              anything goes out.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/signup" size="lg" arrow>
                Get started
              </Button>
              {home ? (
                <Button href={home} size="lg" variant="ghost" weight="medium">
                  Continue where I left off
                </Button>
              ) : (
                <Button size="lg" variant="ghost" weight="medium" onClick={tryDemo}>
                  Try the demo
                </Button>
              )}
            </div>
            <p className="m-0 text-sm text-muted">Free to try. The demo needs no account.</p>
          </div>

          <HomeDemo />
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-line bg-card">
          <div className="mx-auto max-w-[1120px] px-4 py-16 desk:px-8 desk:py-20">
            <Reveal>
              <SectionTitle eyebrow="How it works" title="Three steps. Second does the heavy lifting." />
            </Reveal>
            <ol className="m-0 mt-10 grid list-none grid-cols-1 gap-6 p-0 desk:grid-cols-3">
              {steps.map((step, i) => (
                <li key={step.title}>
                <Reveal delay={i * 120} className="flex h-full flex-col gap-3 rounded-card border border-line bg-paper p-6">
                  <span className="flex size-11 items-center justify-center rounded-full bg-sky text-lg font-semibold text-on-sky">
                    {i + 1}
                  </span>
                  <h3 className="m-0 text-xl font-semibold">{step.title}</h3>
                  <p className="m-0 text-base leading-normal text-muted">{step.text}</p>
                </Reveal>
                </li>
              ))}
            </ol>

            <ul className="m-0 mt-12 grid list-none grid-cols-1 gap-x-8 gap-y-6 p-0 sm:grid-cols-2 desk:grid-cols-3">
              {helps.map((h) => (
                <li key={h.title} className="flex gap-3.5">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-tint text-sky">
                    <h.icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="m-0 text-[17px] font-semibold">{h.title}</h3>
                    <p className="mt-1 mb-0 text-[15px] leading-normal text-muted">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Two modes */}
        <section id="modes" className="scroll-mt-20 mx-auto max-w-[1120px] px-4 py-16 desk:px-8 desk:py-20">
          <Reveal>
          <SectionTitle
            eyebrow="Two ways to start"
            title="Wherever you are, Second meets you there."
            text="Just starting out, or already open? Pick one when you get started. You can switch any time."
          />
          </Reveal>
          <Reveal className="mt-10 grid grid-cols-1 gap-6 desk:grid-cols-2">
            <ModeCard
              dark
              icon={Sprout}
              title="Not open yet"
              text="For an idea or a business that's about to open."
              points={[
                "A step-by-step roadmap to opening day",
                "What to charge and how much to save",
                "Name, logo, and a simple website",
                "Getting ready for your first clients",
              ]}
            />
            <ModeCard
              icon={Store}
              title="Already open"
              text="For a business that already has clients."
              points={[
                "A weekly game plan, drafted for you",
                "Finding new clients nearby",
                "Tracking your money",
                "Social posts written for you",
              ]}
            />
          </Reveal>
          <p className="mt-6 mb-0 text-center text-[15px] text-muted">
            When you open your doors, Second moves everything you built over to your new dashboard.
          </p>
        </section>

        {/* Who it's for */}
        <section className="border-y border-line bg-card">
          <div className="mx-auto max-w-[1120px] px-4 py-14 desk:px-8">
            <Reveal>
              <SectionTitle eyebrow="Who it's for" title="Made for local, hands-on businesses." />
            </Reveal>
            <ul className="m-0 mt-8 flex list-none flex-wrap justify-center gap-3 p-0">
              {trades.map((t) => (
                <li
                  key={t.label}
                  className="flex min-h-12 items-center gap-2.5 rounded-full border border-line bg-paper px-5 text-base"
                >
                  <t.icon size={18} className="text-sky" aria-hidden="true" />
                  {t.label}
                </li>
              ))}
              <li className="flex min-h-12 items-center gap-2.5 rounded-full border border-dashed border-line-strong px-5 text-base text-muted">
                <Sparkles size={18} aria-hidden="true" />
                And more
              </li>
            </ul>
          </div>
        </section>

        {/* Promise */}
        <section id="promise" className="scroll-mt-20 mx-auto max-w-[1120px] px-4 py-16 desk:px-8 desk:py-20">
          <Reveal>
            <SectionTitle eyebrow="Our promise" title="Like a mentor who ran a shop for 30 years." />
          </Reveal>
          <ul className="m-0 mt-10 grid list-none grid-cols-1 gap-6 p-0 desk:grid-cols-3">
            {promises.map((p, i) => (
              <li key={p.title}>
              <Reveal delay={i * 120} className="h-full rounded-card bg-mint-tint p-6 text-mint-heading">
                <p.icon size={26} className="text-mint-deep" aria-hidden="true" />
                <h3 className="mt-3 mb-0 text-xl font-semibold">{p.title}</h3>
                <p className="mt-1.5 mb-0 text-base leading-normal">{p.text}</p>
              </Reveal>
              </li>
            ))}
          </ul>
        </section>

        {/* Final call to action */}
        <section className="mx-auto max-w-[1120px] px-4 pb-16 desk:px-8 desk:pb-24">
          <Reveal className="on-dark flex flex-col items-center gap-5 rounded-hero bg-panel px-6 py-14 text-center text-on-panel ring-1 ring-ink-line">
            <LogoMeet width={110} surface="panel" />
            <h2 className="m-0 text-[32px] leading-tight font-semibold tracking-[-0.8px] desk:text-[40px]">
              Ready when you are.
            </h2>
            <p className="m-0 max-w-[520px] text-lg leading-normal text-on-dark">
              Answer a few questions and Second will have your plan ready in about two minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button href="/signup" size="lg" variant="mint" arrow>
                Get started
              </Button>
              <Button size="lg" variant="ghost-dark" weight="medium" onClick={tryDemo}>
                Try the demo
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-6 gap-y-4 px-4 py-8 desk:px-8">
          <div className="flex flex-col gap-1">
            <Logo />
            <span className="text-sm text-muted">Your business partner, in your pocket.</span>
          </div>
          <ThemeToggle tone="page" className="ml-auto w-[260px] max-w-full" />
          <p className="m-0 w-full text-[13px] text-muted">© {new Date().getFullYear()} Second</p>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mx-auto flex max-w-[680px] flex-col items-center gap-3 text-center">
      <span className="text-sm font-semibold text-sky-ink">{eyebrow}</span>
      <h2 className="m-0 text-[32px] leading-tight font-semibold tracking-[-0.8px] desk:text-[40px] desk:tracking-[-1px]">
        {title}
      </h2>
      {text && <p className="m-0 text-lg leading-normal text-muted">{text}</p>}
    </div>
  );
}

function ModeCard({
  dark,
  icon: Icon,
  title,
  text,
  points,
}: {
  dark?: boolean;
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
}) {
  return (
    <div
      className={`flex flex-col gap-4 rounded-hero p-7 ${
        dark ? "on-dark border-2 border-mint bg-panel text-on-panel" : "border border-line bg-card"
      }`}
    >
      <span
        className={`flex size-14 items-center justify-center rounded-[18px] ${dark ? "bg-ink-line" : "bg-sky-tint"}`}
      >
        <Icon size={28} aria-hidden="true" className={dark ? "text-panel-accent" : "text-sky"} />
      </span>
      <div>
        <h3 className="m-0 text-[26px] font-semibold tracking-[-0.5px]">{title}</h3>
        <p className={`mt-1 mb-0 text-base ${dark ? "text-on-dark" : "text-muted"}`}>{text}</p>
      </div>
      <ul className={`m-0 flex list-none flex-col gap-3 border-t pt-4 pl-0 ${dark ? "border-ink-track" : "border-line"}`}>
        {points.map((p) => (
          <li key={p} className="flex items-center gap-3 text-base">
            <Check size={18} strokeWidth={2.6} aria-hidden="true" className={dark ? "text-panel-accent" : "text-sky"} />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}
