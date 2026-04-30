import { useMemo } from 'react';

const FANTASY_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];

/**
 * Computes the available player pool, sorted by FantasyCalc value descending,
 * filtered by draft type and position. Already-drafted players are excluded.
 *
 * Returns plain array of player objects with `value` attached:
 *   { id, name, pos, team, age, years_exp, injury_status, value }
 */
export function useBestAvailable({
    players,
    picks,
    marketValues,
    rosters,
    draftType,
    positionFilter = 'ALL',
    limit = 200,
    teamWeights = null,
    mode = 'bpa',
}) {
    return useMemo(() => {
        if (!players) return [];

        const draftedIds = new Set((picks || []).map(p => p.player_id).filter(Boolean));
        // For annual redraft / rookie continuation, also exclude existing roster players (kept).
        if (draftType === 'rookie' || draftType === 'annual_redraft') {
            (rosters || []).forEach(r => (r.players || []).forEach(pid => draftedIds.add(pid)));
        }

        const out = [];
        for (const pid of Object.keys(players)) {
            const p = players[pid];
            if (!p || draftedIds.has(pid)) continue;
            const pos = p.position;
            if (!FANTASY_POSITIONS.includes(pos)) continue;
            if (positionFilter !== 'ALL' && pos !== positionFilter) continue;
            if (!p.active && pos !== 'DEF') continue;

            // Rookie-only filter: keep years_exp === 0 AND pre-draft prospects
            // (years_exp == null) — see RosterClogger.jsx:82-84 for that nuance.
            if (draftType === 'rookie' && p.years_exp != null && p.years_exp !== 0) continue;

            const value = marketValues?.[pid] ?? 0;

            const searchRank = p.search_rank ?? 9999;
            const valueSignal = value > 0 ? value : (10000 - Math.min(searchRank, 10000)) / 10;
            const weight = teamWeights?.[pos] ?? 1.0;

            out.push({
                id: pid,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || pid,
                pos,
                team: p.team || 'FA',
                age: p.age ?? null,
                yearsExp: p.years_exp ?? null,
                injury: p.injury_status || null,
                value,
                searchRank,
                needWeight: weight,
                fitScore: weight * valueSignal,
            });
        }

        // Two sort modes:
        //  - 'bpa'   → FC value desc → search_rank asc → name (default)
        //  - 'forMe' → fitScore desc (need-weighted)
        if (mode === 'forMe' && teamWeights) {
            out.sort((a, b) => {
                if (b.fitScore !== a.fitScore) return b.fitScore - a.fitScore;
                return a.name.localeCompare(b.name);
            });
        } else {
            out.sort((a, b) => {
                if (b.value !== a.value) return b.value - a.value;
                if (a.searchRank !== b.searchRank) return a.searchRank - b.searchRank;
                return a.name.localeCompare(b.name);
            });
        }
        return out.slice(0, limit);
    }, [players, picks, marketValues, rosters, draftType, positionFilter, limit, teamWeights, mode]);
}
