"""Reproduce the screenshot comparison without network access or dependencies.

Research model only: the observed games are at halftime or in Q3, and have
nonnegative fantasy scores. Overtime, early-game and negative-score behavior
are not established by this sample.
"""

import csv
import json
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent


def remaining_fraction(clock):
    if clock == 'SOON':
        return 1.0
    if clock == 'FINAL':
        return 0.0
    if clock == 'HALF':
        return 0.5
    minutes, seconds = map(int, clock.split(':'))
    # Every numbered clock in these screenshots is in the third quarter.
    return (15 * 60 + minutes * 60 + seconds) / 3600


def estimate(player):
    actual, pregame = player['actual'], player['pregame']
    if player['clock'] == 'SOON':
        return pregame
    if player['clock'] == 'FINAL':
        return actual
    remaining = remaining_fraction(player['clock'])
    extra = max(pregame - actual, 0) * remaining
    if player['position'] != 'DEF':
        extra += actual * remaining ** 2
    return actual + extra


def validate():
    data = json.loads((ROOT / 'samples.json').read_text())
    comparisons, team_errors = [], []
    print(f"{'Team':18} {'Sleeper':>8} {'Model':>8} {'Difference':>11}")
    for team in data['teams']:
        predicted = sum(estimate(p) for p in team['players'])
        observed = team['sleeper_projected_total']
        team_errors.append(abs(predicted - observed))
        print(f"{team['team']:18} {observed:8.2f} {predicted:8.2f} {predicted-observed:+11.2f}")
        for player in team['players']:
            expected = player['actual'] if player['clock'] == 'FINAL' else player['screenshot_projection']
            comparisons.append({
                'team': team['team'], **player,
                'remaining_fraction': remaining_fraction(player['clock']),
                'expected_final': expected,
                'model_final': estimate(player),
                'error': estimate(player) - expected,
            })

    live = [p for p in comparisons if p['clock'] not in ('SOON', 'FINAL')]
    matched = [p for p in live if abs(p['error']) <= .01]
    offense = [p for p in live if p['position'] not in ('K', 'DEF')]
    defense = [p for p in live if p['position'] == 'DEF']
    print(f"\nLive players within 0.01: {len(matched)}/{len(live)}")
    print(f"Offensive players within 0.01: {sum(abs(p['error']) <= .01 for p in offense)}/{len(offense)}")
    print(f"Defenses within 0.01: {sum(abs(p['error']) <= .01 for p in defense)}/{len(defense)}")
    print(f"Mean absolute team error: {mean(team_errors):.3f}")
    print(f"Maximum absolute team error: {max(team_errors):.3f}")
    print('\nDiscrepancies larger than 0.01:')
    for player in comparisons:
        if abs(player['error']) > .01:
            print(f"  {player['name']}: {player['error']:+.3f} ({player['clock']})")

    # Explicit checks of the findings, including the unresolved exceptions.
    assert len(comparisons) == 90
    assert len(live) == 42 and len(matched) == 40
    assert len(offense) == 34 and all(abs(p['error']) <= .01 for p in offense)
    assert len(defense) == 5 and all(abs(p['error']) <= .01 for p in defense)
    assert max(team_errors) < .55
    assert {p['name'] for p in comparisons if abs(p['error']) > .01} == {
        'Trey Smack', 'Will Reichard', 'Chase McLaughlin', 'Brandon Aubrey', 'Jake Bates',
    }
    with (ROOT / 'comparison.csv').open('w', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=comparisons[0].keys())
        writer.writeheader()
        writer.writerows(comparisons)


if __name__ == '__main__':
    validate()
