# App audit implementation — September 13, 2026

The approved correctness and navigation changes were validated locally and on a staged Vercel production deployment before live-domain promotion. No dependency additions or model changes were made.

## Recommendations and AI responses

- Dashboard roster grades, trade-up ideas, and sell-high candidates have separate instructions, titles, and controls above the result. Users can return to grades.
- Dashboard AI, Trade Finder, Simulator, and market-based tools share dynasty/redraft, reception scoring, league-size, and QB-format settings. Results identify their value source and retrieval time. DynastyProcess fallback identifies its scoring/league-size approximation; redraft requests never fall back to dynasty prices.
- Trade candidates are generated and rendered directly from verified objects. Concrete trade output bypasses the language model, which cannot invent additional packages. Screening checks full ownership (including IR/taxi), values, lineup requirements, useful incoming depth, gains for both teams, and no newly unfillable starting positions. Weekly availability is checked separately from long-term ownership.
- Named defaults are `TRADE_VALUE_TOLERANCE = 0.15`, `CONSOLIDATION_PREMIUM = 0.10`, and `MARKET_MAX_AGE_MS = 24 hours`. These are conservative screening rules, not acceptance probabilities. Precise recommendations are withheld when prices are missing or stale. Candidate generation currently uses players only, so no unverified picks are proposed.
- Incidental AI trade advice is restricted to the same screened candidates. Waiver/drop candidates protect starters, IR/taxi assets, young dynasty players, rookies, and valuable stashes.
- SSE responses require explicit successful completion with the provider finish reason. Interrupted, token-limited, empty, malformed, and failed responses are incomplete and retryable. Only complete responses are cached; versioned keys retire older results. Requests are aborted and isolated across league, team, week, mode, and constraint changes.
- Refresh keeps the previous result visible while waiting for the next response. Progress, completion, source, freshness, and retry states are visible.

## Statistics and lineup correctness

- A shared completed-week boundary governs standings, streaks, records, all-play, luck, recaps, rivalry history, season averages, and production-based dynasty/draft views. Live points remain separate.
- Player participation data distinguishes zero/negative games from byes and inactivity. Completed zero-point ties count in team and rivalry records. Missing scores and unpaired matchups do not become fabricated results.
- Fantasy scores poll every 60 seconds while games are active and the tab is visible. A final-score fetch also runs when games finish, including the final active game. Game context is keyed by season and week; timestamps and unavailable/error states are displayed.
- Lineup recommendations use a complete slot assignment, including coordinated FLEX changes. Started games, unknown kickoff information, eligibility, IR/taxi, unavailable players, and missing projections are handled conservatively.
- Trade deadline state is connected to the tools. Teams without distinguishing completed production remain unclassified, and preseason draft positions remain unranked. Public league history loads without a signed-in user and has loading/error handling.
- Player details show completed season averages separately from live scores, identify the actual defensive sample, and no longer expose the empty Trends tab.

## Navigation and layouts

- Mobile bottom navigation provides Dashboard, Matchup, My Team, Tools, and More, with labels, active states, and safe-area spacing. The top bar shows league/season context. Public visitors can choose and change their team; public season switching works on desktop and mobile.
- Tools now displays one lazily loaded tool. A desktop side list and grouped mobile picker preserve all ten tools: Trade Finder, Trade Simulator, Trade Retro, Lineup Check, Roster Clogger, Dynasty Window, Competitive Window, Draft Board, Tank Tracker, and Schedule Generator.
- Optional `?tool=` links work, with Trade Finder as the default. Tool inputs persist during navigation within the browser session; browser Back/Forward restores the tool selection. A full page reload resets temporary tool inputs, while explicitly saved schedules retain their existing storage behavior.
- Mobile trade rosters stack vertically, with full names, search, position filters, and a compact persistent offer summary. Desktop retains side-by-side rosters.
- Dense analytics use expandable mobile summary rows. Draft cells remain readable in a horizontally scrollable board. Essential mobile controls have larger touch targets, analysis text is larger, and muted contrast is improved.
- Shared tabs support keyboard navigation. Dialogs trap and restore focus, support Escape, and isolate background content. The dark/gold identity and route paths remain intact.
- Privacy copy now describes the broader roster and market context sent for requested AI analyses.

## Verification

| Check | Result |
|---|---|
| Automated tests | **308 passed in 29 files** (baseline: 230) |
| Production build | **Passed** |
| ESLint | **0 errors, 18 warnings** (baseline: 38 errors, 31 warnings) |
| Responsive widths | **375, 390, 430, 768, 1280, 1440px** |
| Themes | Dark and light |

Browser smoke checks covered Home, Dashboard, Matchup, My Team/team selection, Standings, Analytics, The Roast, History, Player Details, Privacy, and all ten tools at the requested widths. No page-level horizontal overflow remained in those checks; wide draft content scrolls within its panel. Populated 2025 standings, analytics, and recaps were also checked across all sizes and both themes, in addition to the live 2026 Week 1 views.

Interaction checks included browser Back/Forward, preserved Simulator selections/search, public team changes, public history, season switching, generated schedules, expandable mobile statistics, player-tab keyboard navigation, and More-menu focus/Escape behavior. The bottom navigation stayed at the viewport edge with content padding; CSS safe-area support is present.

Regression coverage includes format-specific valuations, unavailable/fallback values, one-QB/two-QB/Superflex trade screening, asymmetric packages, strong opposing QB rooms, IR/taxi, legal multi-FLEX assignments, locks, missing projections, preseason/live/completed/historical boundaries, ties and zero/negative scores, deadlines, live polling/final refresh, stream completion, cache isolation, rapid selection changes, provider fallback/failures, and accessible tabs/dialogs.

## Acceptance limits

- Real Vercel acceptance checks passed for roster grades, trade-up ideas, and sell-high candidates: all returned HTTP 200 with explicit complete/stop SSE events. Roster grades used only the two intended sections; both trade modes returned verified no-deal results. Early provider checks exposed unsolicited advice, invented offers, and token exhaustion; the release now renders concrete trades deterministically, isolates AI response scope, and allows an 8192-token reasoning/output budget. Provider fallback and error paths remain covered by mocked integration tests.
- Browser checks used desktop viewport emulation, not physical iOS/Android devices. Real browser chrome, device safe-area insets, signed-in account flows, and every historical-season combination remain acceptance checks.
- Completed-week finality deliberately follows Sleeper's week rollover rather than guessing from nonzero scores. Values report retrieval time, not a provider publication timestamp. Market fit and age do not guarantee another manager will accept an offer.
- Eighteen nonblocking lint warnings remain, including existing unused-variable/JSX detection and Fast Refresh export warnings. Lint rules were not broadly suppressed; the configuration addition declares Node globals for server/scripts.
