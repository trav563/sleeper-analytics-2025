import { projectMatchup } from './liveProjection';
import { computeWinProbability } from './winProbability';

// Version includes the probability calibration; do not mix different models.
export const HISTORY_STORAGE_KEY = 'league-win-history-v1-uncertainty45';
export const MAX_HISTORY_POINTS = 1440;
export const HISTORY_GAP_MS = 150_000;
const MAX_HISTORIES = 32;
const MAX_AGE_MS = 45 * 86400_000;
const EMPTY = Object.freeze([]);
let records;
const listeners = new Set();

export function probabilityHistoryKey({ leagueId, season, week, matchupId, rosterIds = [] }) {
    if (!leagueId || !season || !week || matchupId == null || rosterIds.length !== 2 || rosterIds.some(id => id == null)) return null;
    return JSON.stringify([String(leagueId), String(season), Number(week), String(matchupId), ...rosterIds.map(Number).sort((a, b) => a - b)]);
}

function load() {
    if (records) return records;
    records = Object.create(null);
    try {
        const stored = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '{}');
        for (const [key, value] of Object.entries(stored)) {
            if (!Array.isArray(value?.points) || !Number.isFinite(value.updatedAt) || value.updatedAt < Date.now() - MAX_AGE_MS) continue;
            const points = value.points.filter(p => p && Number.isFinite(p.at) && p.at <= Date.now() + 60_000 && Number.isFinite(p.p) && p.p >= 0 && p.p <= 1)
                .sort((a, b) => a.at - b.at).filter((p, i, all) => i === 0 || p.at > all[i - 1].at).slice(-MAX_HISTORY_POINTS);
            if (points.length) records[key] = { ...value, points };
        }
        records = Object.fromEntries(Object.entries(records).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_HISTORIES));
    } catch { /* Storage unavailable or corrupted: recording still works in memory. */ }
    return records;
}

export function readProbabilityHistory(key) {
    return key ? load()[key]?.points || EMPTY : EMPTY;
}

export function subscribeProbabilityHistory(listener) {
    listeners.add(listener);
    const onStorage = event => {
        if (event.key === HISTORY_STORAGE_KEY || event.key === null) {
            records = undefined;
            listeners.forEach(notify => notify());
        }
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
}

function persistHistory() {
    try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(records)); } catch { /* Session-only fallback. */ }
    listeners.forEach(notify => notify());
}

export function appendProbabilitySnapshot(key, { at, p, source, complete = false }, deferWrite = false) {
    if (!key || !Number.isFinite(at) || !Number.isFinite(p) || p < 0 || p > 1) return;
    const data = load();
    const previous = data[key];
    const last = previous?.points.at(-1);
    if (previous?.source === source || (last && at <= last.at) || (previous?.complete && complete && last.p === p)) return;
    // Score and clock queries often finish seconds apart. Replace that observation
    // rather than drawing two apparently independent samples from the same poll.
    const points = [...(previous?.points || [])];
    if (last && at - last.at < 30_000) points.pop();
    points.push({ at, p });
    data[key] = { updatedAt: at, source, complete, points: points.slice(-MAX_HISTORY_POINTS) };
    const retained = Object.entries(data).filter(([, value]) => value.updatedAt >= at - MAX_AGE_MS)
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, MAX_HISTORIES);
    records = Object.fromEntries(retained);
    if (!deferWrite) persistHistory();
    return true;
}

export function recordLeagueProbabilitySnapshots({ league, week, matchups, players, projections, games,
    scoresUpdatedAt, gamesUpdatedAt, enabled, now = Date.now() }) {
    if (!enabled || !league?.league_id || !league?.season || !scoresUpdatedAt || !gamesUpdatedAt || now - Math.min(scoresUpdatedAt, gamesUpdatedAt) > 150_000) return;
    const pairs = new Map();
    for (const matchup of matchups || []) {
        if (matchup.matchup_id == null) continue;
        const pair = pairs.get(matchup.matchup_id) || [];
        pair.push(matchup);
        pairs.set(matchup.matchup_id, pair);
    }
    let changed = false;
    for (const [matchupId, pair] of pairs) {
        if (pair.length !== 2) continue;
        pair.sort((a, b) => a.roster_id - b.roster_id);
        const [a, b] = pair;
        const pa = projectMatchup({ matchup: a, players, projections, games });
        const pb = projectMatchup({ matchup: b, players, projections, games });
        if (!pa.available || !pb.available) continue;
        const key = probabilityHistoryKey({ leagueId: league.league_id, season: league.season, week, matchupId, rosterIds: pair.map(m => m.roster_id) });
        changed = appendProbabilitySnapshot(key, {
            at: now,
            p: computeWinProbability({ myCurrent: a.points, oppCurrent: b.points, myProjRemaining: pa.remaining, oppProjRemaining: pb.remaining }),
            source: `${scoresUpdatedAt}:${gamesUpdatedAt}`,
            complete: [...pa.bySlot, ...pb.bySlot].every(p => ['DONE', 'EMPTY'].includes(p.phase)),
        }, true) || changed;
    }
    if (changed) persistHistory();
}

/** Split missing observation windows instead of implying continuous coverage. */
export function probabilitySegments(points) {
    const segments = [];
    for (const point of points) {
        const segment = segments.at(-1);
        if (!segment || point.at - segment.at(-1).at > HISTORY_GAP_MS) segments.push([point]);
        else segment.push(point);
    }
    return segments;
}

export const emptyProbabilityHistory = () => EMPTY;
