// The launch roadmap: 7 stages, each with small tasks. Pure data and math.
// Which tasks are done is saved by store.ts (getTasks / completeTask).

import { getBusinessType, type BusinessType } from "./business-types";

export type TaskChoice = { name: string; text: string; note?: string };

export type RoadmapTask = {
  id: string;
  title: string;
  /** One short line under the title */
  detail: string;
  minutes: number;
  /** Plain-English explanation shown when the task is opened */
  explainer: string;
  secondsTake?: string;
  choices?: TaskChoice[];
  /** Official site where the user does it themselves */
  link?: { label: string; url: string };
  /** A page in the app that helps with this task */
  action?: { label: string; href: string };
  /** Checked off automatically when onboarding is finished */
  doneByOnboarding?: boolean;
};

export type RoadmapStage = {
  id: string;
  label: string;
  intro: string;
  why: string;
  tasks: RoadmapTask[];
};

export type StageStatus = "done" | "current" | "upcoming";

export function getStages(type: BusinessType): RoadmapStage[] {
  const license = getBusinessType(type).license;

  return [
    {
      id: "idea",
      label: "Idea",
      intro: "Get clear on what you offer and who it's for. About 1 hour total.",
      why: "A clear idea makes every later step easier: pricing, your name, even what to post.",
      tasks: [
        {
          id: "idea-describe",
          title: "Tell Second about your business",
          detail: "What you do, where, and what you charge.",
          minutes: 5,
          explainer: "You did this when you set up Second. You can change your answers any time in Settings.",
          doneByOnboarding: true,
        },
        {
          id: "idea-who",
          title: "Decide who you want to serve",
          detail: "Picture your favorite kind of client.",
          minutes: 20,
          explainer:
            "Think about the people you most enjoy helping. Busy parents? Athletes? Older folks? You can serve anyone, but knowing your favorites helps you find them.",
          secondsTake: "Write down three real people you'd love to have as clients. That's your target.",
        },
        {
          id: "idea-nearby",
          title: "Look at who else nearby does this",
          detail: "Check 3 local businesses like yours.",
          minutes: 30,
          explainer:
            "Search online for businesses like yours in your area. Note their prices, what they offer, and what their reviews say. You're not copying. You're learning what people like.",
          link: { label: "Search Google Maps", url: "https://www.google.com/maps" },
        },
      ],
    },
    {
      id: "plan",
      label: "Plan",
      intro: "Know your numbers before you open. About 45 minutes total.",
      why: "When you know your costs and prices, you know how many clients you need. No guessing.",
      tasks: [
        {
          id: "plan-prices",
          title: "Set your prices",
          detail: "You can change them any time.",
          minutes: 10,
          explainer: "You set these during setup. Check them against the local range on your money plan.",
          action: { label: "Open money plan", href: "/launch/money" },
          doneByOnboarding: true,
        },
        {
          id: "plan-goal",
          title: "Set your monthly pay goal",
          detail: "What you want to pay yourself.",
          minutes: 5,
          explainer: "This is the money you take home after costs. Second uses it to figure out how many clients you need.",
          action: { label: "Open money plan", href: "/launch/money" },
          doneByOnboarding: true,
        },
        {
          id: "plan-costs",
          title: "List your monthly costs",
          detail: "Supplies, insurance, apps, marketing.",
          minutes: 20,
          explainer:
            "Open your money plan and tap \"Fill in common costs\" for a quick start, then change the numbers to match your real ones.",
          action: { label: "Open money plan", href: "/launch/money" },
        },
        {
          id: "plan-date",
          title: "Pick your opening day",
          detail: "A real date keeps you moving.",
          minutes: 5,
          explainer: "You picked a target date during setup. It's fine to move it. Having one is what matters.",
          doneByOnboarding: true,
        },
      ],
    },
    {
      id: "official",
      label: "Make it official",
      intro:
        "Four things that make your business real to the government, your bank, and your clients. About 2 hours total.",
      why: "Making it official lets you open a business bank account, keep your money separate, and look professional to clients.",
      tasks: [
        {
          id: "official-structure",
          title: "Choose your business structure",
          detail: "Explained simply.",
          minutes: 5,
          explainer: "This is how the government sees your business. Most people pick one of these two.",
          choices: [
            {
              name: "Sole proprietor",
              text: "The simplest way to start. You and the business are treated as one for taxes. Little or no paperwork to begin.",
              note: "Most solo businesses start here",
            },
            {
              name: "LLC",
              text: "Keeps your personal things separate from the business. Has a state filing fee and a bit more paperwork each year.",
            },
          ],
          secondsTake:
            "Starting as a sole proprietor and switching to an LLC later is common. If you're unsure, a quick call with an accountant is worth it. I can help you prepare questions.",
          link: {
            label: "SBA guide to business structures",
            url: "https://www.sba.gov/business-guide/launch-your-business/choose-business-structure",
          },
        },
        {
          id: "official-ein",
          title: "Get your EIN",
          detail: "Your business tax ID. Free from the IRS.",
          minutes: 10,
          explainer:
            "An EIN is like a Social Security number for your business. Banks ask for it. It's free, and you get it online right away. Never pay a website to get one for you.",
          link: {
            label: "IRS EIN application",
            url: "https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number",
          },
        },
        {
          id: "official-name",
          title: "Register your business name",
          detail: "Only needed if you use a name other than your own.",
          minutes: 30,
          explainer:
            "If your business name isn't your own name, most states want you to register it. This is often called a DBA, which means \"doing business as.\"",
          link: {
            label: "SBA guide to business names",
            url: "https://www.sba.gov/business-guide/launch-your-business/choose-your-business-name",
          },
        },
        {
          id: "official-license",
          title: "Confirm your license and insurance",
          detail: `Your ${license} plus liability insurance.`,
          minutes: 60,
          explainer: `Check what your state and town require for a ${license}. Then get liability insurance, which protects you if a client gets hurt or unhappy.`,
          link: {
            label: "SBA guide to licenses and permits",
            url: "https://www.sba.gov/business-guide/launch-your-business/apply-licenses-permits",
          },
        },
      ],
    },
    {
      id: "money",
      label: "Money setup",
      intro: "Get paid easily and keep business money separate. About 1 hour total.",
      why: "Separate money makes taxes simple and shows you exactly how the business is doing.",
      tasks: [
        {
          id: "money-bank",
          title: "Open a business bank account",
          detail: "Bring your EIN and ID.",
          minutes: 45,
          explainer: "Keep business money in its own account. Your local bank or credit union can do it. Ask about free business checking.",
          link: {
            label: "SBA guide to business bank accounts",
            url: "https://www.sba.gov/business-guide/launch-your-business/open-business-bank-account",
          },
        },
        {
          id: "money-payments",
          title: "Set up a way to get paid",
          detail: "Card reader, Venmo, or both.",
          minutes: 20,
          explainer: "Most clients want to pay by card or phone. Pick one simple app and use it for everything.",
        },
        {
          id: "money-save",
          title: "Save for your startup costs",
          detail: "Track it on your money plan.",
          minutes: 5,
          explainer: "Your money plan lists what you need before opening. Update \"saved so far\" as you go.",
          action: { label: "Open money plan", href: "/launch/money" },
        },
        {
          id: "money-taxes",
          title: "Plan to set aside money for taxes",
          detail: "A simple rule of thumb.",
          minutes: 10,
          explainer:
            "When you work for yourself, no one takes taxes out for you. Many people put about 25 to 30% of each payment aside. An accountant can tell you your number.",
          link: {
            label: "IRS guide to estimated taxes",
            url: "https://www.irs.gov/businesses/small-businesses-self-employed/estimated-taxes",
          },
        },
      ],
    },
    {
      id: "brand",
      label: "Brand",
      intro: "Look professional and easy to find. About 2 hours total.",
      why: "People book businesses they can find and trust. A name, logo, and simple website do most of that work.",
      tasks: [
        {
          id: "brand-name",
          title: "Pick your business name",
          detail: "Simple, easy to say, easy to spell.",
          minutes: 30,
          explainer: "Say it out loud. If a friend could spell it after hearing it once, it's a good name.",
          action: { label: "Open brand kit", href: "/launch/brand" },
        },
        {
          id: "brand-logo",
          title: "Choose your logo and colors",
          detail: "Second drafts it. You pick.",
          minutes: 20,
          explainer: "Keep it simple. Your logo should look good small, like on a phone screen.",
          action: { label: "Open brand kit", href: "/launch/brand" },
        },
        {
          id: "brand-website",
          title: "Review your one-page website",
          detail: "What you do, prices, and how to book.",
          minutes: 30,
          explainer: "One page is enough to start: who you are, what you offer, your prices, and a booking button.",
        },
        {
          id: "brand-google",
          title: "Set up your Google Business Profile",
          detail: "So people find you on Google Maps.",
          minutes: 30,
          explainer: "It's free. It puts you on Google Maps and lets clients leave reviews. Google may mail you a postcard to confirm your address.",
          link: { label: "Google Business Profile", url: "https://www.google.com/business/" },
        },
      ],
    },
    {
      id: "clients",
      label: "First clients",
      intro: "Line up your first few bookings before you open. About 1 hour total.",
      why: "Opening with a few bookings already on the calendar takes the pressure off.",
      tasks: [
        {
          id: "clients-booking",
          title: "Set up your booking link",
          detail: "So clients can book without calling.",
          minutes: 20,
          explainer: "A booking link lets people pick a time that works. Put it on your website and your Google profile.",
        },
        {
          id: "clients-tell",
          title: "Tell friends and family",
          detail: "Your first clients are often people you know.",
          minutes: 15,
          explainer: "Send a short, friendly message. Ask them to share it with one person who might like it.",
        },
        {
          id: "clients-intro",
          title: "Offer an intro price",
          detail: "A small discount for your first 10 clients.",
          minutes: 10,
          explainer: "An intro price gets people in the door and helps you collect reviews fast. Set an end date so it doesn't last forever.",
        },
        {
          id: "clients-reviews",
          title: "Ask your first clients for reviews",
          detail: "Reviews bring in new clients.",
          minutes: 10,
          explainer: "Happy clients are glad to help. Ask right after a visit, and send them the link so it's easy.",
        },
      ],
    },
    {
      id: "launch",
      label: "Launch",
      intro: "The big day. Two last things and you're open.",
      why: "You've done the hard part. Now let people know.",
      tasks: [
        {
          id: "launch-announce",
          title: "Announce your opening",
          detail: "Post it and send it to your list.",
          minutes: 20,
          explainer: "Share your opening day, your intro price, and your booking link. Keep it short and happy.",
        },
        {
          id: "launch-open",
          title: "Open your doors",
          detail: "Check this off on opening day.",
          minutes: 1,
          explainer: "When you check this off, Second moves you to Running mode and brings everything you built along.",
        },
      ],
    },
  ];
}

export type RoadmapProgress = {
  stages: RoadmapStage[];
  statuses: StageStatus[];
  total: number;
  doneCount: number;
  percent: number;
  /** Index of the first stage that isn't finished (last stage if all done) */
  currentIndex: number;
  isDone: (taskId: string) => boolean;
  /** The next unfinished tasks, in order, with their stage */
  nextTasks: (count: number) => { task: RoadmapTask; stage: RoadmapStage }[];
  allDone: boolean;
};

export function roadmapProgress(type: BusinessType, completedTaskIds: string[]): RoadmapProgress {
  const stages = getStages(type);
  const done = new Set(completedTaskIds);
  const isDone = (id: string) => done.has(id);
  const allTasks = stages.flatMap((stage) => stage.tasks.map((task) => ({ task, stage })));
  const doneCount = allTasks.filter(({ task }) => isDone(task.id)).length;
  const total = allTasks.length;

  const firstOpen = stages.findIndex((stage) => stage.tasks.some((t) => !isDone(t.id)));
  const currentIndex = firstOpen === -1 ? stages.length - 1 : firstOpen;
  const statuses: StageStatus[] = stages.map((stage, i) => {
    if (stage.tasks.every((t) => isDone(t.id))) return "done";
    return i === currentIndex ? "current" : "upcoming";
  });

  return {
    stages,
    statuses,
    total,
    doneCount,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
    currentIndex,
    isDone,
    nextTasks: (count) => allTasks.filter(({ task }) => !isDone(task.id)).slice(0, count),
    allDone: doneCount === total,
  };
}

/** Task IDs to check off when onboarding finishes. */
export function onboardingTaskIds(type: BusinessType): string[] {
  return getStages(type)
    .flatMap((s) => s.tasks)
    .filter((t) => t.doneByOnboarding)
    .map((t) => t.id);
}
