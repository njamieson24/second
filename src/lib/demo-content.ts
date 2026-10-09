// Sample content, kept in ONE place for demos, screenshots, and videos.
//
// It is only ever shown when an account has "show sample content" turned on:
//   - "Try the demo" (no account), which fills this browser with Maria's business.
//   - "Load demo data" on /settings, which only certain emails can use (checked on
//     the server with DEMO_DATA_EMAILS) and only fills that person's own account.
// Real users never see any of this.

import type { ChipTone } from "@/components/Chip";
import { getBusinessType } from "./business-types";
import { getStages } from "./roadmap";
import type { Business, CalendarEvent, Mode, MoneyPlan, Transaction } from "./store";
import type { BusinessNote } from "./chat";
import type { PlanAction, WeekPlan } from "./week";
import type { ContentPost, ContentWeek } from "./content";
import { addDaysToKey, dateKeyIn, zonedToDate } from "./timezone";

// ---------- Maria's sample business (real-looking saved data) ----------

export type DemoAccount = {
  business: Business;
  mode: Mode;
  completedTasks: string[];
  moneyPlan: MoneyPlan;
  transactions: Transaction[];
  events: CalendarEvent[];
};

const id = () => crypto.randomUUID();
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// What Maria kept (earned minus spent) in each of the last 6 months, oldest first.
const KEPT = [980, 1150, 1060, 1420, 1710, 1930];
const CLIENTS = ["Alex T.", "Priya S.", "Jenna P.", "Jordan K.", "Sam R.", "Dana L.", "Chris M.", "Lee W."];
const SESSIONS = [
  { name: "Swedish", price: 95 },
  { name: "Deep tissue", price: 110 },
  { name: "Prenatal", price: 100 },
  { name: "Sports massage", price: 110 },
  { name: "Swedish, 90 min", price: 130 },
];
const EXPENSES = [
  { label: "Massage oil and linens", category: "Supplies", amount: 180 },
  { label: "Instagram ad", category: "Ads", amount: 120 },
  { label: "Studio rental", category: "Rent", amount: 110 },
];

/** A week of Maria's calendar around today, in the person's own time zone. */
function demoEvents(now: Date, timeZone: string): CalendarEvent[] {
  const today = dateKeyIn(now, timeZone);
  const at = (dayOffset: number, h: number, min = 0) => {
    const [y, m, d] = addDaysToKey(today, dayOffset).split("-").map(Number);
    return zonedToDate({ y, m, d, h, min }, timeZone).toISOString();
  };
  const timed = (
    dayOffset: number,
    h: number,
    min: number,
    minutes: number,
    rest: Pick<CalendarEvent, "title" | "type"> & Partial<CalendarEvent>,
  ): CalendarEvent => {
    const start = at(dayOffset, h, min);
    return {
      id: id(),
      allDay: false,
      start,
      end: new Date(new Date(start).getTime() + minutes * 60_000).toISOString(),
      timeZone,
      repeatsWeekly: false,
      source: "manual",
      ...rest,
    };
  };
  const allDay = (dayOffset: number, rest: Pick<CalendarEvent, "title" | "type"> & Partial<CalendarEvent>): CalendarEvent => {
    const day = addDaysToKey(today, dayOffset);
    return { id: id(), allDay: true, start: day, end: day, timeZone, repeatsWeekly: false, source: "manual", ...rest };
  };
  const appt = (client: string, service: string, price: number) => ({
    title: `${service}, ${client}`,
    type: "appointment" as const,
    clientName: client,
    price,
    location: "Home studio",
  });
  return [
    timed(0, 10, 0, 60, appt("Alex T.", "Deep tissue", 110)),
    timed(0, 12, 30, 90, appt("Priya S.", "Swedish", 130)),
    timed(0, 15, 0, 60, appt("Jenna P.", "Sports massage", 110)),
    timed(0, 17, 30, 60, appt("Jordan K.", "Prenatal", 100)),
    timed(1, 9, 0, 60, appt("Sam R.", "Swedish", 95)),
    timed(3, 11, 0, 60, appt("Dana L.", "Deep tissue", 110)),
    timed(-2, 14, 0, 60, appt("Chris M.", "Swedish", 95)),
    timed(-14, 18, 0, 120, {
      title: "Chair massage at Seaside Yoga",
      type: "business",
      location: "Seaside Yoga Studio",
      repeatsWeekly: true,
    }),
    timed(12, 17, 0, 120, { title: "Chair massage day at Harbor Fitness", type: "business", location: "Harbor Fitness" }),
    allDay(2, { title: "Order more massage oil", type: "reminder" }),
    allDay(5, { title: "Pay quarterly taxes", type: "deadline" }),
  ];
}

/**
 * Maria's business, with 6 months of money ending this month and a week of
 * appointments. Dates are relative to `today`, times are in `timeZone`.
 */
export function buildDemoAccount(today: Date = new Date(), timeZone?: string): DemoAccount {
  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const info = getBusinessType("massage");
  const monthStart = (back: number) => new Date(today.getFullYear(), today.getMonth() - back, 1);

  const transactions: Transaction[] = [];
  KEPT.forEach((kept, i) => {
    const back = KEPT.length - 1 - i;
    const start = monthStart(back);
    const lastDay = back === 0 ? Math.max(1, today.getDate()) : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const day = (n: number) => iso(new Date(start.getFullYear(), start.getMonth(), 1 + (n % lastDay)));

    const spent = EXPENSES.reduce((s, e) => s + e.amount, 0);
    EXPENSES.forEach((e, k) =>
      transactions.push({ id: id(), date: day(5 + k * 9), kind: "expense", amount: e.amount, label: e.label, category: e.category }),
    );

    // Sessions until the month's earnings are reached; the last one tops it up exactly.
    const earned = kept + spent;
    let total = 0;
    let n = 0;
    while (total < earned) {
      const s = SESSIONS[(n + i) % SESSIONS.length];
      const amount = Math.min(s.price, earned - total);
      transactions.push({
        id: id(),
        date: day(n * 2 + 1),
        kind: "income",
        amount,
        label: `${s.name}, ${CLIENTS[(n + i) % CLIENTS.length]}`,
        category: "Session",
      });
      total += amount;
      n += 1;
    }
  });

  const opened = monthStart(5);
  return {
    business: {
      ownerName: "Maria",
      businessName: "Shore Touch Massage",
      type: "massage",
      typeLabel: info.label,
      area: "Asbury Park, NJ",
      services: [
        { id: id(), name: "Swedish massage", price: 95, minutes: 60 },
        { id: id(), name: "Deep tissue", price: 110, minutes: 60 },
        { id: id(), name: "Prenatal massage", price: 100, minutes: 60 },
        { id: id(), name: "Sports massage", price: 110, minutes: 60 },
      ],
      payGoal: 3000,
      goalNote: "10 new clients by December",
      openingDay: iso(opened),
      createdAt: monthStart(7).toISOString(),
      launchedAt: opened.toISOString(),
    },
    mode: "running",
    completedTasks: getStages("massage").flatMap((s) => s.tasks.map((t) => t.id)),
    moneyPlan: {
      monthlyCosts: info.monthlyCosts.map((c) => ({ ...c, id: id() })),
      startupCosts: info.startupCosts.map((c) => ({ ...c, id: id() })),
      saved: info.startupCosts.reduce((s, c) => s + c.amount, 0),
    },
    transactions,
    events: demoEvents(today, zone),
  };
}

// ---------- Sample content for features that need AI (not built yet) ----------

export const brandKit = {
  initials: "ST",
  name: "Shore Touch Massage",
  // The owner's own brand colors (content, not app styling).
  logoBackground: "#2F5D46",
  logoText: "#F5EFE0",
  colors: [
    { name: "Pine", hex: "#2F5D46" },
    { name: "Sand", hex: "#D9B99B" },
    { name: "Shell", hex: "#F5EFE0", light: true },
  ],
  items: [
    { label: "Logo", status: "Drafted", tone: "mint" },
    { label: "One-page website", status: "Ready to review", tone: "sky" },
    { label: "Google Business Profile", status: "Not started", tone: "neutral" },
    { label: "Booking link", status: "Not started", tone: "neutral" },
  ] as { label: string; status: string; tone: ChipTone }[],
  nameIdeas: ["Shore Touch Massage", "Tidewater Bodywork", "Still Harbor Massage"],
};

export const secondStatus = {
  summary: "18 tasks done this week. About 4.5 hours back in your pocket.",
};

export const gamePlan = {
  timeNeeded: "About 10 minutes of your time",
  heading: "I set up 3 moves for you this week",
  moves: [
    {
      title: "Email 12 gyms and yoga studios about a chair massage day",
      detail: "Each email is written and personalized",
      action: "Review and send",
      href: "/app/outreach",
      primary: true,
    },
    {
      title: "Post 3 Instagram updates",
      detail: "Captions and photo ideas are ready",
      action: "See posts",
      href: "/content",
    },
    {
      title: "Check in with 2 regulars",
      detail: "Neither has booked in 60 days",
      action: "Send check-ins",
    },
  ],
  footer: "Everything is drafted. You just say yes.",
};

/** "This Week" for the demo: a sample plan with sample drafts for Maria. Never calls the AI. */
export function sampleWeek(mode: Mode = "running"): WeekPlan {
  const monday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const actions: PlanAction[] =
    mode === "launch"
      ? [
          {
            id: "sample-a1",
            position: 1,
            type: "roadmap_step",
            title: "Get your EIN from the IRS",
            why: "28 days until opening day, and this one takes 10 minutes",
            clientFirstName: null,
            status: "open",
            draft: "- Go to irs.gov and search \"EIN online\"\n- Pick \"Sole proprietor\"\n- Answer the questions (about 10 minutes)\n- Save the PDF letter they give you at the end",
          },
          {
            id: "sample-a2",
            position: 2,
            type: "roadmap_step",
            title: "Get a quote for liability insurance",
            why: "Step 9 of 31 on your roadmap",
            clientFirstName: null,
            status: "open",
            draft: "- Call two insurers that cover massage therapists\n- Ask for $1 million per claim coverage\n- Compare the yearly price\n- Ask what's not covered",
          },
          {
            id: "sample-a3",
            position: 3,
            type: "money",
            title: "Add your first month of costs to the money plan",
            why: "You've saved $1,200 of your $3,400 startup goal",
            clientFirstName: null,
            status: "open",
            draft: "- Open the Money plan\n- Add rent, supplies and insurance\n- Check how many sessions cover them\n- Move one cost you can skip to \"later\"",
          },
        ]
      : [
          {
            id: "sample-a1",
            position: 1,
            type: "client_message",
            title: "Text Jenna to see how her shoulder is doing",
            why: "Jenna's last visit was 42 days ago",
            clientFirstName: "Jenna",
            status: "open",
            draft: "Hi Jenna! It's Maria from Shore Touch. I've been thinking of you. How's everything feeling? I have openings Thursday and Saturday if you'd like to come in. No pressure!",
          },
          {
            id: "sample-a2",
            position: 2,
            type: "post",
            title: "Post about your open spots on Thursday",
            why: "4 days in the next week have nothing booked",
            clientFirstName: null,
            status: "open",
            draft: "Photo idea: your massage table by the window, with a towel folded and a plant nearby.\n\nI have a few spots open this Thursday. If your shoulders have been up by your ears lately, this is your sign. Book a 60-minute deep tissue and leave feeling like yourself again. #AsburyPark #massage #selfcare",
          },
          {
            id: "sample-a3",
            position: 3,
            type: "collab_idea",
            title: "Team up with a gym near you for a recovery day",
            why: "You're $400 behind your $3,000 pay goal",
            clientFirstName: null,
            status: "open",
            draft: "Hi! I'm Maria, a massage therapist here in Asbury Park. I'd love to team up with [Business name]. Idea: a \"Recovery Saturday\" where I do free 10-minute chair massages at your gym, and your members get 20% off their first full massage with me. Your members get a perk, and we both get new faces. Want to grab a coffee and talk it over?",
          },
        ];
  return { weekStart: monday, actions, redosLeft: 2, fallback: false };
}

/** The Content page for the demo: Maria's sample ideas, captions and templates. Never calls the AI. */
export function sampleContentWeek(mode: Mode = "running"): ContentWeek {
  const d = new Date();
  const key = (offset: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + offset);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const monday = key(-((d.getDay() + 6) % 7));
  const base = { weekStart: monday, source: "ai" as const, postedAt: null, templateSize: "square" as const };
  const ideas: ContentPost[] =
    mode === "launch"
      ? [
          { ...base, id: "sample-c1", position: 1, type: "launch_countdown", title: "Count down to opening day", why: "28 days until you open your doors", day: key(0), status: "drafted", template: "countdown", templateText: { countdown: "28", headline: "until Shore Touch opens", line: "Asbury Park · Swedish and deep tissue" }, caption: "28 days to go! I've been getting the studio ready, and I can't wait to welcome you. Shore Touch Massage opens next month right here in Asbury Park. Follow along for a peek behind the scenes.\n\n#AsburyPark #AsburyParkNJ #JerseyShore #massage #newbusiness #comingsoon" },
          { ...base, id: "sample-c2", position: 2, type: "behind_the_scenes", title: "Show the studio getting painted", why: "9 of 31 launch steps done so far", day: key(2), status: "idea", template: null, templateText: null, caption: null },
          { ...base, id: "sample-c3", position: 3, type: "tip", title: "Share a 30-second desk stretch", why: "28 days to build trust before you open", day: key(3), status: "idea", template: null, templateText: null, caption: null },
        ]
      : [
          { ...base, id: "sample-c1", position: 1, type: "slow_day", title: "Post your Thursday and Friday openings", why: "4 days in the next week have nothing booked", day: key(0), status: "ready", template: "open_week", templateText: { headline: "Open spots this week", days: "Thu · Fri · Sun", line: "Book a 60-minute deep tissue, $110" }, caption: "I have a few spots open this week: Thursday, Friday and Sunday. If your shoulders have been up by your ears lately, this is your sign to take an hour for yourself. 60-minute deep tissue, $110. Tap the link in my bio to book.\n\n#AsburyPark #AsburyParkNJ #JerseyShore #massage #deeptissue #selfcare" },
          { ...base, id: "sample-c2", position: 2, type: "tip", title: "Share a 30-second desk stretch", why: "4 quiet days ahead: a tip keeps you in mind", day: key(1), status: "drafted", template: "tip", templateText: { headline: "Drop your ear to your shoulder and breathe", line: "Five slow breaths each side. Your neck will thank you." }, caption: "Desk neck? Try this: drop your ear to your shoulder, take five slow breaths, then switch sides. Small resets add up. Want a longer reset? I'm here.\n\n#AsburyPark #AsburyParkNJ #deskstretch #massage #selfcare #JerseyShore" },
          { ...base, id: "sample-c3", position: 3, type: "promo", title: "Remind people about your deep tissue massage", why: "Your deep tissue is $110 for 60 minutes", day: key(2), status: "idea", template: "price", templateText: { headline: "Deep tissue massage", price: "$110 · 60 min", line: "Take an hour for yourself." }, caption: null },
          { ...base, id: "sample-c4", position: 4, type: "behind_the_scenes", title: "Show your table set up with fresh towels", why: "4 open days to fill this week", day: key(3), status: "idea", template: null, templateText: null, caption: null },
          { ...base, id: "sample-c5", position: 5, type: "client_love", title: "Thank your regulars this week", why: "You kept $1,930 last month thanks to them", day: key(-2), status: "posted", template: "thanks", templateText: { headline: "to everyone who came in this month", line: "You make this the best job." }, caption: "Thank you to everyone who came in this month. You make this the best job. See you soon!\n\n#AsburyPark #AsburyParkNJ #smallbusiness #massage #thankyou", postedAt: new Date(d.getTime() - 2 * 86_400_000).toISOString() },
        ];
  return { weekStart: monday, ideas, newIdeasLeft: 2 };
}

export const newReplies = [
  {
    initials: "HF",
    name: "Harbor Fitness",
    when: "2h",
    text: "Wants to book a chair massage day",
    chip: "Reply drafted",
    tone: "sky",
  },
  { initials: "SY", name: "Seaside Yoga Studio", when: "5h", text: "Asked about group pricing", tone: "sky" },
  { initials: "JP", name: "Jenna P., client", when: "Yesterday", text: "Can I move Friday to 3 PM?", tone: "mint" },
] as { initials: string; name: string; when: string; text: string; chip?: string; tone: "sky" | "mint" }[];

export const todaySchedule = [
  { time: "10:00 AM", name: "Alex T.", service: "Deep tissue, 60 min" },
  { time: "12:30 PM", name: "Priya S.", service: "Swedish, 90 min" },
  { time: "3:00 PM", name: "Jenna P.", service: "Sports massage, 60 min" },
  { time: "5:30 PM", name: "Jordan K.", service: "Prenatal, 60 min" },
];

export const ideas = [
  { lead: "Holiday gift cards.", text: "Start selling in November. I can make the post and the order form." },
  { lead: "Team up with a running club.", text: "Offer recovery massages after their next race." },
  { lead: "Raise Saturday prices by $10.", text: "Your Saturdays filled up every week this month." },
];

export const outreach = {
  subtitle: "Chair massage day pitch to local gyms and studios",
  unreadReplies: 3,
  stats: [
    { label: "Emails sent", value: "12" },
    { label: "Replies", value: "3" },
    { label: "Events booked", value: "1", good: true },
    { label: "Follow-ups going out", value: "Friday" },
  ],
  waiting: {
    count: 9,
    more: 6,
    places: [
      { name: "Boardwalk Barre", detail: "Studio, 1.4 mi, sent Mon" },
      { name: "Iron Tide Gym", detail: "Gym, 2.0 mi, sent Mon" },
      { name: "Shoreline Pilates", detail: "Studio, 2.3 mi, sent Mon" },
    ],
  },
  replied: [
    { name: "Seaside Yoga Studio", detail: "Asked about group pricing", chip: "Reply drafted", tone: "sky" },
    { name: "Main Street CrossFit", detail: "Maybe in January", chip: "Reminder set for Jan 5", tone: "neutral" },
  ] as { name: string; detail: string; chip: string; tone: ChipTone }[],
  booked: [{ name: "Harbor Fitness", detail: "Chair massage day, Nov 14, 5 to 7 PM", chip: "On your calendar" }],
  nextBatch: {
    heading: "10 running clubs and offices near you",
    text: "Offices love a wellness day before the holidays. Every email is written and personalized. Want to look them over?",
  },
};

export const contentPosts = [
  {
    day: "Tuesday",
    tone: "sky",
    idea: "Photo idea: your table set up with fresh towels and warm light",
    caption:
      "Fall is here and so are tight shoulders. I have a few openings this week for 60 and 90 minute sessions. Tap the link in my bio to book.",
  },
  {
    day: "Thursday",
    tone: "mint",
    idea: "Photo idea: a quick selfie video with one stretch tip",
    caption:
      "Desk neck? Try this: drop your ear to your shoulder, breathe for 5, switch sides. Your neck will thank you. Want the full reset? Come see me.",
  },
  {
    day: "Saturday",
    tone: "dark",
    idea: "Graphic: a happy client quote on a clean background",
    caption:
      "Nothing makes my week like messages like this one. Thank you for trusting me with your recovery. Saturday spots go fast, so book early!",
  },
] as { day: string; tone: "sky" | "mint" | "dark"; idea: string; caption: string }[];

export const comingUp = [
  { label: "Harbor Fitness event announcement", date: "Nov 10" },
  { label: "Holiday gift cards launch", date: "Nov 1" },
  { label: "Meet your therapist post", date: "Oct 8" },
];

// ---------- What Second knows (sample notes, demo only) ----------

export const SAMPLE_NOTES: BusinessNote[] = [
  { id: "sample-1", note: "Wants 3 corporate chair-massage clients by next summer.", createdAt: "2026-09-28T14:00:00Z", updatedAt: "2026-09-28T14:00:00Z" },
  { id: "sample-2", note: "Works Tuesday to Saturday. Keeps Sundays and Mondays for family.", createdAt: "2026-09-21T14:00:00Z", updatedAt: "2026-09-21T14:00:00Z" },
  { id: "sample-3", note: "Finds pricing hard. Worries about losing regulars if prices go up.", createdAt: "2026-09-14T14:00:00Z", updatedAt: "2026-09-14T14:00:00Z" },
  { id: "sample-4", note: "Prefers texting clients over email.", createdAt: "2026-09-07T14:00:00Z", updatedAt: "2026-09-07T14:00:00Z" },
];

// ---------- Chat (shared) ----------

export type ChatMessage =
  | { from: "user"; text: string }
  | {
      from: "second";
      text: string;
      options?: { title: string; detail: string; selected?: boolean }[];
      draft?: { label: string; text: string };
    };

export const chat = {
  running: {
    messages: [
      { from: "second", text: "Morning, {name}! Your game plan is on the dashboard. Want the quick version?" },
      { from: "user", text: "Yes, quick version please" },
      {
        from: "second",
        text: "1. 12 emails to gyms and studios, ready to send.\n2. 3 Instagram posts drafted.\n3. 2 regulars to check in with.\nSay the word and I'll send 1 and 3.",
      },
      { from: "user", text: "Send 1 and 3. Also, what should I charge for the Harbor Fitness event?" },
      {
        from: "second",
        text: "Done, both are sent. For the event, here are two simple ways to price it. Pick one and I'll add it to your reply.",
        options: [
          { title: "Flat fee", detail: "One price for 2 hours of chair massage", selected: true },
          { title: "First one free", detail: "Get your name out, charge next time" },
        ],
        draft: {
          label: "Draft reply to Harbor Fitness",
          text: "Thanks so much! I'd love to do it. Would Nov 14, 18, or 20 work, from 5 to 7 PM?",
        },
      },
    ] as ChatMessage[],
    suggestions: ["What should I post this week?", "How am I doing this month?", "Find more places to reach out to"],
    working: [
      { title: "Watching for replies from 12 places", detail: "Checking every hour", done: false },
      { title: "Drafting next week's posts", detail: "Ready by Sunday", done: false },
      { title: "September expenses sorted", detail: "Done", done: true },
    ],
  },
  launch: {
    messages: [
      { from: "second", text: "Morning, {name}! This week is all about making it official. Want to start with the easy one?" },
      { from: "user", text: "Yes. Do I need an LLC?" },
      {
        from: "second",
        text: "Not to start. Most solo therapists begin as a sole proprietor. It's free and there's little paperwork. You can switch to an LLC later.",
        options: [
          { title: "Start as a sole proprietor", detail: "Simple, free, and common", selected: true },
          { title: "Talk to an accountant", detail: "I'll write your questions for you" },
        ],
      },
    ] as ChatMessage[],
    suggestions: ["How much should I save before opening?", "What insurance do I need?", "Help me pick a name"],
    working: [
      { title: "Drafting your one-page website", detail: "Ready to review", done: false },
      { title: "Checking New Jersey license rules", detail: "Ready by Friday", done: false },
      { title: "Money plan set up", detail: "Done", done: true },
    ],
  },
};

// ---------- Learn ----------

export const lessons = [
  { title: "What is an EIN?", minutes: 2 },
  { title: "Pricing without guessing", minutes: 4 },
  { title: "Keeping business and personal money apart", minutes: 3 },
];
