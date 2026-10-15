import { assignLineup, SLOT_ELIGIBILITY } from './lineupAssignment.js';
import { ownedPlayerIds, tradeWindowOpen, valuationSettings } from './valuation.js';

export const TRADE_VALUE_TOLERANCE = 0.15;
export const CONSOLIDATION_PREMIUM = 0.10;
export const MARKET_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Each side must improve by at least this share under its own strategy. */
export const MIN_STRATEGY_GAIN = 0.01;
/** No package piece may be worth less than this share of the deal's largest piece. */
export const THROW_IN_SHARE = 0.25;
/** Last age at which a position is still in its prime for a multi-season plan. */
export const PRIME_AGE_END = { QB: 30, RB: 25, WR: 27, TE: 28 };
export const STRATEGY_LABELS = { contender: 'Contender', balanced: 'Balanced', rebuilder: 'Rebuilder' };

/** Which roster change each strategy is judged on; balanced teams average both. */
export const JUDGED_ON = { contender: ['now'], balanced: ['now', 'future'], rebuilder: ['future'] };

const SKILL = ['QB', 'RB', 'WR', 'TE'];
const POOL_SIZE = 18;
const MAX_OFFERS = 5;
const BASIS = { contender: 'this season', balanced: 'the average of both', rebuilder: 'future value' };

export function trustworthyMarket(snapshot, now = Date.now()) {
    return !!snapshot?.trustworthy && Number.isFinite(snapshot.fetchedAt) && now >= snapshot.fetchedAt && now - snapshot.fetchedAt <= MARKET_MAX_AGE_MS;
}

/** A rebuilder's horizon is 2-3 seasons, so value past a position's prime is discounted
 * on top of the market price. Picks and players of unknown age keep full value. */
export function futureFactor(asset) {
    const prime = PRIME_AGE_END[asset.position];
    if (asset.kind === 'pick' || !prime || !asset.age) return 1;
    return Math.max(0.35, 1 - 0.15 * Math.max(0, asset.age - prime));
}

export const formatChange = x => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}%`;

/** Plain-language fit for one side: both changes, plus the one its strategy is judged on. */
export function describeFit({ strategy, nowChange, futureChange }) {
    return `starting lineup ${formatChange(nowChange)} this season, future value ${formatChange(futureChange)} (judged on ${BASIS[strategy]})`;
}

const marketValue = a => Number.isFinite(a.tradeValue) && a.tradeValue > 0 ? a.tradeValue : 0;
const change = (after, before) => before > 0 ? (after - before) / before : 0;
const available = p => p.ownershipStatus === 'Active' && !['Out', 'IR', 'PUP', 'Sus'].includes(p.injury_status);
const percentile = (list, v) => list.length > 1 ? list.filter(x => x < v).length / (list.length - 1) : 0.5;

/** Shared roster model: market value prices fairness, win-now value fills the starting
 * lineup, and age-discounted market value measures the future. Unvalued players count as
 * zero so they can still fill a slot, but they are never offered. */
function buildModel({ league, rosters, players, snapshot, winNowSnapshot, picks = [] }) {
    const slots = (league.roster_positions || []).filter(s => SLOT_ELIGIBILITY[s] && !['K', 'DEF'].includes(s));
    if (!slots.length) return null;
    if ((league.roster_positions || []).some(s => !['BN', 'IR'].includes(s) && !SLOT_ELIGIBILITY[s])) return null;
    const { isDynasty } = valuationSettings(league, rosters.length);
    const winNowFallback = isDynasty && !trustworthyMarket(winNowSnapshot);
    const winNow = isDynasty && !winNowFallback ? winNowSnapshot.values : snapshot.values;
    const ownership = new Map();
    for (const roster of rosters) for (const id of ownedPlayerIds(roster)) ownership.set(id, (ownership.get(id) || 0) + 1);
    const lineupOf = pool => assignLineup(slots, pool, p => p.winNowValue);
    const futureOf = assets => assets.reduce((sum, a) => sum + marketValue(a) * futureFactor(a), 0);
    const teams = rosters.map(roster => {
        const skill = ownedPlayerIds(roster).filter(id => SKILL.includes(players[id]?.position)).map(id => ({
            ...players[id], id, kind: 'player',
            ownershipStatus: roster.reserve?.includes(id) ? 'IR' : roster.taxi?.includes(id) ? 'Taxi' : 'Active',
            tradeValue: snapshot.values[id], winNowValue: winNow[id] > 0 ? winNow[id] : 0,
        }));
        const ownPicks = isDynasty ? picks.filter(p => p.roster_id === roster.roster_id).map(p => ({
            id: p.id, kind: 'pick', position: 'PICK', name: p.description, year: p.year, round: p.round,
            original_owner_id: p.original_owner_id, tradeValue: p.tradeValue,
        })) : [];
        const tradable = [...skill.filter(p => ownership.get(p.id) === 1), ...ownPicks].filter(a => marketValue(a) > 0)
            .sort((a, b) => b.tradeValue - a.tradeValue).slice(0, POOL_SIZE);
        const s = roster.settings || {};
        const games = (s.wins || 0) + (s.losses || 0) + (s.ties || 0);
        return { roster, skill, picks: ownPicks, tradable, lineup: lineupOf(skill), activeLineup: lineupOf(skill.filter(available)),
            future: futureOf([...skill, ...ownPicks]), games, winPct: games ? ((s.wins || 0) + (s.ties || 0) / 2) / games : 0, pointsFor: s.fpts || 0 };
    });
    const withRecords = teams.every(t => t.games >= 2);
    for (const t of teams) {
        const lineupRank = percentile(teams.map(x => x.lineup.total), t.lineup.total);
        const score = withRecords ? (percentile(teams.map(x => x.winPct), t.winPct) + percentile(teams.map(x => x.pointsFor), t.pointsFor) + lineupRank) / 3 : lineupRank;
        t.strategy = !isDynasty || score >= 0.6 ? 'contender' : score <= 0.35 ? 'rebuilder' : 'balanced';
    }
    return { teams, lineupOf, futureOf, winNowFallback };
}

/** Contender / Balanced / Rebuilder for every roster, keyed by roster_id. Redraft teams are all contenders. */
export function classifyTeams(args) {
    const model = buildModel(args);
    return model ? Object.fromEntries(model.teams.map(t => [t.roster.roster_id, t.strategy])) : {};
}

/** Strategy-aware offers. The AI may explain these, never invent assets.
 * Fairness uses market value; each side must gain under its own strategy: a contender's
 * win-now starting lineup, a rebuilder's age-discounted future value, or a blend of both.
 * Long-term ownership includes IR/taxi; availability is separate from asset value.
 * mode: 'trade-up' (send 2, get 1), 'swap' (1-for-1), 'trade-down' (send 1, get 2).
 */
export function generateTradeCandidates({ league, rosters, players, snapshot, winNowSnapshot, picks, rosterId, mode = 'trade-up', state, strategyOverride }) {
    if (!trustworthyMarket(snapshot) || !tradeWindowOpen(league, state)) return [];
    const model = buildModel({ league, rosters, players, snapshot, winNowSnapshot, picks });
    if (!model) return [];
    const { teams, lineupOf, futureOf } = model;
    const mine = teams.find(t => t.roster.roster_id === Number(rosterId));
    if (!mine) return [];
    const myStrategy = STRATEGY_LABELS[strategyOverride] ? strategyOverride : mine.strategy;

    const evaluate = (team, strategy, out, incoming) => {
        const outIds = new Set(out.map(a => a.id));
        const kept = [...team.skill, ...team.picks].filter(a => !outIds.has(a.id));
        const skillAfter = [...kept.filter(a => a.kind === 'player'), ...incoming.filter(a => a.kind === 'player')];
        // The premium paid to a team taking two-for-one buys its lost roster spot, so it is not future value.
        const credit = incoming.length > out.length ? 1 / (1 + CONSOLIDATION_PREMIUM) : 1;
        const futureDelta = futureOf(kept) + futureOf(incoming) * credit - team.future;
        const futureChange = change(team.future + futureDelta, team.future);
        const gainFor = nowChange => strategy === 'contender' ? nowChange : strategy === 'rebuilder' ? futureChange : (nowChange + futureChange) / 2;
        // Incoming win-now value caps the lineup gain, so most misses skip the lineup solve.
        const nowCeiling = change(team.lineup.total + incoming.reduce((n, a) => n + (a.winNowValue || 0), 0), team.lineup.total);
        if (gainFor(nowCeiling) < MIN_STRATEGY_GAIN) return null;
        const after = lineupOf(skillAfter);
        if (after.filled < team.lineup.filled) return null;
        const nowChange = change(after.total, team.lineup.total);
        const gain = gainFor(nowChange);
        if (gain < MIN_STRATEGY_GAIN) return null;
        // A long-term stash can carry value without being available to fill this week's lineup.
        if (lineupOf(skillAfter.filter(available)).filled < team.activeLineup.filled) return null;
        return { strategy, nowChange, futureChange, nowDelta: after.total - team.lineup.total, futureDelta, gain };
    };
    const pairs = list => list.flatMap((a, i) => list.slice(i + 1).map(b => [a, b]));
    const sum = list => list.reduce((n, a) => n + a.tradeValue, 0);
    const fair = (give, receive) => {
        const giveValue = sum(give), receiveValue = sum(receive);
        const largest = Math.max(...give.map(a => a.tradeValue), ...receive.map(a => a.tradeValue));
        if ([...give, ...receive].some(a => a.tradeValue < largest * THROW_IN_SHARE)) return false;
        // The side receiving the best single asset pays the consolidation premium.
        const [payer, single] = give.length > receive.length ? [giveValue, receiveValue] : receive.length > give.length ? [receiveValue, giveValue] : [giveValue, receiveValue];
        const premium = give.length === receive.length ? 0 : CONSOLIDATION_PREMIUM;
        // The epsilon keeps exact band edges (100 × 1.1) from failing on floating-point error.
        return payer >= single * (1 + premium) - 1e-9 && payer <= single * (1 + premium + TRADE_VALUE_TOLERANCE) + 1e-9;
    };

    const offers = [];
    for (const other of teams) {
        if (other === mine) continue;
        const deals = mode === 'trade-up' ? other.tradable.flatMap(t => pairs(mine.tradable).map(give => [give, [t]]))
            : mode === 'trade-down' ? mine.tradable.flatMap(g => pairs(other.tradable).map(receive => [[g], receive]))
            : other.tradable.flatMap(t => mine.tradable.map(g => [[g], [t]]));
        for (const [give, receive] of deals) {
            if (!fair(give, receive)) continue;
            const me = evaluate(mine, myStrategy, give, receive);
            if (!me) continue;
            const them = evaluate(other, other.strategy, receive, give);
            if (!them) continue;
            offers.push({ opponentRosterId: other.roster.roster_id, give, receive, giveValue: sum(give), receiveValue: sum(receive),
                me, them, source: snapshot.source });
        }
    }
    return offers.sort((a, b) => b.me.gain - a.me.gain)
        .filter((offer, i, all) => all.findIndex(o => o.opponentRosterId === offer.opponentRosterId) === i).slice(0, MAX_OFFERS);
}
