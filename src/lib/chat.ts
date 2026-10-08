// Chat with Second: limits and the shape of what the server streams back.
// Shared by the browser (store.ts, the chat page) and the server route.

export const CHAT_MAX_CHARS = 2000;
/** Default daily limit. The server can override it with CHAT_DAILY_LIMIT. */
export const CHAT_DAILY_LIMIT = 50;
/** How many earlier messages go to Claude with each question. */
export const CHAT_HISTORY = 20;

export type ChatRole = "user" | "assistant";

export type SavedChatMessage = { id: string; role: ChatRole; content: string; createdAt: string };

/**
 * The reply streams back as one JSON object per line:
 *   {"type":"text","text":"..."}                     a piece of the reply
 *   {"type":"done","remaining":12}                   finished, messages left today
 *   {"type":"error","message":"...","limit":true?}   something went wrong (shown as is)
 */
export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; remaining: number }
  | { type: "error"; message: string; limit?: boolean };
