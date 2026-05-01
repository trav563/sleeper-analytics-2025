import { useMemo } from 'react';

/**
 * Per-position percentile-ranked roster strength. Quality is measured by
 * summing the top-N starters' FantasyCalc dynasty values, then ranking the
 * user against every other team in the league. Headcount-based logic was
 * misleading in dynasty leagues where every roster has 25+ players.
 *
 * Returns:
 *   {
 *     positions: [{
 *       pos, required, userStrength, median, valueVsMedian,
 *       rank, leagueSize, percentile,
 *       urgency: 'critical' | 'below' | 'average' | 'strong' | 'unknown',
 *       needWeight,
 *     }],
 *     weights: { QB: 0.6, RB: 2.5, ... }   // for Best-for-My-Team sort
 *   }
 */

const URGENCY_FROM_PERCENTILE = (p) => {
    if (p == null) return 'unknown';
    if (p < 0.25) return 'critical';
    if (p < 0.50) return 'below';
    if (p < 0.75) return 'average';
    return 'strong';
};

// Wide spread so the Best-for-My-Team sort actually re-orders the list.
// 4.16x ratio between strongest and weakest position weight.
const URGENCY_WEIGHT = {
    critical: 2.5,
    below: 1.7,
    average: 1.0,
    strong: 0.6,
    unknown: 1.0,
};

function computePositionStrength(roster, players, marketValues, position, requiredCount) {
    const ids = roster?.players || [];
    const valued = ids
        .map((pid) => {
            const p = players?.[pid];
            if (!p || p.position !== position) return null;
            const fc = marketValues?.[pid] ?? 0;
            if (fc > 0) return fc;
            // Sleeper-native fallback: lower search_rank = better. Same formula
            // as useBestAvailable so the panel still produces meaningful
            // strength scores when FantasyCalc returns empty.
            const searchRank = p.search_rank ?? 9999;
            return Math.max(0, (10000 - Math.min(searchRank, 10000)) / 10);
        })
        .filter((v) => v != null)
        .sort((a, b) => b - a); // best players first
    return valued
        .slice(0, Math.max(requiredCount, 1))
        .reduce((sum, v) => sum + v, 0);
}

export function useTeamNeeds({ league, userRoster, rosters, players, marketValues }) {
    return useMemo(() => {
        if (!league || !userRoster || !rosters || !players) return null;

        // Required starting slots by position.
        // FLEX/SUPER_FLEX distributed fractionally then ceiled.
        const startingSlots = (league.roster_positions || []).filter(
            (s) => s !== 'BN' && s !== 'IR'
        );
        const slotsByPos = {};
        startingSlots.forEach((s) => {
            if (s === 'FLEX') {
                ['RB', 'WR', 'TE'].forEach((p) => {
                    slotsByPos[p] = (slotsByPos[p] || 0) + 1 / 3;
                });
            } else if (s === 'SUPER_FLEX') {
                ['QB', 'RB', 'WR', 'TE'].forEach((p) => {
                    slotsByPos[p] = (slotsByPos[p] || 0) + 1 / 4;
                });
            } else {
                slotsByPos[s] = (slotsByPos[s] || 0) + 1;
            }
        });

        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const leagueSize = rosters.length;

        const rows = positions.map((pos) => {
            const required = Math.max(1, Math.ceil(slotsByPos[pos] || 0));

            // Each team's starter quality at this position
            const allStrengths = rosters.map((r) =>
                computePositionStrength(r, players, marketValues, pos, required)
            );
            const userStrength = computePositionStrength(
                userRoster,
                players,
                marketValues,
                pos,
                required
            );

            // Percentile rank (0 = worst, 1 = best).
            // Use strict-less-than so ties don't inflate the user's percentile.
            const sortedAsc = [...allStrengths].sort((a, b) => a - b);
            const teamsBelow = sortedAsc.filter((v) => v < userStrength).length;
            const percentile = leagueSize > 1 ? teamsBelow / (leagueSize - 1) : 0.5;

            // Display rank: 1 = best, leagueSize = worst.
            const sortedDesc = [...allStrengths].sort((a, b) => b - a);
            const rank = sortedDesc.findIndex((v) => v <= userStrength) + 1 || leagueSize;

            const median = sortedAsc[Math.floor(leagueSize / 2)] || 0;
            const valueVsMedian = userStrength - median;

            // Empty-league-at-position case (e.g. nobody owns a K yet in a startup).
            // Don't misleadingly mark every position critical.
            const allZero = sortedAsc.every((v) => v === 0);
            const urgency = allZero ? 'average' : URGENCY_FROM_PERCENTILE(percentile);

            return {
                pos,
                required,
                userStrength,
                median,
                valueVsMedian,
                rank,
                leagueSize,
                percentile,
                urgency,
                needWeight: URGENCY_WEIGHT[urgency],
            };
        });

        const weights = {};
        rows.forEach((r) => {
            weights[r.pos] = r.needWeight;
        });

        return { positions: rows, weights };
    }, [league, userRoster, rosters, players, marketValues]);
}
