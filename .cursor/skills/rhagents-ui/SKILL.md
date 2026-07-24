---
name: rhagents-ui
description: Design and UI polish for rhagent.bot. Use when building or reviewing pages, components, CSS, or animations. Follows emil-design-eng (Emil Kowalski) with Robinhood-neon brand tokens.
---

# rhagents UI

Apply [emil-design-eng](../../.agents/skills/emil-design-eng/SKILL.md) for motion, press feedback, easing, and interaction polish. Source: [emilkowalski/skills](https://github.com/emilkowalski/skills).

## Brand tokens (do not drift)

- **Accent:** `--rh-neon` / `--accent` (#CCFF00) — links, active nav, trade symbols
- **Canvas:** `--bg` #111, `--surface` #1E1E1E — dark-first
- **Semantic:** `--up` green buys, `--down` red sells
- **Typography:** system UI stack; monospace for prices/tickers only
- **Density:** feed is information-dense; avoid padding bloat

## Surfaces

Prefer semi-transparent borders + soft shadow over heavy outlines:

```css
border: 1px solid rgba(255, 255, 255, 0.06);
box-shadow: var(--shadow-surface);
```

## Motion defaults

Use project tokens in `app/globals.css`:

| Token | Value | Use |
| --- | --- | --- |
| `--ease-out` | cubic-bezier(0.23, 1, 0.32, 1) | hovers, enters, press release |
| `--duration-fast` | 140ms | `:active` scale |
| `--duration-ui` | 180ms | color, background, border |

Rules from emil-design-eng:

- Never `transition: all` — list exact properties
- Never `ease-in` on UI feedback
- `:active { transform: scale(0.97) }` on all pressables
- Hover animations only inside `@media (hover: hover) and (pointer: fine)`
- Feed/list hovers: no animation (seen 100+ times/day) — instant background tint only
- Respect `prefers-reduced-motion`

## Components

| Element | Pattern |
| --- | --- |
| `.btn`, `.btn-copy`, `.btn-like`, `.btn-follow` | pressable + ease-out transitions |
| `.card`, `.panel`, `.gate-card` | `--shadow-surface`, soft border |
| `.post-card` | no hover animation on mobile; subtle tint on desktop only |
| `.sidebar-link.active` | accent tint, not full neon fill |
| Copy buttons | URL-only clipboard; no inline preview box |
| `.ia-concept-card` | Feed card — trade strip, account badge, action bar, reply preview |
| `.ia-trade-strip--buy` / `--sell` | Colored trade header; symbol links to `/tickers/{symbol}` |
| `.post-action-bar` | Like · Reply · Copy trade · onchain with dot separators |
| `.post-copy-gate` | Locked copy trade for guests / missing wallet + signup caption |
| `.guest-browse-banner` | Read-only banner when no viewer session on public browse paths |
| `.site-activity-stats` | Footer platform counts (posts · trades · agents) |

## Review format

When reviewing UI diffs, output a Before/After/Why markdown table per emil-design-eng.

## Out of scope

- No decorative springs on feed scroll
- No scale(0) enter animations
- No Framer Motion for list items — CSS transitions only
