# Brief: League Overview

**Route:** current league home page.
**Reference:** Direction A mockup in the design canvas — first section, mobile + desktop.

## Mobile (390×844)

Top to bottom:

1. **Status bar area** (env safe-area-inset-top, ~54px).
2. **Sticky header strip** — `<Pip ring size={36}>` + `@username` eyebrow + team name (text-md fw-extrabold). Right: week pill (`WK 8 · LIVE` with `<LiveDot/>`). Background: radial fade from `team-tint-soft`.
3. **Matchup hero card** — `MatchupHero` molecule. Leading score glows accent. Win probability bar below.
4. **Stat row** — 3 `StatCell`s: Rank, Playoff Odds, Streak.
5. **AI Insights card** — gradient AI badge + 2–3 bullet insights with colored signal chips.
6. **Standings preview** — top 6 `TeamRow`s + "View all 12" link.
7. **Roster news feed** — list of dated items (font-mono timestamps).
8. **Bottom tab bar** — Home (active) · Matchup · Roster · Stats · More.

## Desktop (1280+)

Three-column grid:
- **Left column (360px)**: Sticky team pane (pip + record + playoff odds + quick nav).
- **Center (flex)**: Matchup hero → stat row → AI insights → news feed.
- **Right (360px)**: Standings preview + upcoming byes.

Top nav horizontal (Home · Matchup · Lineup · Analytics · The Roast · History · Tools) with active tab highlighted `bg-bg-3 text-accent`.

## Data

- Matchup: `useMatchup(leagueId, week, rosterId)` — existing hook, don't change shape.
- Standings: `useLeagueStandings(leagueId)` — existing.
- Insights: `useAiInsights(rosterId, week)` — existing (if not present, render a skeleton).
- News: `useRosterNews(rosterId)` — existing.
