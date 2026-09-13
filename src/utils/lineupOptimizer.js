import { assignLineup, gameHasStarted, SLOT_ELIGIBILITY } from './lineupAssignment.js';
import { ownedPlayerIds } from './valuation.js';

export function optimizeRoster({ roster, players, slots, projections, games, now = Date.now() }) {
    if (!roster || !slots) return { unavailable: 'Choose a roster.' };
    if (slots.some(s => !['BN', 'IR'].includes(s) && !SLOT_ELIGIBILITY[s])) return { unavailable: 'This lineup has unsupported slots; no changes have been recommended.' };
    if (!Object.keys(games || {}).length || !Object.keys(projections || {}).length) return { unavailable: 'Waiting for game status and projections before recommending legal moves.' };
    const changeable = game => game && !['STATUS_UNKNOWN', 'STATUS_POSTPONED', 'STATUS_CANCELED'].includes(game.statusName)
        && Number.isFinite(Date.parse(game.kickoff)) && !gameHasStarted(game, now);
    const inactive = new Set([...(roster.reserve || []), ...(roster.taxi || [])]);
    const pool = ownedPlayerIds(roster).map(id => ({ ...players[id], id })).filter(p => p.position);
    const fixed = {};
    const current = slots.map((slot, index) => ({ slot, index, player: pool.find(p => p.id === roster.starters?.[index]) || null })).filter(r => SLOT_ELIGIBILITY[r.slot]);
    for (const row of current) {
        if (row.player && (!changeable(games[row.player.team]) || !Number.isFinite(projections[row.player.id]))) fixed[row.index] = row.player;
    }
    const available = pool.filter(p => !inactive.has(p.id) && changeable(games[p.team])
        && !['Out', 'IR', 'PUP', 'Sus', 'Doubtful'].includes(p.injury_status)
        && !['Inactive', 'Injured Reserve', 'Suspended'].includes(p.status)
        && Number.isFinite(projections[p.id]));
    const valueFor = p => projections[p.id] ?? 0;
    const optimal = assignLineup(slots, available, valueFor, fixed);
    const rows = current.map(row => ({ ...row, next: optimal.assignments[row.index] || null,
        locked: row.index in fixed, changed: (row.player?.id || null) !== (optimal.assignments[row.index]?.id || null) }));
    return { rows, currentTotal: current.reduce((n, r) => n + (r.player ? valueFor(r.player) : 0), 0), optimalTotal: optimal.total,
        changed: rows.some(r => r.changed), missing: rows.some(r => !r.next),
        unknown: rows.some(r => r.player && (!games[r.player.team] || !Number.isFinite(projections[r.player.id]))) };
}
