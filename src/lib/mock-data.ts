// Sample content for features that need AI or outside services (later phases).
// Real saved data (profile, roadmap, money) lives in store.ts.

export type ChipTone = "mint" | "sky" | "neutral";

export const launchQuestions = [
  "Do I need an LLC?",
  "How much should I save before opening?",
  "What insurance do I need?",
];

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

export const moneyPlanTip =
  "Offer an intro price for your first 10 clients. It gets people in the door and helps you collect reviews fast.";

export const launchDay = {
  movingOver: [
    "Your services and prices",
    "Your logo, website, and booking link",
    "Your money plan becomes your money tracker",
    "Your first clients and their notes",
  ],
  newInRunning: [
    "A weekly game plan, drafted for you",
    "Outreach to local gyms and studios",
    "Money tracking and pricing tips",
    "Instagram posts written each week",
  ],
};

// ---------- Running mode ----------

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
      href: "/app/content",
    },
    {
      title: "Check in with 2 regulars",
      detail: "Neither has booked in 60 days",
      action: "Send check-ins",
    },
  ],
  footer: "Everything is drafted. You just say yes.",
};

export const moneyTip = "Your Saturday slots filled up every week. You could raise Saturday prices by $10.";

export const dashboardStats = [
  { label: "Bookings this week", value: "14", note: "+3 vs last week", good: true },
  { label: "New clients this month", value: "6", note: "2 from outreach", good: true },
  { label: "Outreach replies", value: "3", note: "of 12 places" },
  { label: "Time Second saved you", value: "4.5 hrs", note: "this week" },
];

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

// ---------- Placeholders ----------

export const lessons = [
  { title: "What is an EIN?", minutes: 2 },
  { title: "Pricing without guessing", minutes: 4 },
  { title: "Keeping business and personal money apart", minutes: 3 },
];
