// "This Week": shared by the browser (store.ts, the This Week card) and the server route.

/** AI tries per week: the first plan plus 2 redos. Plain-code plans don't count. */
export const PLAN_TRIES = 3;
/** Drafts per person per 24 hours. The server can override it with DRAFTS_DAILY_LIMIT. */
export const DRAFTS_DAILY_LIMIT = 15;

export const ACTION_TYPES = ["post", "client_message", "collab_idea", "roadmap_step", "money", "other"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export type ActionStatus = "open" | "done" | "skipped";

export const ACTION_LABELS: Record<ActionType, string> = {
  post: "Post",
  client_message: "Client check-in",
  collab_idea: "Team up",
  roadmap_step: "Launch step",
  money: "Money",
  other: "To do",
};

export type PlanAction = {
  id: string;
  position: number;
  type: ActionType;
  title: string;
  why: string;
  clientFirstName: string | null;
  draft: string | null;
  status: ActionStatus;
};

export type WeekPlan = {
  /** Monday of this week, YYYY-MM-DD, in the owner's time zone */
  weekStart: string;
  actions: PlanAction[];
  /** Redos still allowed this week */
  redosLeft: number;
  /** Made by plain code (the AI wasn't used or didn't pass the checks) */
  fallback: boolean;
};

/**
 * POST /api/week
 *   { action: "get", timeZone }            -> { status: "ready", plan } | { status: "pending" }
 *   { action: "redo", timeZone }           -> the same, or { status: "error", message }
 *   { action: "draft", actionId, timeZone } -> { status: "draft", draft } | { status: "error", message }
 */
export type WeekResponse =
  | { status: "ready"; plan: WeekPlan }
  | { status: "pending" }
  | { status: "draft"; draft: string }
  | { status: "error"; message: string };
