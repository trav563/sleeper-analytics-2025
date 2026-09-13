import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { HISTORY_STORAGE_KEY, MAX_HISTORY_POINTS, probabilityHistoryKey, appendProbabilitySnapshot,
    readProbabilityHistory, subscribeProbabilityHistory, recordLeagueProbabilitySnapshots, probabilitySegments } from './winProbabilityHistory';

const context = { leagueId: 'league', season: '2026', week: 1, matchupId: 1, rosterIds: [1, 2] };
const key = probabilityHistoryKey(context);
const now = Date.now();
function reload() {
    const unsubscribe = subscribeProbabilityHistory(() => {});
    window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_STORAGE_KEY }));
    unsubscribe();
}
beforeEach(() => { localStorage.clear(); reload(); });
afterEach(() => vi.restoreAllMocks());

describe('probability history persistence and isolation', () => {
    it('persists observations across reloads and uses a canonical roster order', () => {
        appendProbabilitySnapshot(key, { at: now, p: .8, source: 'a' });
        appendProbabilitySnapshot(key, { at: now + 60_000, p: .85, source: 'b' });
        reload();
        expect(readProbabilityHistory(probabilityHistoryKey({ ...context, rosterIds: [2, 1] }))).toHaveLength(2);
        for (const change of [{ leagueId: 'other' }, { season: '2025' }, { week: 2 }, { matchupId: 2 }, { rosterIds: [1, 3] }]) {
            expect(readProbabilityHistory(probabilityHistoryKey({ ...context, ...change }))).toHaveLength(0);
        }
    });
    it('deduplicates data and merges the two feed completions from a poll', () => {
        appendProbabilitySnapshot(key, { at: now, p: .8, source: 'a' });
        appendProbabilitySnapshot(key, { at: now + 5000, p: .81, source: 'b' });
        appendProbabilitySnapshot(key, { at: now + 60_000, p: .81, source: 'b' });
        expect(readProbabilityHistory(key)).toEqual([{ at: now + 5000, p: .81 }]);
        appendProbabilitySnapshot(key, { at: now + 65_000, p: .81, source: 'c' });
        expect(readProbabilityHistory(key)).toHaveLength(2); // Equal probabilities still form a legitimate flat line.
    });
    it('preserves gaps and ignores out-of-order observations', () => {
        appendProbabilitySnapshot(key, { at: now, p: .8, source: 'a' });
        appendProbabilitySnapshot(key, { at: now - 60_000, p: .1, source: 'old' });
        appendProbabilitySnapshot(key, { at: now + 300_000, p: .9, source: 'b' });
        expect(probabilitySegments(readProbabilityHistory(key))).toHaveLength(2);
    });
    it('stops repeating a settled result but retains score corrections', () => {
        appendProbabilitySnapshot(key, { at: now, p: 1, source: 'a', complete: true });
        appendProbabilitySnapshot(key, { at: now + 60_000, p: 1, source: 'b', complete: true });
        expect(readProbabilityHistory(key)).toHaveLength(1);
        appendProbabilitySnapshot(key, { at: now + 120_000, p: .5, source: 'c', complete: true });
        expect(readProbabilityHistory(key)).toHaveLength(2);
    });
    it('recovers from malformed storage and continues in memory if writes are blocked', () => {
        localStorage.setItem(HISTORY_STORAGE_KEY, 'invalid'); reload();
        expect(readProbabilityHistory(key)).toEqual([]);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
        appendProbabilitySnapshot(key, { at: now, p: .7, source: 'a' });
        expect(readProbabilityHistory(key)).toEqual([{ at: now, p: .7 }]);
    });
    it('bounds stored points and removes expired histories', () => {
        const points = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => ({ at: now - (MAX_HISTORY_POINTS - i) * 60_000, p: .5 }));
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ [key]: { points, updatedAt: now }, old: { points, updatedAt: now - 46 * 86400_000 } }));
        reload();
        appendProbabilitySnapshot(key, { at: now, p: .6, source: 'new' });
        expect(readProbabilityHistory(key)).toHaveLength(MAX_HISTORY_POINTS);
        expect(readProbabilityHistory('old')).toHaveLength(0);
    });
    it('caps the number of stored matchup histories', () => {
        for (let i = 0; i < 40; i++) appendProbabilitySnapshot(`${key}:${i}`, { at: now + i, p: .5, source: String(i) });
        expect(Object.keys(JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY)))).toHaveLength(32);
    });
});

describe('league-wide recording', () => {
    const args = () => ({ league: { league_id: 'league', season: '2026' }, week: 1,
        matchups: [{ roster_id: 2, matchup_id: 1, points: 5, starters: ['b'], starters_points: [5] },
            { roster_id: 1, matchup_id: 1, points: 10, starters: ['a'], starters_points: [10] }],
        players: { a: { team: 'A', position: 'QB' }, b: { team: 'B', position: 'QB' } }, projections: { a: 20, b: 20 },
        games: { A: { statusName: 'STATUS_HALFTIME' }, B: { statusName: 'STATUS_HALFTIME' } },
        scoresUpdatedAt: now, gamesUpdatedAt: now, enabled: true, now });
    it('records valid pairs in a consistent orientation on each fresh poll', () => {
        recordLeagueProbabilitySnapshots(args());
        expect(readProbabilityHistory(key)[0].p).toBeGreaterThan(.5);
        recordLeagueProbabilitySnapshots({ ...args(), now: now + 60_000, scoresUpdatedAt: now + 60_000, gamesUpdatedAt: now + 60_000 });
        expect(readProbabilityHistory(key)).toHaveLength(2);
    });
    it('does not record historical, hidden, failed, stale or incomplete data', () => {
        for (const change of [{ enabled: false }, { scoresUpdatedAt: 0 }, { gamesUpdatedAt: now - 180_000 }, { projections: {} }, { games: {} }, { matchups: args().matchups.slice(0, 1) }]) {
            recordLeagueProbabilitySnapshots({ ...args(), ...change });
        }
        expect(readProbabilityHistory(key)).toHaveLength(0);
    });
    it('batches an entire league into one storage write and makes no provider requests', () => {
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const fetchSpy = vi.spyOn(globalThis, 'fetch');
        const matchups = Array.from({ length: 20 }, (_, i) => args().matchups.map(m => ({ ...m, roster_id: m.roster_id + i * 2, matchup_id: i + 1 }))).flat();
        recordLeagueProbabilitySnapshots({ ...args(), matchups });
        expect(write).toHaveBeenCalledTimes(1);
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
