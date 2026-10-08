# Second

Second is an AI business partner for small business owners, especially people who are great at their craft but new to the business side (think a 55-year-old massage therapist). Tagline: "Your business partner, in your pocket."

Read @docs/PRODUCT.md for what we're building and @docs/DESIGN.md for how it must look. The approved mockups are in `design/screens/` (PNG) and `design/html/` (HTML source). Match them closely.

## Two modes (core concept)
- **Launch mode**: for people who haven't opened yet. Roadmap to opening day, money plan, brand kit.
- **Running mode**: for people already in business. Weekly game plan, outreach, money tracking, content.
- `/` is the intro page (what Second is). "Get started" goes to `/signup`; "Try the demo" needs no account. Then `/start` (pick a mode) and `/start/setup` (a few questions). Finishing Launch mode "graduates" them to Running mode and carries their data over.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Font: Outfit (via `next/font/google`). Icons: `lucide-react`.
- Accounts and data: Supabase (email + password login, Postgres). Tables and row level security are in `supabase/schema.sql` (plus `calendar.sql`, `beta.sql`, `chat.sql`, `memory.sql`, `week.sql`).
- "Try the demo" keeps the old behavior: data stays in this browser (localStorage), no account.
- IMPORTANT: `src/lib/store.ts` is the ONLY file that saves or loads data, and the only one that signs people in or out. It picks the backend: `store-supabase.ts` when signed in, `store-local.ts` in the demo. Pages read data through `src/lib/data.tsx` (`useLoadedData`, `useRoadmap`, `RequireAccount`, `RequireBusiness`) and write by calling store functions. Pages never touch localStorage or Supabase directly. (Exceptions: the before-paint script in `src/lib/boot.ts`, and the light/dark choice in `src/lib/theme.tsx`, which is a device setting, not business data.)
- Supabase keys live in `.env.local` (git-ignored; see `.env.local.example`). Only the PUBLISHABLE key goes in the app. NEVER use the secret / service_role key in browser code, and never commit keys or test passwords.
- REMINDER: "Confirm email" is turned OFF in Supabase (Authentication > Sign In / Providers > Email) to make testing easy. Turn it back ON before real customers use the app. The sign-up page already handles it ("Check your email").
- Before real customers: also set the real Site URL and Redirect URLs in Authentication > URL Configuration, and set up a custom email sender (Supabase's built-in one only sends a few emails per hour).
- Roadmap stages and tasks: `src/lib/roadmap.ts`. Business types, suggested services, prices and costs: `src/lib/business-types.ts`. Money math: `src/lib/money.ts`.
- `src/lib/mock-data.ts` now only holds sample content for features that need AI or outside services (game plan, outreach, content posts, chat, schedule, tips).
- `/settings` shows the account (Log out) or the demo (Create an account / Leave the demo), and "Start over" (deletes business data, keeps the login).
- `/beta` is the public beta sign-up page (no login). Rows go to `beta_signups` (`supabase/beta.sql`): anonymous visitors can only insert, nobody can read it from the browser. The page saves through `joinBeta` in store.ts, which posts to `src/app/api/beta/route.ts`. Never `.select()` after that insert or upsert; a duplicate email (error 23505) counts as success. Form rules: `src/lib/beta.ts`. Preview image: `src/app/beta/opengraph-image.tsx` (fonts in `assets/`); it needs `NEXT_PUBLIC_SITE_URL` (the live address) in `.env.local` and Vercel.
- Test accounts made by automated tests use `second-test-<number>@example.com`. Delete them with `supabase/delete-test-accounts.sql`.

## AI (Claude API)
- Chat with Second is the only AI feature so far. Server route: `src/app/api/chat/route.ts` (official `@anthropic-ai/sdk`). Personality and business context: `src/lib/chat-context.ts`. Limits and the stream format: `src/lib/chat.ts`. The page calls `getChatHistory` / `sendChatMessage` in store.ts.
- IMPORTANT: `ANTHROPIC_API_KEY` is read ONLY in server route code. Never import it into a "use client" file, never give it a `NEXT_PUBLIC_` name, never log it, never commit it.
- Model: `CLAUDE_MODEL` (server-only), default `claude-haiku-4-5-20251001`. Thinking models (like `claude-sonnet-5-5`) automatically get low effort, a bigger reply cap, and Anthropic's refusal fallback.
- Credit limits: 600 tokens per reply (1500 for thinking models), last 20 messages as history, 2,000 characters per message, 50 messages per person per 24 hours (`CHAT_DAILY_LIMIT` overrides). Token use is saved on each reply in `chat_messages`; the cost query is at the bottom of `supabase/chat.sql`.
- "Try the demo" never calls the AI. It shows a sample conversation and a sign-up button.
- Chat history sent to Claude: only the last 20 messages from the last 24 hours (`CHAT_HISTORY_HOURS` overrides). Older facts live on as business notes, so deleting a note really makes Second forget it.
- Suggested updates: Second proposes changes with tools (`src/lib/chat-tools.ts`), the server checks them and saves cards in `chat_proposals`. The model never writes. Only the owner's Approve writes, through store.ts (`approveProposal` uses `saveBusiness`, `savePayGoal`, `addEvent`, `updateEvent`, `deleteEvent`). Second must never say something changed before it's approved.
- Business notes ("What Second knows" in Settings): `src/app/api/memory/route.ts` + `src/lib/notes-pass.ts`. Vercel has no background jobs, so the chat page triggers a pass when it opens and every 6 messages; the server skips it if nothing is new. Always Haiku, 300-token cap, max 3 changes, 8 passes per 24 hours (`NOTES_DAILY_LIMIT`). Tokens logged in `memory_runs`. Never save client details, health details or account numbers (instructions plus a server-side filter). Never log note text or messages.

- "This Week" (weekly game plan, `src/components/ThisWeek.tsx` at the top of Home in both modes): `src/app/api/week/route.ts`. Made the first time Home opens each week (Monday start, owner's time zone); read from the database after that, so inactive owners cost nothing. Plain code works out the facts (`src/lib/week-facts.ts`: money vs. pay goal and pace, days with nothing booked, clients not back in 5+ weeks from calendar appointments and income "Who was it?" names, notes, last week's Done/Skip); one Haiku call picks exactly 3 actions with a tool; the server checks them (`src/lib/week-plan.ts`: types, lengths, a real number in every "why", mode rules, at most 1 collab idea and only when open, no invented business names or distances), retries once, then falls back to a plan made by plain code. A try is claimed in `weekly_plans` (unique on user + week + attempt) BEFORE the AI call, so two tabs can't make or pay for two plans. 3 AI tries a week (first + 2 redos); after that, and after Start over with no tries left, the plain-code plan is used (never an empty card). "Do it with Second" drafts: one Haiku call each (150 to 300 tokens), checked (client messages use the first name only; no contact details), saved on the action, editable, with Copy. At most 15 drafts a day (`DRAFTS_DAILY_LIMIT`). Clients are only ever sent to Claude by first name.
- Client texting rules (server-side, `applyTextingRules` in `src/lib/week-facts.ts`, so held-back clients never reach Claude): after a check-in text is marked Done, that client rests 3 weeks; after 2 Done texts with no new visit or payment from them, stop suggesting them until they book or pay again. Skipped texts follow the skip rule (not suggested again the next week).
- `PLAN_WEEK_OFFSET` is a TEST-ONLY server setting that pretends it's N weeks later. Never set it in Vercel.
- Known limit: Haiku occasionally asks "want me to update it?" in words without making a card, so the owner has no way to say yes. The rules tell it "the card IS the question", which fixed it in testing, but it can still happen. A stronger model (`CLAUDE_MODEL=claude-sonnet-5-5`) should be more reliable.
- Prompt caching: not used yet. The fixed part of every chat request (persona + rules 689 tokens, 7 tools 1,458 tokens = 2,147, measured with count_tokens) is below Haiku 4.5's 4,096-token minimum, so a cache marker would do nothing. Order is already cache-friendly (tools, then the fixed system block, then the per-request business context). If the prompt grows past 4,096 tokens, or when switching to a model with a lower minimum (Sonnet 5.5 is 512), add `cache_control` to the first system block and check `cache_read_input_tokens` in `chat_messages`.

## Before public launch
- Switch chat message saving to a server-only Supabase secret key (never `NEXT_PUBLIC_`, never in browser code), and remove the "Add own rows" insert policy on `chat_messages`, so users can't insert fake rows into their own history. Today the server saves AS the user with the publishable key. The same applies to `chat_proposals`, `business_notes` and `memory_runs` (memory.sql), and `weekly_plans`, `plan_actions` and `draft_runs` (week.sql): move their server-side inserts to the secret key too and drop the "Add own rows" insert policies.

## Future features
- Business hours should become a real field (days of the week and open/close times, not free text) when we build calendar booking. Booking and Seconds setting up events with each other both need to know when someone is open. Until then, hours mentioned in chat are saved as business notes.

- Collab ideas in "This Week" are the solo version of Seconds talking to each other: Second suggests a TYPE of business ("a gym near you") and drafts a pitch the owner sends themselves. Later this becomes Second-to-Second (each owner's Second talks to the other business's Second), and suggesting real nearby businesses needs a places API (like Google Places). Until then, never invent business names, addresses or distances.

## Commands
- `npm run dev` : start the app at localhost:3000
- `npm run build` : must pass before you call a task done
- `npm run lint`

## Rules
- IMPORTANT: Build only what the current phase in @docs/BUILD_PLAN.md asks for. Don't add features, libraries, or pages that weren't requested.
- All colors, radii, and fonts come from the tokens in docs/DESIGN.md (set up once in the Tailwind theme). Never hardcode one-off hex values in components.
- Reuse components (Sidebar, Card, Chip, Button, StatTile) instead of copying markup between pages.
- Copy is plain English for non-technical, older users. No jargon, no "leverage/seamless/unlock." Short sentences.
- Accessibility: real `<button>` and `<a>` elements, visible focus states, text contrast at least 4.5:1, touch targets at least 44px.
- Every page must also work at phone width (sidebar collapses).
- Every page must work in light and dark mode (see "Light and dark mode" in docs/DESIGN.md). Sidebar, hero cards, and other panels use `bg-panel text-on-panel` (pale in light mode, ink in dark mode; this intentionally differs from the dark sidebar in the mockups), never `bg-ink`. Use `text-on-sky` / `text-on-green` on filled buttons, never `text-white`.
- Scripts that must run before paint (theme, mode) live in `src/lib/boot.ts`, not in a "use client" file. Exports from client files can't be inlined as text.
- When you finish UI work, take a screenshot of the page and compare it to the matching file in `design/screens/`. List the differences and fix them before reporting done. The mockups are light mode only, so also screenshot dark mode and check it reads well.
