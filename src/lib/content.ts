// Content page: shared by the browser (store.ts, the page) and the server route.
// Each idea is a short creative brief: what to post, format, 2 or 3 shots, a hook, best day.

/** AI idea batches per week: the first set plus 2 "New ideas". Plain-code sets don't count. */
export const IDEA_TRIES = 3;
export const IDEAS_PER_WEEK = 5;
export const HOOK_MAX_CHARS = 125;
export const SHOT_MAX_CHARS = 120;

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

export const POST_FORMATS = ["photo", "carousel", "reel"] as const;
export type PostFormat = (typeof POST_FORMATS)[number];
export const POST_FORMAT_LABELS: Record<PostFormat, string> = { photo: "Photo", carousel: "Carousel", reel: "Short video (Reel)" };

export type PostStatus = "idea" | "drafted" | "ready" | "posted";
export const POST_STATUS_LABELS: Record<PostStatus, string> = { idea: "Idea", drafted: "Drafted", ready: "Ready", posted: "Posted" };

export type ContentPost = {
  id: string;
  weekStart: string;
  position: number;
  type: PostType;
  /** What to post */
  title: string;
  why: string;
  source: "ai" | "this_week" | "fallback";
  /** Best day, YYYY-MM-DD */
  day: string;
  status: PostStatus;
  /** Null on ideas made before briefs existed */
  format: PostFormat | null;
  /** 2 or 3 simple shots to take on their phone (read-only) */
  shots: string[] | null;
  /** First line of the caption, or on-screen text for a Reel's first 3 seconds (editable) */
  hook: string | null;
  caption: string | null;
  postedAt: string | null;
};

export type ContentWeek = {
  weekStart: string;
  ideas: ContentPost[];
  newIdeasLeft: number;
};

/** What "Copy" puts on the clipboard: the hook, then the caption with its hashtags. */
export function copyText(post: Pick<ContentPost, "hook" | "caption">): string {
  return [post.hook?.trim(), post.caption?.trim()].filter(Boolean).join("\n\n");
}

/**
 * POST /api/content
 *   { action: "get", timeZone }                 -> { status: "ready", week } | { status: "pending" }
 *   { action: "new", timeZone }                 -> the same (at most 2 a week)
 *   { action: "caption", postId, timeZone }     -> { status: "caption", caption } | error
 *   { action: "hook", postId, hook, timeZone }  -> { status: "hook", hook } | error (checked, then saved)
 */
export type ContentResponse =
  | { status: "ready"; week: ContentWeek }
  | { status: "pending" }
  | { status: "caption"; caption: string }
  | { status: "hook"; hook: string }
  | { status: "error"; message: string };
