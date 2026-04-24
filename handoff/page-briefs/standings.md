# Brief: Standings & Power Rankings

**Route:** existing standings/analytics route.
**Reference:** Standings section in the design canvas.

## Mobile

1. **Header**: page title + week eyebrow.
2. **SegmentedTabs**: `Standings · Power · All-Play`.
3. **Top-3 podium**: three pods (2-1-3 visual order), #1 elevated and ring-accent with `team-tint-soft` gradient card.
4. **Full table**: grid `24px 26px 1fr 40px 50px 32px` = rank, pip, name/streak, rec, PF, trend. Current user row: `team-tint-soft` wash. Accent divider after rank 6 with "— PLAYOFF CUT —" label.

## Desktop

Two-column `1.4fr 1fr`:
- **Main**: Table with extended columns `# · AVATAR · TEAM · REC · PF · PA · PWR (w/ bar) · Δ`. Playoff-cut row between 6 and 7 is a full-width band with accent.
- **Right rail**:
  - Power Trend chart — last 8 weeks, top 4 teams, one line per team (line color = `teamColor(seed)`).
  - Movers · Week N — weekly rank changes with explanation line.
  - Luck Index — all-play vs actual record diff per top 6 teams.

## Data

- `useLeagueStandings(leagueId)`
- `usePowerRankings(leagueId, weeks = 8)` — if the hook doesn't exist, compute from matchup history inline in a `lib/power.ts` helper.
- Luck index: `allPlayWins - actualWins`.
