# Sleeper live projection calculation — September 13, 2026

The screenshots support a simple calculation that matches all 34 live offensive players and all five live defenses within 0.01 points. Including kickers, 40 of 42 live player estimates match within 0.01. Across the ten team totals, the mean absolute difference is 0.193 points and the largest is 0.543 points.

This is an inferred reproduction of the supplied examples, not an officially documented Sleeper algorithm or proof of future scoring accuracy. No coefficients were fitted to individual players or teams. All live examples are from halftime or the third quarter of the same week and league.

## Calculation

Let:

- `A` = the player's actual fantasy score, using this league's scoring.
- `P` = the player's original full-game projection, using this league's scoring.
- `r` = regulation game seconds remaining divided by 3,600.

For a live QB, RB, WR, TE or kicker:

```text
remaining projection = max(P − A, 0) × r + A × r²
projected final score = A + remaining projection
```

For a live team defense, the examples match without the `A × r²` term:

```text
remaining projection = max(P − A, 0) × r
projected final score = A + remaining projection
```

Before kickoff, use `P`. Once the game is final, use `A`. Add the final estimates for the actual starting lineup to obtain the team's projected total. The score already earned must be counted only once.

For quarter `q` from 1 through 4 with clock `mm:ss`, regulation seconds remaining are `(4 − q) × 900 + mm × 60 + ss`. Halftime is 1,800 seconds. Status must distinguish a completed game from a game at the end of a quarter; a clock reading of `0:00` alone is insufficient.

Keep unrounded values through scoring and aggregation, then round for display. The screenshots' individual rounded values can sum to one cent above or below the header total.

## Examples

Lamar Jackson has `A = 23.16` and `P = 21.8412` at the start of Q3, so `r = 0.5`. His projected final score is `23.16 + 0 + 23.16 × 0.25 = 28.95`, exactly as displayed.

Baker Mayfield has `A = 3.80`, `P = 22.0448`, and Q3 5:46 remaining. With `r = 1246 / 3600`, the result is approximately `10.5699`, displayed as `10.57` in Sleeper.

Pittsburgh's defense has `A = 9.00`, `P = 9.22`, and Q3 10:54 remaining. Its result is `9 + 0.22 × (1554 / 3600) = 9.09497`, displayed as `9.09`.

## All ten team totals

Team labels below are abbreviated to keep the comparison readable.

| Team | Sleeper screenshot | Calculated | Difference |
|---|---:|---:|---:|
| Prescott | 103.62 | 104.16 | +0.54 |
| Buttery | 90.74 | 91.23 | +0.49 |
| Epstein | 82.03 | 82.03 | 0.00 |
| Tenants | 103.35 | 103.35 | 0.00 |
| Second Sanborn | 101.14 | 101.31 | +0.17 |
| Back2Back | 96.18 | 96.18 | 0.00 |
| Saco | 93.79 | 94.28 | +0.49 |
| TJ | 114.77 | 114.77 | 0.00 |
| Gimme them stinkers Gerry | 131.64 | 131.86 | +0.22 |
| www.creedthoughts.com | 116.84 | 116.84 | 0.00 |

## Remaining discrepancies

All five player discrepancies over 0.01 involve kickers:

| Player | State | Calculated minus displayed |
|---|---|---:|
| Trey Smack | Before kickoff | +0.548 |
| Will Reichard | Before kickoff | +0.494 |
| Brandon Aubrey | Before kickoff | +0.489 |
| Chase McLaughlin | Live | +0.167 |
| Jake Bates | Live | +0.221 |

The first three differences already exist in pregame projections, so they cannot be caused by the remaining-time formula. McLaughlin and Bates are consistent with an approximately half-point difference in their pregame inputs after scaling by remaining time, but their original projections are not shown in these screenshots. Their cause remains unconfirmed. Cairo Santos, the third live kicker, matches exactly; since his actual score exceeds his pregame projection, this formula does not depend on his precise pregame value at that moment.

The league uses custom field-goal yardage and missed-kick scoring. Both public projection endpoints inspected returned the same relevant kicker stat lines. Do not introduce a blanket kicker correction based on this one sample; verify the original projection breakdown first.

## Evidence and reproducibility

- Five user-provided screenshots dated September 13, 2026, approximately 15:02 Eastern: the `WhatsApp Image 2026-09-13 at 15.02.01` and `15.02.02` images attached to this task.
- [Sleeper league settings](https://api.sleeper.app/v1/league/1312087088669151232) and [weekly projection stat lines](https://api.sleeper.app/v1/projections/nfl/regular/2026/1), retrieved at approximately 15:03 Eastern. `P` is the dot product of the raw projected stat line and this league's scoring settings, with full numerical precision retained.
- [Sleeper's documented matchup API](https://docs.sleeper.com/#getting-matchups-in-a-league) describes actual scores and starters but does not document this live projection formula.
- [Sleeper's points breakdown instructions](https://support.sleeper.com/en/articles/4126744-how-can-i-see-my-player-s-points-breakdown) explain where to inspect original projections and scoring details.

`samples.json` preserves all 90 transcribed starter rows, their API-derived pregame values, team header totals and scoring settings. `comparison.csv` contains every calculation and residual. Finished players' small projection numbers remain their original forecasts; the comparison correctly uses their actual scores for projected team totals.

Run the repeatable comparison with Python's standard library:

```sh
python3 research/sleeper-live-projections/validate.py
```

The script asserts the reported sample counts, agreement thresholds and explicit kicker exceptions. It does not claim independent predictive validation: these are the same screenshots used to infer the calculation.

## App integration considerations

Use a shared calculation for the Dashboard and Matchup page so their totals agree. Calculate from each starter's actual points, original league-scored projection and game clock; do not substitute an entire weekly projection for points still to come.

Additional acceptance cases remain: Q1/Q2/Q4 examples, overtime, negative actual scores, zero or missing projections, missing or delayed game clocks, postponed games, substitutions and commissioner score adjustments. The formula above should remain labeled an estimate. Matching the score/time input snapshots is necessary for a close live comparison; feed timing can still cause differences.

Win probability is a separate calculation. Agreement with projected scores does not establish agreement with Sleeper's win percentages.

The original investigation was read-only. The subsequent implementation uses `src/lib/liveProjection.js` in both the Dashboard and Matchup page, with these samples included in the automated regression suite. Unknown projections, missing game clocks and overtime return unavailable estimates. The prior full-game additions, season-average substitution and fabricated probability checkpoints have been removed. Kicker inputs remain league-scored without an arbitrary correction.

## Implementation verification

- 345 automated tests pass, including all ten screenshot teams, custom scoring, negative/zero scores, missing projections and clocks, overtime, completed games, slot alignment, score adjustments and both rendered views.
- Production build passes. Lint has zero errors and 18 existing warnings.
- Dashboard and Matchup checked at 375, 390, 430, 768, 1280 and 1440 pixels in dark and light themes. The win estimate sits above the team columns; long names stay within their columns. Mobile screenshots and DOM geometry were inspected after the reported overlap was fixed.
