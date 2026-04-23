# League Analysis — Project Context for Claude

## Stack

Vite · React 19 · JavaScript (`.jsx`) · npm · React Router (`react-router-dom` v6.30) · Tailwind v3.4. No Next.js, no TypeScript, no pnpm. Build with `npm run build`; dev server with `npm run dev`.

The codebase is **feature-first organized**: pages live under `src/pages/`, layouts under `src/layouts/`, and feature-specific components + hooks under `src/features/<feature>/components/` and `src/features/<feature>/hooks/` (`dashboard`, `analytics`, `history`, `tools`, `recap`, `user`, `league`, `stats`). Shared shadcn-style UI primitives live under `src/components/ui/`; new Broadcast Scoreboard atoms (Pip, LiveDot, StatCell, Trend, SectionCard, SegmentedTabs, TabBar, TeamRow) live alongside them. The shared layout chrome lives under `src/components/layout/` (currently `Navbar.jsx`).

**Token-naming note:** `handoff/components.md` and `handoff/tokens.css` use `--accent` / `bg-accent` for the gold signal color. In this repo we renamed it to `--signal` / `bg-signal` (and `--accent-2` → `--signal-2`) to avoid colliding with the existing shadcn gray `--accent` token used by the shadcn primitives. When following a handoff recipe, translate `accent` → `signal` and `accent-2` → `signal-2` at point of use.

Geist is loaded via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` (imported in `src/main.jsx`). The fontsource variable packages register the font under the family names **`'Geist Variable'`** and **`'Geist Mono Variable'`** — the CSS variables in `src/index.css` already point at those names. If you ever swap to non-variable fontsource packages, also drop `Variable` from `--font-sans`/`--font-mono`.

You are helping overhaul the UI of this fantasy football analysis app that pulls data from the Sleeper public API. Do not change functionality in this pass — only visual design and component structure.

## The design system

The design direction is **"Broadcast Scoreboard"** — dark-mode first, bold tabular numerals, team-color pips, gold/amber accent, red-orange for LIVE signals. Reference: `handoff/components.md` and `handoff/tokens.css`.

**Always consult these files before writing a component:**
1. `handoff/tokens.css` — all color/type/spacing/radius/shadow values. Never introduce a color outside this token set. If you need one, add a semantic token and explain why.
2. `handoff/components.md` — exact class recipes for atoms (Pip, LiveDot, StatCell, SectionCard, TabBar) and molecules (PositionRow, TeamRow, MatchupHero).
3. `handoff/page-briefs/<page>.md` — per-page layout target when redesigning that page.

## Non-negotiables

- **Dark mode first.** Light mode is secondary. Use CSS variables that flip via `data-theme="light"` on `<html>`.
- **Mobile first.** Every component ships with a mobile layout before a desktop variant. Breakpoints: mobile 375–430, tablet 768, desktop 1280+.
- **Tabular numerals everywhere numbers appear.** Use `font-variant-numeric: tabular-nums` or the `.tnum` utility. Never use proportional digits in stats.
- **Min tap target 44×44px** on anything interactive on mobile.
- **Preserve API shapes and routes.** The Sleeper API response shapes and all existing route paths stay as-is.
- **No new dependencies** without asking. Use Tailwind utilities and CSS variables — no styled-components, no CSS-in-JS libraries.

## Typography

Import `Geist` (display/body sans) and `Geist Mono` (data/timestamps) via `next/font/google`. Fallback stack in `tokens.css`. Use:
- `font-display` for headings, hero numbers
- default sans for body/UI
- `font-mono` for timestamps, player metadata (`BAL · QB · 29yo`), column headers

## Color usage rules

- `--bg` is the base canvas; `--bg-1` cards; `--bg-2` hover/nested; `--bg-3` input wells.
- `--accent` (gold) = primary signal — "you are here", active tab, leading score, AI badges.
- `--accent-2` (coral) = LIVE state ONLY. Never decorative.
- `--good` / `--bad` = green/red for deltas, win/loss, trend arrows.
- Team colors come from `getTeamHue(teamId)` → `oklch(62% 0.18 <hue>)`. Never hand-pick team colors.

## When you're asked to redesign a page

1. Read the corresponding `handoff/page-briefs/<page>.md`.
2. Identify the existing page file: routes live in `src/App.jsx`; page components live in `src/pages/*.jsx`; composed components live in `src/components/`.
3. Extract data-fetching logic unchanged; rebuild the render tree against the brief.
4. Compose from atoms/molecules in `handoff/components.md`. If a pattern you need isn't there, propose it with a class recipe before coding.
5. Mobile first, then add `md:` / `lg:` variants.
6. Commit with message `ui: redesign <page> to broadcast-scoreboard`.

## Data layer (real, not the brief's wishlist)

The `handoff/page-briefs/*` files mention hooks like `useMatchup`, `useLeagueStandings`, `useAiInsights`, `useRosterNews`, `useMatchupHistory`, `usePowerRankings`, `usePlayer`, `usePlayerGameLog`, `usePlayerNews` — **none of these exist in this codebase**. They were authored against a hypothetical data layer.

Real data surface:

- `useLeagueData(leagueId)` from `src/features/league/hooks/useLeagueData.js` — returns `{ league, rosters, users, players, state, matchups, tradedPicks, loading, error, refresh }`. This is the canonical league-data hook; do not call the lower-level fetchers from components.
- Other real hooks: `useAnalyzeTeam`, `usePlayerNews`, `usePlayoffOdds` (`src/features/dashboard/hooks/`); `useLineupStatus`, `useLeagueHistory` (`src/features/league/hooks/`); `useSeasonMatchups` (`src/features/analytics/hooks/`); `usePlayerStats`, `useTradeAnalysis` (`src/features/tools/hooks/`); `useWeeklyRecap`, `useSeasonSuperlatives` (`src/features/recap/hooks/`); `useCareerStats` (`src/features/stats/hooks/`).
- Hooks named in `handoff/page-briefs/*` (`useMatchup`, `useLeagueStandings`, `useAiInsights`, `useRosterNews`, `useMatchupHistory`, `usePowerRankings`, `usePlayer`, `usePlayerGameLog`) are **hypothetical** — they don't exist; the briefs are visual references only.
- Lower-level Sleeper API helpers in `src/utils/sleeper.js`: `fetchUser`, `fetchUserLeagues`, `fetchLeagueUsers`, `fetchLeagueRosters`, `fetchLeagueMatchups`, `fetchNFLState`, `fetchPlayers`, `fetchLeague`, plus draft/transaction/trending helpers. Reach for these only when extending the existing hooks or `SleeperContext`.
- `SleeperContext` in `src/context/SleeperContext.jsx` — user/leagues/season state for the home flow.
- AI integration: `src/features/dashboard/components/AnalyzeMyTeam.jsx` calls `POST /api/analyze-team` (Vercel serverless function at `api/analyze-team.js` using **Google Gemini** via `@google/generative-ai`, not Anthropic). Server-only env var: `GEMINI_API_KEY`. Streams via SSE; client-side rate limit + 1hr cache via `useAnalyzeTeam`.
- Status/team helpers in `src/utils/nflData.js`: `displayTeamName`, `avatarUrl`, plus team/position constants.

## When you're stuck or uncertain

- **Unclear data shape** → open the existing component; don't guess the Sleeper response.
- **Missing token** → propose the new semantic token in `tokens.css` with a comment explaining why. Never hard-code a hex.
- **Layout ambiguity** → ask before improvising. The canvas mockups in the design project are the source of truth.

## Phase discipline

Work through `handoff/phases.md` in order. Do not jump ahead. Each phase ends with a green `npm run build` and a commit. If a phase breaks the build, revert and ask.
