// "Take a tour": the steps, in plain words, for each mode. The tour walks through the real
// pages: each step opens a page and points at one thing on it (an element marked
// data-tour="..."). If that thing isn't on the page, it points at the page title instead
// (every PageHeader is marked data-tour-header).

import type { Mode } from "./mode";

export type TourStep = {
  /** The page this step is on */
  path: string;
  /**
   * data-tour value of the thing to point at, or "page" for the page title. Alternatives are
   * split by "|" (the first one on screen wins, like the sidebar on a computer, the bottom bar on a phone).
   * None = a card in the middle of the screen (welcome, finish).
   */
  target?: string;
  title: string;
  text: string;
};

const nav: (home: string) => TourStep = (home) => ({
  path: home,
  target: "nav-sidebar|nav-bar",
  title: "Getting around",
  text: "On a computer, your pages are on the left. On a phone, they're along the bottom: Home, Partners, Chat, Money, and More for everything else.",
});
const matches = (home: string): TourStep => ({
  path: home,
  target: "matches",
  title: "Your matches this week",
  text: "Each week Second finds a few local businesses worth teaming up with, with a deal idea that uses your real prices. Tap \"Draft email\" and Second writes it. You send it yourself.",
});
const partners: TourStep = {
  path: "/partners",
  target: "partners-board|partners-list|page",
  title: "Partners",
  text: "Every business you're teaming up with, from Found to Emailed to Replied to Deal. You move each one along. When one writes back, tap \"Help me reply\".",
};
const chat: TourStep = {
  path: "/chat",
  target: "chat-box",
  title: "Chat with Second",
  text: "Ask anything about your business, in your own words. Second can also find more local businesses to team up with. If Second suggests a change, nothing changes until you tap Approve.",
};
const week: TourStep = {
  path: "/week",
  target: "this-week",
  title: "This Week",
  text: "Three things to do this week, picked for your business. Tap \"Do it with Second\" and it writes the text or post for you.",
};
const calendar: TourStep = {
  path: "/calendar",
  target: "page",
  title: "Your calendar",
  text: "Your appointments, deadlines and reminders in one place. Tap \"Add event\" to put something on it.",
};
const content: TourStep = {
  path: "/content",
  target: "content-ideas",
  title: "Content",
  text: "A few post ideas each week, with what to film on your phone and the first line to write. Second can write the caption too.",
};
const settings: TourStep = {
  path: "/settings",
  target: "what-second-knows",
  title: "What Second knows",
  text: "The things Second remembers about your business from your chats. You can change or delete any of them.",
};
const done = (home: string): TourStep => ({
  path: home,
  title: "That's the tour!",
  text: "Start with one small thing today. You can take this tour again any time with \"Take a tour\" in the menu (under More on a phone).",
});

export const TOUR_STEPS: Record<Mode, TourStep[]> = {
  running: [
    {
      path: "/app",
      title: "Welcome to Second",
      text: "Second is your business partner. It finds local businesses to team up with, plans the work and drafts things for you. You read them and say yes. Nothing is sent without you.",
    },
    nav("/app"),
    matches("/app"),
    partners,
    chat,
    {
      path: "/app/money",
      target: "page",
      title: "Money",
      text: "What you earned, what you spent, and what you kept. When money comes from a partner, tap their name and Second takes off the deal for you and counts it toward that partner.",
    },
    week,
    calendar,
    content,
    settings,
    done("/app"),
  ],
  launch: [
    {
      path: "/launch",
      title: "Welcome to Second",
      text: "Second is your business partner. It plans the work and drafts things for you. You read them and say yes. Nothing is sent without you. Let's take a quick look around.",
    },
    nav("/launch"),
    {
      path: "/launch",
      target: "launch-plan",
      title: "Your launch plan",
      text: "Where you are on the way to opening day, and the next few steps. One clear step at a time.",
    },
    matches("/launch"),
    partners,
    {
      path: "/launch/roadmap",
      target: "page",
      title: "Roadmap",
      text: "Every step to opening, in small pieces, with plain-English help for the paperwork. Check them off as you go.",
    },
    {
      path: "/launch/money",
      target: "money-plan",
      title: "Money plan",
      text: "Your costs, your price, and how many clients you need to cover your costs and pay yourself.",
    },
    {
      path: "/launch/brand",
      target: "page",
      title: "Brand kit",
      text: "Your name, logo, colors and how people will find you online.",
    },
    chat,
    week,
    calendar,
    content,
    settings,
    done("/launch"),
  ],
};
