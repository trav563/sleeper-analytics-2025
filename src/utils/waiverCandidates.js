import { trustworthyMarket } from './tradeCandidates.js';
import { ownedPlayerIds, valuationSettings } from './valuation.js';
export const DYNASTY_STASH_PROTECTION_RATIO = 0.10;
/** Only propose an unowned, available, same-position upgrade with known prices.
 * Young players, IR/taxi and valuable dynasty stashes are never casual drops.
 */
export function generateWaiverMoves({ league, rosters, rosterId, players, snapshot, rookiesLocked = false }) {
    if (!trustworthyMarket(snapshot)) return [];
    const roster = rosters.find(r => r.roster_id === Number(rosterId));
    if (!roster) return [];
    const dynasty = valuationSettings(league).isDynasty;
    const owned = new Set(rosters.flatMap(ownedPlayerIds));
    const protectedIds = new Set([...(roster.starters || []), ...(roster.reserve || []), ...(roster.taxi || [])]);
    const maxValue = Math.max(0, ...Object.values(snapshot.values).filter(Number.isFinite));
    const drops = ownedPlayerIds(roster).filter(id => {
        const p = players[id], value = snapshot.values[id];
        if (!p || protectedIds.has(id) || !Number.isFinite(value)) return false;
        if (dynasty && (!p.age || p.age < 25 || p.years_exp == null || p.years_exp < 2 || value >= maxValue * DYNASTY_STASH_PROTECTION_RATIO)) return false;
        return true;
    }).sort((a,b) => snapshot.values[a]-snapshot.values[b]);
    const adds = Object.keys(players).filter(id => {
        const p = players[id];
        return !owned.has(id) && p.active && p.team && !['Out','IR','PUP','Sus'].includes(p.injury_status)
            && ['QB','RB','WR','TE','K','DEF'].includes(p.position) && (!rookiesLocked || p.years_exp > 0) && snapshot.values[id] > 0;
    }).sort((a,b) => snapshot.values[b]-snapshot.values[a]);
    const used = new Set(), moves = [];
    for (const drop of drops) {
        const add = adds.find(id => !used.has(id) && players[id].position === players[drop].position && snapshot.values[id] > snapshot.values[drop]);
        if (add) { used.add(add); moves.push({ drop, add, dropValue: snapshot.values[drop], addValue: snapshot.values[add] }); }
        if (moves.length === 3) break;
    }
    return moves;
}
