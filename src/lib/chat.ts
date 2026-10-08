// Chat with Second: limits and the shape of what the server streams back.
// Shared by the browser (store.ts, the chat page) and the server route.

export const CHAT_MAX_CHARS = 2000;
/** Default daily limit. The server can override it with CHAT_DAILY_LIMIT. */
export const CHAT_DAILY_LIMIT = 50;
/** How many earlier messages go to Claude with each question. */
export const CHAT_HISTORY = 20;

/** Only messages from this many hours go to Claude as history. Older ones live on as notes. */
export const CHAT_HISTORY_HOURS = 24;
/** Notes passes per person per 24 hours. The server can override it with NOTES_DAILY_LIMIT. */
export const NOTES_DAILY_LIMIT = 8;
/** Run a notes pass after this many messages in one sitting. */
export const NOTES_EVERY = 6;
/** Notes shown to Second, newest first. */
export const NOTES_IN_CONTEXT = 30;
export const NOTE_MAX_CHARS = 200;

export type ChatRole = "user" | "assistant";

// ---------- Suggested updates (cards with Approve / Ignore) ----------

export type ProposalStatus = "pending" | "approved" | "ignored" | "stale";

/** What a card would change. Checked on the server before it's saved, and again before it's applied. */
export type ProposalChange =
  | { kind: "set_price"; service: string; oldPrice: number; newPrice: number }
  | { kind: "add_service"; name: string; price: number; minutes: number | null }
  | { kind: "remove_service"; service: string }
  | { kind: "set_pay_goal"; oldGoal: number; newGoal: number }
  | {
      kind: "add_event";
      title: string;
      type: "appointment" | "business" | "deadline" | "reminder";
      allDay: boolean;
      /** ISO time for timed events, YYYY-MM-DD for all-day (end inclusive) */
      start: string;
      end: string;
      timeZone: string;
      clientName: string | null;
    }
  | { kind: "move_event"; eventId: string; title: string; allDay: boolean; start: string; end: string }
  | { kind: "cancel_event"; eventId: string; title: string; when: string };

export type ChatProposal = {
  id: string;
  messageId: string;
  /** Plain-English line shown on the card, written by the server from the checked details */
  summary: string;
  change: ProposalChange;
  status: ProposalStatus;
};

export type SavedChatMessage = { id: string; role: ChatRole; content: string; createdAt: string; proposals: ChatProposal[] };

// ---------- Business notes ----------

export type BusinessNote = { id: string; note: string; createdAt: string; updatedAt: string };

/**
 * The reply streams back as one JSON object per line:
 *   {"type":"text","text":"..."}                     a piece of the reply
 *   {"type":"proposals","messageId":"...","proposals":[...]}   suggested updates (cards)
 *   {"type":"done","remaining":12}                   finished, messages left today
 *   {"type":"error","message":"...","limit":true?}   something went wrong (shown as is)
 */
export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "proposals"; messageId: string; proposals: ChatProposal[] }
  | { type: "done"; remaining: number }
  | { type: "error"; message: string; limit?: boolean };
