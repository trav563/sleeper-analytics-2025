# Brief: Roster Detail

**Route:** existing team/roster detail route.
**Reference:** Roster Detail section in the design canvas.

## Mobile

1. **Team hero**: radial team-color fade; `<Pip ring size={56}>` + @owner + team name + 5-2 · #3 · streak · PF row.
2. **SegmentedTabs**: `Roster · Matchup · Trades · History`.
3. **Starters section** (label + slot count):
   - 9 rows, grid `32px 28px 1fr auto` = slot chip + avatar + name/meta + live/proj pair.
   - LIVE rows: subtle coral tint background.
4. **Bench section**: same row pattern, meta uses `szn` instead of `live/proj`.
5. **Positional strength card**: one bar per position (QB, RB, WR, TE, K/DEF) with label + color-coded % (green >80, gold >60, red below).

## Desktop

Two-column `1.3fr 1fr`:
- **Main**: Team hero strip with 5 `StatCell`s (REC, RANK, PF, PLAYOFF, STREAK) → Roster table with columns `SLOT · AVATAR · PLAYER · LIVE · PROJ · SZN · BYE`.
- **Right**: Positional strength + AI Roster Analysis (with surplus/need chips) + Upcoming Byes.
