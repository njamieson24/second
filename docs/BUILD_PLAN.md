# Second: build plan

Work one phase at a time. Start each phase in a fresh Claude Code session (`/clear`), paste its prompt, and use plan mode (Shift+Tab until it says plan mode) so Claude shows you its plan before writing code. Commit to git after each phase works.

---

## Phase 1: the visual shell (no real features)

Goal: every screen from the mockups exists, looks right, and you can click between them. All data is fake.

**Prompt:**
```
We're starting the Second app. Read CLAUDE.md, docs/PRODUCT.md, and docs/DESIGN.md, and look at every image in design/screens/ (the HTML source for each is in design/html/).

Set up a Next.js App Router project with TypeScript and Tailwind in this folder. Put the design tokens from docs/DESIGN.md in the Tailwind theme and load Outfit with next/font.

Build the visual shell only, using mock data from src/lib/mock-data.ts:
- /start : mode picker (design/screens/01-mode-picker.png)
- Launch mode, with the Launch sidebar: /launch (02), /launch/roadmap (03), /launch/money (04), /launch/brand (simple placeholder in the same style)
- /launched : launch day handoff (05)
- Running mode, with the Running sidebar: /app (06), /app/outreach (08), /app/money (09), /app/content (10), /app/clients (placeholder)
- /chat (07), shared by both modes, showing the sidebar for the current mode
- /learn : placeholder

Store the chosen mode in a simple React context saved to localStorage. The mode picker sets it, and "Take me to my dashboard" on /launched switches it to Running.

Build shared components first (Sidebar, Card, Chip, Button, StatTile, HeroCard, RoadmapStepper, ChatBubble), then the pages. Buttons can be non-functional except navigation.

When done: run npm run build, then take a screenshot of each page at 1440px wide and at 390px wide, compare each to its mockup, and fix differences. Show me the screenshots.
```

**Done when:** all pages load, navigation works, it looks like the mockups on desktop and phone, `npm run build` passes.

---

## Phase 2: real data and accounts
Goal: users can sign up, pick a mode, and their business profile is saved.
- Add Supabase (auth + Postgres). Tables: users, businesses (mode, type, area, services, prices, goals), roadmap_tasks, transactions.
- Onboarding flow after the mode picker: a short conversation-style form that fills the business profile.
- Replace mock data with real data for the profile, roadmap progress, and money plan.

## Phase 3: Chat with Second (the brain)
- Connect the Claude API on the server (never expose the API key to the browser).
- Give Second the business profile as context. Responses can include tappable options and drafts.
- Keep chat history per user.

## Phase 4: Launch mode features
- Roadmap tasks that can be checked off, with explainers generated from the business type and state.
- Money plan calculator that updates live.
- Brand kit: name ideas, colors, and a simple one-page site preview.
- Launch day graduation that moves data into Running mode.

## Phase 5: Running mode features, one at a time
1. Money tracking: add income and expenses by typing ("got $90 from Sarah"), monthly summary.
2. Weekly game plan: Second drafts 3 moves each week; approve buttons.
3. Content: weekly Instagram captions and photo ideas with copy buttons.
4. Outreach: find local businesses (Google Places API), draft emails, send from the user's Gmail only after approval, track replies. (Needs Google OAuth and review; do this last.)

## Tips for every phase
- One phase per session. If Claude gets confused after two corrections, `/clear` and restart the phase with a clearer prompt.
- Always ask for screenshots or a passing build as proof.
- Update CLAUDE.md when you make a decision you want remembered (like "we use Supabase").
