# Second: design system

The approved mockups in `design/screens/` are the source of truth. This file lists the tokens and components they use.

## Color tokens
| Token | Hex | Use |
|---|---|---|
| ink | #151B26 | sidebar, hero cards, primary text |
| ink-2 | #1E2533 | rows inside dark cards |
| ink-line | #263042 | active nav item, dark borders |
| paper | #F7F8F5 | page background |
| card | #FFFFFF | light cards |
| line | #E3E6E0 | card borders |
| line-soft | #EEF0EC | dividers inside cards, neutral chips |
| muted | #5E6573 | secondary text on light |
| muted-dark | #9AA1AD | secondary text on dark |
| sky | #2A5BD7 | primary buttons, links, charts |
| sky-light | #7CA3FF | logo circle on dark, number badges |
| sky-tint | #E6EEFC | sky chips and icon tiles (text: #1D3F99) |
| mint | #3DDC97 | brand accent, success, highlight buttons on dark (text on mint: #0B2E22) |
| mint-tint | #E3F8EE | success chips, tip cards (text: #0F6B47, headings: #0B3B2E) |

Rules: neutral base (paper, card, ink) with sky and mint as accents. Mint is the "done / good / Second" color. Sky is the "action" color.

The full token list, including the in-between shades from the mockups, lives in `src/app/globals.css`.

## Light and dark mode
The app has a Light / Dark / Auto switch (`ThemeToggle`) near the bottom of the sidebar, which stays pinned on screen, and at the bottom of `/start`. The launch day screen is always dark and has no switch. Auto (the default) follows the phone or computer setting. The choice is saved in the browser.

**Panels** are the sidebar, phone top bar, hero cards ("This week's game plan", "Your launch plan"), highlight tiles ("You kept", "Next batch ready"), the "Just getting started" card on the mode picker, and the launch day screen. The mockups show them in ink. **That was changed on purpose: in light mode panels are pale blue, and in dark mode they are ink like the mockups.** When comparing to `design/screens/`, expect light panels instead of dark ones.

Panel tokens (use these on panels, never `bg-ink` or `text-mint`):
| Token | Light | Dark | Use |
|---|---|---|---|
| panel | #EAF0FB | #151B26 | panel background |
| on-panel | #151B26 | #F7F8F5 | text on panels |
| panel-accent | #0F6B47 | #3DDC97 | eyebrow labels, active icons, "good" numbers |
| panel-mark | #2A5BD7 | #7CA3FF | logo circle on panels |
| ink-2 | #FFFFFF | #1E2533 | rows inside panels |
| ink-line | #D6E0F5 | #263042 | active nav item, panel borders |
| on-dark | #3B4250 | #C8CDD6 | body text on panels |
| muted-dark | #5E6573 | #9AA1AD | secondary text on panels |
| ink-track, ink-edge, ink-ring, ink-faint | see globals.css | | dividers, outlined buttons, stepper |

So: `bg-panel text-on-panel` for a panel, `bg-card text-ink` for a regular card. Panels get `ring-1 ring-ink-line` so their edge shows in both themes. Mint is fine as a fill (buttons, badges, progress) on panels, but use `text-panel-accent` for mint-colored text.

Dark mode values (everything not listed stays the same):
| Token | Dark hex |
|---|---|
| ink (text) | #EEF0EC |
| paper (page) | #0F141C |
| card | #1A212C |
| line | #2B3443 |
| line-soft | #242C39 |
| line-strong | #3A4454 |
| muted | #A3AAB6 |
| ink-soft | #C8CDD6 |
| slate | #C3C8D1 |
| sky | #7CA3FF (text on it: on-sky #0F1E45) |
| sky-tint | #1F2E4F |
| sky-ink | #AFC6FF |
| mint-tint | #14342A |
| mint-deep | #5FDDA5 (text on it: on-green #0B2E22) |
| mint-heading | #D2F4E3 |
| mint-mark | #3DDC97 |

Rules for dark mode:
- Filled buttons use `text-on-sky` / `text-on-green`, never `text-white`, so the text flips with the button color.
- Use the `dark:` prefix only for small one-off tweaks. Prefer a token.
- Check contrast in both themes (4.5:1 for text).

## Type
- Font: Outfit, weights 400, 500, 600 (700 only for launch-day headline).
- Page title: 32px / 600, letter-spacing -0.8px
- Card title: 17px / 600
- Hero heading in dark cards: 26px / 600
- Body: 15 to 16px / 400
- Small labels: 13 to 14px
- Big numbers: 30 to 52px / 600, tabular numbers

## Shape and spacing
- Cards: radius 24px, 1px border `line`, padding 22 to 28px
- Rows inside dark cards: radius 16px
- Buttons and chips: fully rounded (pill). Buttons min-height 44px.
- Chips: 13px / 600, padding 4px 10px, radius 10px
- Page padding: 32px top, 40px sides. Gaps between cards: 24px.
- Sidebar: 248px wide, ink background.

## Components
- **Sidebar:** logo (mark + "second"), optional "Launch mode" pill (mint outline), nav items with icons (active item: ink-line background, mint icon), bottom card (Running: "Second is working"; Launch: launch progress bar), user row with avatar initial.
- **Hero card (dark):** ink background, mint eyebrow label, heading, rows on ink-2 with number badges and action buttons. Used for "This week's game plan" and "Your launch plan."
- **Card (light):** white, border, title row with optional chip or link on the right.
- **Stat tile:** label (muted, 14px) above big number, optional small colored note.
- **Chip:** status pill. mint-tint for done/good, sky-tint for ready/draft, line-soft for not started.
- **Button:** primary (sky), mint (on dark cards), ghost (outlined).
- **Tip card:** mint-tint background with a heading "Tip from Second" or "Ideas from Second."
- **Roadmap stepper:** circles joined by a line; done = mint with check, current = sky ring, upcoming = gray outline.
- **Chat bubbles:** user = sky, right-aligned; Second = white card with Second avatar, left.

## Logo
Two linked circles: a solid circle (the owner) and a ring (their Second). The ring has a gap where it crosses the circle (draw the ring twice: first a thicker stroke in the background color, then the ring color).
- On light: circle #2A5BD7, ring #3DDC97, gap color = background
- On dark: circle #7CA3FF, ring #3DDC97, gap color = background
Files: `design/brand/mark-on-light.svg`, `design/brand/mark-on-dark.svg`. Wordmark is lowercase "second" in Outfit 600.

## Voice
Warm, plain, encouraging, like a mentor who ran a shop for 30 years. "Morning! I found 12 gyms near you and wrote them emails. Want me to send them?" Never "Your outreach campaign has been optimized."
