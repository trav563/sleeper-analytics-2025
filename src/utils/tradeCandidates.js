import { assignLineup, SLOT_ELIGIBILITY } from './lineupAssignment.js';
import { ownedPlayerIds, tradeWindowOpen } from './valuation.js';

export const TRADE_VALUE_TOLERANCE = 0.15;
export const CONSOLIDATION_PREMIUM = 0.10;
export const MARKET_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function trustworthyMarket(snapshot, now = Date.now()) {
    return !!snapshot?.trustworthy && Number.isFinite(snapshot.fetchedAt) && now >= snapshot.fetchedAt && now - snapshot.fetchedAt <= MARKET_MAX_AGE_MS;
}

/** Conservative player-only offers. The AI may explain these, never invent assets.
 * Long-term ownership includes IR/taxi; availability is separate from asset value.
 * Market-weighted lineup gains describe roster fit, not predicted weekly points.
 */
export function generateTradeCandidates({ league, rosters, players, snapshot, rosterId, mode = 'trade-up', state }) {
    if (!trustworthyMarket(snapshot) || !tradeWindowOpen(league, state)) return [];
    const slots = (league.roster_positions || []).filter(s => SLOT_ELIGIBILITY[s] && !['K', 'DEF'].includes(s));
    if (!slots.length) return [];
    if ((league.roster_positions || []).some(s => !['BN', 'IR'].includes(s) && !SLOT_ELIGIBILITY[s])) return [];
    const ownership = new Map();
    for (const roster of rosters) for (const id of ownedPlayerIds(roster)) ownership.set(id, (ownership.get(id) || 0) + 1);
    const teams = rosters.map(roster => {
        const complete = ownedPlayerIds(roster).every(id => !['QB', 'RB', 'WR', 'TE'].includes(players[id]?.position) || (ownership.get(id) === 1 && Number.isFinite(snapshot.values[id]) && snapshot.values[id] >= 0));
        const assets = ownedPlayerIds(roster).map(id => ({ ...players[id], id, ownershipStatus: roster.reserve?.includes(id) ? 'IR' : roster.taxi?.includes(id) ? 'Taxi' : 'Active', tradeValue: snapshot.values[id] }))
            .filter(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position) && p.tradeValue > 0)
            .sort((a, b) => b.tradeValue - a.tradeValue);
        return { roster, assets, complete, lineup: assignLineup(slots, assets, p => p.tradeValue) };
    });
    const mine = teams.find(t => t.roster.roster_id === Number(rosterId));
    if (!mine?.complete) return [];
    const startingIds = new Set(Object.values(mine.lineup.assignments).filter(Boolean).map(p => p.id));
    const depth = mine.assets.filter(p => !startingIds.has(p.id)).slice(0, 10);
    const gives = mode === 'trade-up'
        ? depth.flatMap((a, i) => depth.slice(i + 1).map(b => [a, b]))
        : mine.assets.slice(0, 14).map(p => [p]);
    const offers = [];
    for (const other of teams) {
        if (other === mine || !other.complete) continue;
        for (const target of other.assets.slice(0, 14)) for (const give of gives) {
            if (give.some(p => p.id === target.id)) continue;
            const giveValue = give.reduce((n, p) => n + p.tradeValue, 0);
            const premium = give.length > 1 ? CONSOLIDATION_PREMIUM : 0;
            if (giveValue < target.tradeValue * (1 + premium) || giveValue > target.tradeValue * (1 + premium + TRADE_VALUE_TOLERANCE)) continue;
            const givingIds = new Set(give.map(p => p.id));
            const myAfter = assignLineup(slots, [...mine.assets.filter(p => !givingIds.has(p.id)), target], p => p.tradeValue);
            const theirAfter = assignLineup(slots, [...other.assets.filter(p => p.id !== target.id), ...give], p => p.tradeValue);
            if (myAfter.filled < mine.lineup.filled || theirAfter.filled < other.lineup.filled) continue;
            // A long-term stash can carry value without being available to fill this week's lineup.
            const available = p => p.ownershipStatus === 'Active' && !['Out', 'IR', 'PUP', 'Sus'].includes(p.injury_status);
            const activeBeforeMine = assignLineup(slots, mine.assets.filter(available), p => p.tradeValue);
            const activeBeforeOther = assignLineup(slots, other.assets.filter(available), p => p.tradeValue);
            const activeAfterMine = assignLineup(slots, [...mine.assets.filter(p => !givingIds.has(p.id)), target].filter(available), p => p.tradeValue);
            const activeAfterOther = assignLineup(slots, [...other.assets.filter(p => p.id !== target.id), ...give].filter(available), p => p.tradeValue);
            if (activeAfterMine.filled < activeBeforeMine.filled || activeAfterOther.filled < activeBeforeOther.filled) continue;
            const myGain = myAfter.total - mine.lineup.total, theirGain = theirAfter.total - other.lineup.total;
            if (myGain <= 0 || theirGain <= 0) continue;
            const theirStarters = new Set(Object.values(theirAfter.assignments).filter(Boolean).map(p => p.id));
            if (!give.every(p => theirStarters.has(p.id))) continue;
            offers.push({ opponentRosterId: other.roster.roster_id, give, receive: [target], giveValue,
                receiveValue: target.tradeValue, myGain, theirGain, source: snapshot.source,
                reason: 'Both teams improve their market-valued starting lineup; no starting slot is lost.' });
        }
    }
    return offers.sort((a, b) => b.myGain - a.myGain).filter((offer, i, all) => all.findIndex(o => o.opponentRosterId === offer.opponentRosterId) === i).slice(0, 3);
}
