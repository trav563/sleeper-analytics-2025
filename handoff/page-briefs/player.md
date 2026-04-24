# Brief: Player Detail

**Route:** existing player detail route.
**Reference:** Player Detail section in the design canvas.

## Mobile

1. **Hero**: radial team-color fade (stronger than other pages — ~40% top opacity). Square-ish 72×72 player thumb (striped placeholder if no headshot). Meta chips: `QB` · team code · `#8 · AGE 29`. Name (text-2xl fw-extrabold). Next game line (font-mono).
2. **StatCell row** (4 cells): LIVE · PROJ · SZN AVG · OWN%.
3. **SegmentedTabs**: `Game Log · News · Matchup · Trends`.
4. **Weekly chart**: inline SVG bar chart, this week's bar highlighted `fill=accent`, rest use team hue.
5. **News list**: dated items with font-mono timestamps.

## Desktop

1. **Hero strip**: larger thumb (120×120), name (text-4xl), 5 StatCells (adds RANK). Right-aligned action column: `View in Lineup` (accent button) + `Compare Players` (bg-2 button).
2. **3-column body grid**:
   - Weekly chart (spans 2 cols).
   - Matchup breakdown (vs opponent defense ranks).
   - News & Notes (spans 2 cols, typed tags for LIVE / PRACTICE / ANALYTICS).
   - In the League — ownership and rostered-across-league summary.

## Data

- `usePlayer(playerId)` — existing Sleeper players cache.
- `usePlayerGameLog(playerId, season)` — existing.
- `usePlayerNews(playerId)` — existing.
