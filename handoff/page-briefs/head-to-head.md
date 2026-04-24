# Brief: Head-to-Head Matchup

**Route:** existing matchup route (`/[leagueId]/matchup/[week]?` or similar).
**Reference:** Head-to-Head section in the design canvas — mobile + desktop artboards.

## Mobile (390×844)

1. **Hero ribbon**: LIVE eyebrow + `3 / 9 remaining`. Teams on left/right, vs pod in center showing win-probability %. Leading score glows accent. Below: gradient win-probability bar.
2. **SegmentedTabs**: `Side by Side · Box Score · Insights` (default: Side by Side).
3. **PositionRow** list — one per lineup slot (QB, RB×2, WR×2, TE, FLEX, K, DEF). Center slot chip + delta. Winner's score colored `text-good`. LIVE players: `text-accent-2` meta line + `<LiveDot/>`.
4. **Totals strip**: current score, projected score, margin.
5. **Win probability chart**: inline SVG line chart 0→Q4.
6. **TabBar** active: Matchup.

## Desktop (1280+)

Two-column grid `1fr 360px`:
- **Main**: Matchup hero (taller) + Side-by-Side table (starters + bench toggle via segmented tabs).
- **Right rail**: Win probability chart + H2H history (last 4 meetings with series record) + AI Matchup Read.

## Data & behavior

- Use existing `useMatchup` + `useMatchupHistory`. Do not change shapes.
- LIVE state: check `player.game_status === "live"` or equivalent. Same logic as current code.
- Win-probability: if your API provides it, use it. Otherwise render a static stub and leave a `// TODO: wire win-prob model`.
