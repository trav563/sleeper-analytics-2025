export const SLOT_ELIGIBILITY = {
    QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF'],
    FLEX: ['RB', 'WR', 'TE'], WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'],
    SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};

export function eligibleForSlot(player, slot) {
    return (player.fantasy_positions || [player.position]).some(p => SLOT_ELIGIBILITY[slot]?.includes(p));
}

/** Slots a lineup must actually fill — bench, IR and taxi are not scored. */
export function scoringSlots(slots) {
    return (slots || []).filter(slot => SLOT_ELIGIBILITY[slot]);
}

/**
 * Did the manager put a player in every starting slot?
 *
 * Sleeper pads `starters` with the string "0" for a slot left empty, so an
 * abandoned lineup still reports a score — it is just the handful of players
 * who were in there. Records that rank teams against each other should drop
 * those weeks rather than treat a forfeit as a performance. A lineup full of
 * players who happened to score nothing is NOT incomplete and still counts.
 *
 * `slots` is optional: without it the "0" check stands on its own, since
 * Sleeper returns one `starters` entry per starting slot.
 */
export function lineupIsComplete(matchup, slots) {
    const starters = matchup?.starters;
    if (!Array.isArray(starters) || starters.length === 0) return false;
    if (starters.some(id => !id || id === '0')) return false;
    const required = scoringSlots(slots).length;
    return required === 0 || starters.length >= required;
}

/** Maximum-weight rectangular assignment (Hungarian algorithm), including empty slots.
 * Fixed assignments preserve kicked-off starters. Every player appears at most once.
 */
export function assignLineup(slots, pool, valueFor, fixed = {}) {
    const assignments = { ...fixed };
    const used = new Set(Object.values(fixed).filter(Boolean).map(p => p.id));
    const rows = slots.map((slot, index) => ({ slot, index })).filter(r => SLOT_ELIGIBILITY[r.slot] && !(r.index in fixed));
    const players = [...new Map(pool.filter(p => !used.has(p.id)).map(p => [p.id, p])).values()];
    const n = rows.length, m = players.length + n;
    const u = Array(n + 1).fill(0), v = Array(m + 1).fill(0), p = Array(m + 1).fill(0), way = Array(m + 1).fill(0);
    const cost = (i, j) => {
        const player = players[j - 1];
        if (!player) return 0;
        return eligibleForSlot(player, rows[i - 1].slot) ? -(100000 + valueFor(player)) : 1e9;
    };
    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = Array(m + 1).fill(Infinity), seen = Array(m + 1).fill(false);
        do {
            seen[j0] = true;
            const i0 = p[j0];
            let delta = Infinity, j1 = 0;
            for (let j = 1; j <= m; j++) if (!seen[j]) {
                const cur = cost(i0, j) - u[i0] - v[j];
                if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
                if (minv[j] < delta) { delta = minv[j]; j1 = j; }
            }
            for (let j = 0; j <= m; j++) {
                if (seen[j]) { u[p[j]] += delta; v[j] -= delta; }
                else minv[j] -= delta;
            }
            j0 = j1;
        } while (p[j0] !== 0);
        do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    for (let j = 1; j <= m; j++) if (p[j]) {
        const row = rows[p[j] - 1], player = players[j - 1];
        assignments[row.index] = player && eligibleForSlot(player, row.slot) ? player : null;
    }
    const assigned = Object.values(assignments).filter(Boolean);
    return { assignments, total: assigned.reduce((s, player) => s + valueFor(player), 0), filled: assigned.length };
}

export function gameHasStarted(game, now = Date.now()) {
    if (!game) return false;
    if (['STATUS_POSTPONED', 'STATUS_CANCELED'].includes(game.statusName)) return false;
    return ['STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_END_PERIOD', 'STATUS_DELAYED'].includes(game.statusName)
        || (game.kickoff && Date.parse(game.kickoff) <= now);
}
