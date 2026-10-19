// "Take a tour": the steps, in plain words, for each mode. The tour walks through the real
// pages: each step opens a page and points at one thing on it (an element marked
// data-tour="..."). If that thing isn't on the page, it points at the page title instead
// (every PageHeader is marked data-tour-header).

import type { Mode } from "./mode";

export type TourStep = {
  /** The page this step is on */
  path: string;
  /**
   * data-tour value of the thing to point at, or "page" for the page title.
   * None = a card in the middle of the screen (welcome, finish).
   */
  target?: string;
  title: string;
  text: string;
};

const chat: TourStep = {
  path: "/chat",
  target: "chat-box",
  title: "Chat with Second",
  text: "Ask anything about your business, in your own words. Second can also find local businesses to team up with, with an idea for each. If Second suggests a change, nothing changes until you tap Approve.",
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
const outreach: TourStep = {
  path: "/outreach",
  target: "page",
  title: "Outreach",
  text: "Businesses you saved from your chats with Second. Find their email, have Second write a friendly note, and send it from your own email. Second never sends anything.",
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
  text: "Start with one small thing today. You can take this tour again any time with \"Take a tour\" in the menu.",
});

export const TOUR_STEPS: Record<Mode, TourStep[]> = {
  running: [
    {
      path: "/app",
      title: "Welcome to Second",
      text: "Second is your business partner. It plans the work and drafts things for you. You read them and say yes. Nothing is sent without you. Let's take a quick look around.",
    },
    {
      path: "/app",
      target: "this-week",
      title: "This Week",
      text: "Three things to do this week, picked for your business. Tap \"Do it with Second\" and it writes the text or post for you.",
    },
    chat,
    calendar,
    {
      path: "/app/money",
      target: "page",
      title: "Money",
      text: "What you earned, what you spent, and what you kept. Add money in or out in a few taps, and Second keeps the totals for you.",
    },
    content,
    outreach,
    settings,
    done("/app"),
  ],
  launch: [
    {
      path: "/launch",
      title: "Welcome to Second",
      text: "Second is your business partner. It plans the work and drafts things for you. You read them and say yes. Nothing is sent without you. Let's take a quick look around.",
    },
    {
      path: "/launch",
      target: "launch-plan",
      title: "Your launch plan",
      text: "Where you are on the way to opening day, and the next few steps. One clear step at a time.",
    },
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
    calendar,
    content,
    outreach,
    settings,
    done("/launch"),
  ],
};
