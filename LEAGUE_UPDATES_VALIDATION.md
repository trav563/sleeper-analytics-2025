# League Analysis updates — implementation and validation

Reviewed September 22, 2026. Changes are local and uncommitted, based on `36904e7`. No production deployment or Google Doc edits were made. Existing unrelated workspace changes were preserved.

## Review groups

1. **Records and simulations:** `leagueRecords` supplies head-to-head, median, and combined records, completed regular-season boundaries, and incomplete-data flags. Display consumers use the shared records. Weekly production and all-play remain separate; schedule luck uses head-to-head results. Playoff simulations reuse one sampled score for both competitions, retain half-win ties, and include settings, records, schedule, and model version in cache inputs. Prior-season inputs use scoring weeks, not the potentially doubled record.
2. **Projections and lineup data:** nullable projection lookup preserves genuine zeroes. Player forecasts remain original weekly projections; team estimates retain the regulation formula. Missing data and overtime have explicit messages. Final requires final game status. Dashboard rows use selected-week starter IDs and slot-indexed scores, with labeled pregame projections.
3. **Visuals and navigation:** shared headshots terminate at a local fallback; mobile roster photos are visible. Owned-player shortcuts open the correct roster and focus the matching starter, bench, taxi, or IR row. Free agents have no shortcut. Charts use Recharts at a fixed height with capped bars and a zero baseline. Tabs retain keyboard navigation with non-wrapping labels and 44px minimum height. K/DEF removal is confined to Positional Strength.
4. **Recaps:** Closest Matchup replaces Close Call in display/copy labels. Copy avoids imaginary decisive plays. Awards require relevant finite scores, appropriate thresholds/signs, and season-appropriate rookie evidence. Weekly and seasonal optimal-lineup comparisons use the exact assignment solver; commissioner adjustments do not change the improvement delta.

## Passed checks

- Full suite: **410 tests in 39 files**, up from 378 at baseline.
- Production build: passed. Vite retains its mixed static/dynamic import advisory for `sleeper.js`.
- ESLint: **0 errors, 17 warnings** (baseline: 18 warnings).
- `git diff --check`: passed.
- New coverage includes median on/off, ties, negative/zero scores, incomplete weeks, historical settings and boundaries, no double-counted production, simulation score reuse and ties, overtime/request-failure messages across Dashboard and Matchup, historical starter alignment, owned/free-agent navigation, all four roster sections, stale highlight parameters, image fallback/reset, one-game/full-season charts, and recap calculation/copy edge cases.

## Public-data reconciliation and browser observations

- **2026 median league `1312087088669151232`:** all 12 calculated regular-season records match official Sleeper records through Week 2; zero mismatches. The Second Sanborn correctly displays 4–0 rather than 2–0.
- **2024 ordinary league `1048229732543836160`:** all 12 records match official Sleeper records through Week 14; zero mismatches. Preview standings correctly retain ordinary records such as 12–2, and exclude playoff weeks.
- Dashboard and standings were checked at **375, 390, 430, 768, and 1280px**, in dark and light themes, without page-level horizontal overflow. Standings tab touch targets measured at least 44px.
- Signed-out owned-player navigation was exercised in the browser: Mahomes → View in Lineup → roster 3 with `?player=4046`, focused/highlighted row.
- Pregame Week 3 shows labeled projections; a missing starter forecast explains the unavailable estimate instead of substituting an average. Completed Week 2 team totals say Final.
- The document's **97.36–86.54 / 10.82-point** example renders factual Closest Matchup copy.
- Keyboard arrow navigation was verified on recap tabs. No browser console errors were reported in the inspected preview log.
- Existing production was inspected read-only. Desktop roster photos already exist in starters, bench, taxi, and IR. At 375px, sampled production roster photos have zero rendered width because they are hidden; the updated preview displays those photos.

## Remaining release gates — do not treat this as deployment approval

- Complete the **entire page/consumer × viewport × theme** visual matrix; current browser coverage is targeted, not an exhaustive matrix for every segmented-tab consumer.
- Confirm clipboard and exported-image parity end to end. The browser's Copy Text interaction timed out and did not yield verified clipboard content. Screen facts and shared copy templates are covered, but the downloadable image has not been visually validated.
- Resolve the production deployment to its exact commit before promotion. The live behavior was compared, but the exact deployed SHA was not established from the public page.
- Deploy a reviewed immutable candidate only after the remaining gates pass, smoke-test that deployment, and retain the existing production deployment for rollback. No deployment was replaced during this task.

Passing tests and targeted browser checks reduce regression risk; they do not guarantee that every downstream behavior is bug-free.
