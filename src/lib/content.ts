// Content page: shared by the browser (store.ts, the page, the templates) and the server route.

/** AI idea batches per week: the first set plus 2 "New ideas". Plain-code sets don't count. */
export const IDEA_TRIES = 3;
export const IDEAS_PER_WEEK = 5;

export const POST_TYPES = ["promo", "tip", "behind_the_scenes", "client_love", "slow_day", "launch_countdown", "other"] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  promo: "Promo",
  tip: "Tip",
  behind_the_scenes: "Behind the scenes",
  client_love: "Client love",
  slow_day: "Slow-day special",
  launch_countdown: "Launch countdown",
  other: "Post",
};

export type PostStatus = "idea" | "drafted" | "ready" | "posted";
export const POST_STATUS_LABELS: Record<PostStatus, string> = { idea: "Idea", drafted: "Drafted", ready: "Ready", posted: "Posted" };

export type TemplateSize = "square" | "story";
export const TEMPLATE_SIZES: Record<TemplateSize, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square post" },
  story: { w: 1080, h: 1920, label: "Story" },
};

/** Text on a template. Every field is optional; each layout uses some of them. */
export type TemplateText = {
  headline?: string;
  line?: string;
  /** Owner's own words: testimonial quote or special offer. Never written by AI. */
  quote?: string;
  offer?: string;
  /** Filled by plain code from saved data */
  price?: string;
  days?: string;
  countdown?: string;
};

export type ContentPost = {
  id: string;
  weekStart: string;
  position: number;
  type: PostType;
  title: string;
  why: string;
  source: "ai" | "this_week" | "fallback";
  /** YYYY-MM-DD */
  day: string;
  status: PostStatus;
  caption: string | null;
  template: string | null;
  templateSize: TemplateSize | null;
  templateText: TemplateText | null;
  postedAt: string | null;
};

export type ContentWeek = {
  weekStart: string;
  ideas: ContentPost[];
  newIdeasLeft: number;
};

/**
 * POST /api/content
 *   { action: "get", timeZone }             -> { status: "ready", week } | { status: "pending" }
 *   { action: "new", timeZone }             -> the same (at most 2 a week)
 *   { action: "caption", postId, timeZone } -> { status: "caption", caption, templateText } | error
 */
export type ContentResponse =
  | { status: "ready"; week: ContentWeek }
  | { status: "pending" }
  | { status: "caption"; caption: string; templateText: TemplateText }
  | { status: "error"; message: string };
