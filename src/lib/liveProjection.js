/** Inferred from the September 2026 Sleeper samples in research/sleeper-live-projections. */
export function gamePhase(game) {
    const status = game?.statusName;
    if (['STATUS_FINAL', 'STATUS_FULL_TIME', 'STATUS_FINAL_OVERTIME'].includes(status)) return 'DONE';
    if (['STATUS_SCHEDULED', 'STATUS_PREGAME'].includes(status)) return 'SOON';
    if (['STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_END_PERIOD'].includes(status)) return 'LIVE';
    return 'UNKNOWN';
}

export function regulationFractionRemaining(game) {
    const phase = gamePhase(game);
    if (phase === 'DONE') return 0;
    if (phase === 'SOON') return 1;
    if (phase !== 'LIVE') return null;
    if (game.statusName === 'STATUS_HALFTIME') return 0.5;
    const quarter = Number(game.period);
    // Overtime needs a separate model; zero regulation time does not mean final.
    if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) return null;
    const clock = /^(\d{1,2}):([0-5]\d)$/.exec(game.displayClock || '');
    if (!clock) return null;
    const seconds = Number(clock[1]) * 60 + Number(clock[2]);
    if (seconds > 900) return null;
    return ((4 - quarter) * 900 + seconds) / 3600;
}

export function projectPlayer({ actual, projection, position, game }) {
    const phase = gamePhase(game);
    if (phase === 'DONE') return { remaining: 0, final: Number.isFinite(actual) ? actual : null, phase };
    const r = regulationFractionRemaining(game);
    if (r == null || !Number.isFinite(projection) || !Number.isFinite(actual)) {
        return { remaining: null, final: null, phase };
    }
    if (phase === 'SOON') return { remaining: projection - actual, final: projection, phase };
    const remaining = Math.max(projection - actual, 0) * r + (position === 'DEF' ? 0 : actual * r * r);
    return { remaining, final: actual + remaining, phase };
}

export function starterPoints(matchup, index) {
    const slotPoints = matchup?.starters_points?.[index];
    if (Number.isFinite(slotPoints)) return slotPoints;
    const points = matchup?.players_points?.[matchup?.starters?.[index]];
    return Number.isFinite(points) ? points : null;
}

/** Keep slot indices intact, exclude the bench, and preserve team score adjustments. */
export function projectMatchup({ matchup, players, projections, games }) {
    const bySlot = (matchup?.starters || []).map((pid, index) => {
        if (!pid || pid === '0') return { remaining: 0, final: 0, phase: 'EMPTY' };
        const player = players?.[pid];
        const game = games?.[player?.team || (player?.position === 'DEF' ? pid : '')];
        const actual = starterPoints(matchup, index) ?? (gamePhase(game) === 'SOON' ? 0 : null);
        return projectPlayer({ actual, projection: projections?.[pid], position: player?.position, game });
    });
    const available = Array.isArray(matchup?.starters) && bySlot.every(p => p.remaining != null);
    const remaining = available ? bySlot.reduce((sum, p) => sum + p.remaining, 0) : null;
    const final = available && Number.isFinite(matchup?.points) ? matchup.points + remaining : null;
    return { remaining, final, bySlot, available: final != null };
}

export const formatProjection = value => Number.isFinite(value) ? value.toFixed(2) : '—';
