import { useMemo } from 'react';

/**
 * Insert tier-break boundaries based on value gaps. Returns an array of tier
 * objects: [{ tier: 1, players: [...] }, ...]. The cutoff is the larger of an
 * absolute floor (150) and a multiplier on the median gap so it adapts to any
 * value scale (rookie draft has tighter gaps than startup).
 */
export function useTierBreaks(players) {
    return useMemo(() => {
        if (!players || players.length === 0) return [];

        const valued = players.filter(p => p.value > 0);
        if (valued.length === 0) {
            return [{ tier: 1, players }];
        }

        const gaps = [];
        for (let i = 0; i < valued.length - 1; i++) {
            gaps.push(valued[i].value - valued[i + 1].value);
        }
        gaps.sort((a, b) => a - b);
        const median = gaps[Math.floor(gaps.length / 2)] || 0;
        const cutoff = Math.max(150, median * 3);

        const tiers = [];
        let current = { tier: 1, players: [] };
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            current.players.push(p);
            const next = players[i + 1];
            if (next && p.value > 0 && next.value > 0 && (p.value - next.value) >= cutoff) {
                tiers.push(current);
                current = { tier: current.tier + 1, players: [] };
            }
        }
        if (current.players.length) tiers.push(current);
        return tiers;
    }, [players]);
}
