import { useMemo } from 'react';

// Dynasty consensus aging thresholds
const AGING_BY_POS = { QB: 35, RB: 27, WR: 29, TE: 30 };

// How deep we want to be at each position before declaring "good".
// Includes starters + reasonable bench depth.
const DEPTH_TARGETS = { QB: 2, RB: 5, WR: 5, TE: 2, K: 1, DEF: 1 };

// Need-weight multipliers used by the "Best for My Team" sort.
const URGENCY_WEIGHT = { critical: 2.0, aging: 1.5, depth: 1.2, good: 1.0 };

/**
 * Computes positional roster gaps for the user's team:
 *
 *   { positions: [{ pos, required, ownedCount, agingCount, depthTarget,
 *                  urgency: 'critical' | 'aging' | 'depth' | 'good',
 *                  needWeight }],
 *     weights: { QB: 1.0, RB: 1.5, ... } }
 *
 * Required-by-position is derived from `league.roster_positions` with FLEX
 * and SUPER_FLEX distributed fractionally then ceiled. Aging applies the
 * AGING_BY_POS thresholds to the youngest N starters.
 */
export function useTeamNeeds({ league, userRoster, players }) {
    return useMemo(() => {
        if (!league || !userRoster || !players) return null;

        // 1. Required starting slots by position
        const startingSlots = (league.roster_positions || []).filter((s) => s !== 'BN' && s !== 'IR');
        const slotsByPos = {};
        startingSlots.forEach((s) => {
            if (s === 'FLEX') {
                ['RB', 'WR', 'TE'].forEach((p) => { slotsByPos[p] = (slotsByPos[p] || 0) + 1 / 3; });
            } else if (s === 'SUPER_FLEX') {
                ['QB', 'RB', 'WR', 'TE'].forEach((p) => { slotsByPos[p] = (slotsByPos[p] || 0) + 1 / 4; });
            } else {
                slotsByPos[s] = (slotsByPos[s] || 0) + 1;
            }
        });

        // 2. Current roster grouped by position
        const owned = (userRoster.players || [])
            .map((pid) => players[pid])
            .filter(Boolean);
        const byPos = {};
        for (const p of owned) {
            const pos = p.position;
            if (!byPos[pos]) byPos[pos] = [];
            byPos[pos].push(p);
        }

        // 3. Per-position analysis
        const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
        const rows = positions.map((pos) => {
            const required = Math.ceil(slotsByPos[pos] || 0);
            const players = byPos[pos] || [];
            const ownedCount = players.length;
            const depthTarget = DEPTH_TARGETS[pos] || 1;

            // The youngest `required` players are presumed starters; check if they're aging.
            const sortedByAge = [...players].sort((a, b) => (a.age ?? 99) - (b.age ?? 99));
            const startersToCheck = sortedByAge.slice(0, required);
            const agingThreshold = AGING_BY_POS[pos] ?? 99;
            const agingCount = startersToCheck.filter(
                (p) => p.age != null && p.age >= agingThreshold
            ).length;

            let urgency;
            if (ownedCount < required) urgency = 'critical';
            else if (agingCount > 0) urgency = 'aging';
            else if (ownedCount < depthTarget) urgency = 'depth';
            else urgency = 'good';

            return {
                pos,
                required,
                ownedCount,
                agingCount,
                depthTarget,
                urgency,
                needWeight: URGENCY_WEIGHT[urgency],
            };
        });

        const weights = {};
        rows.forEach((r) => { weights[r.pos] = r.needWeight; });

        return { positions: rows, weights };
    }, [league, userRoster, players]);
}
