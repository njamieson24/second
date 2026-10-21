// "Your matches this week" (Home) and onboarding's "3 businesses near you". Shared by the
// browser and the server route src/app/api/matches/route.ts.

import type { Lead } from "./outreach";

export type Match = {
  id: string;
  /** The business (saved = false until the owner taps Save or Draft email) */
  lead: Lead;
  why: string;
  dealIdea: string;
};

export type MatchesResponse =
  | {
      status: "ready";
      matches: Match[];
      /** The middle of their town (for the onboarding map), when known */
      center: { lat: number; lon: number } | null;
      /** true = this week's run didn't work; these are the last saved matches */
      stale: boolean;
    }
  | { status: "pending" }
  | { status: "none" }
  | { status: "error"; message: string };
