import type { EventType } from "@/lib/store";

/**
 * Each event type has a soft fill, readable text, and a stronger stripe.
 * All tokens, so they work in light and dark mode.
 */
export const eventStyles: Record<EventType, { fill: string; text: string; stripe: string; dot: string }> = {
  appointment: { fill: "bg-sky-tint", text: "text-sky-ink", stripe: "border-sky", dot: "bg-sky" },
  business: { fill: "bg-mint-tint", text: "text-mint-deep", stripe: "border-mint", dot: "bg-mint" },
  deadline: { fill: "bg-amber-tint", text: "text-amber-ink", stripe: "border-amber", dot: "bg-amber" },
  reminder: { fill: "bg-line-soft", text: "text-slate", stripe: "border-gray-stripe", dot: "bg-gray-stripe" },
};
