import { describe, it, expect } from 'vitest';
import { buildRecordBook } from './leagueRecordBook';

const SLOTS = ['QB', 'RB', 'BN'];
const full = ['qb1', 'rb1'];

/** One side of a head-to-head, with a complete lineup unless told otherwise. */
const side = (rosterId, points, matchupId, starters = full) => ({
    roster_id: rosterId,
    matchup_id: matchupId,
    points,
    starters,
    starters_points: starters.map(() => points / starters.length),
});

/** A week of 1-v-1 games: [[rosterA, ptsA, rosterB, ptsB], ...]. */
const week = (...games) =>
    games.flatMap(([a, pa, b, pb], i) => [side(a, pa, i + 1), side(b, pb, i + 1)]);

const season = (year, weeks) => ({
    season: year,
    slots: SLOTS,
    weeks,
    resolveTeam: rosterId => ({ key: `owner-${rosterId}`, name: `Team ${rosterId}`, avatar: null }),
});

describe('buildRecordBook', () => {
    it('ranks the highest scores deepest-first and caps the list', () => {
        const book = buildRecordBook([
            season('2025', [week([1, 100, 2, 50]), week([1, 120, 2, 60])]),
            season('2026', [week([1, 80, 2, 140])]),
        ]);
        expect(book.highestScore.map(r => r.value)).toEqual(['140.00', '120.00', '100.00', '80.00', '60.00']);
        expect(book.highestScore[0]).toMatchObject({ teamName: 'Team 2', year: '2026', week: 1, detail: 'Points' });
    });

    it('honours the depth argument', () => {
        const book = buildRecordBook([season('2025', [week([1, 100, 2, 50]), week([1, 120, 2, 60])])], 2);
        expect(book.highestScore).toHaveLength(2);
        expect(book.lowestScore).toHaveLength(2);
    });

    it('keeps abandoned lineups out of the low-score list only', () => {
        const abandoned = side(2, 3, 1, ['0', 'rb1']);
        const weeks = [[side(1, 100, 1), abandoned]];
        const book = buildRecordBook([season('2025', weeks)]);
        expect(book.lowestScore.map(r => r.value)).toEqual(['100.00']);
        // The forfeit still counts as a score for other records.
        expect(book.highestScore.map(r => r.value)).toEqual(['100.00', '3.00']);
    });

    it('ranks every win streak, not just the longest', () => {
        // Team 1 wins 3, loses, wins 2. Team 2 mirrors it.
        const book = buildRecordBook([season('2025', [
            week([1, 100, 2, 50]),
            week([1, 100, 2, 50]),
            week([1, 100, 2, 50]),
            week([1, 40, 2, 90]),
            week([1, 100, 2, 50]),
            week([1, 100, 2, 50]),
        ])]);
        expect(book.longestStreak.map(r => [r.teamName, r.value])).toEqual([
            ['Team 1', 3], ['Team 1', 2], ['Team 2', 1],
        ]);
        // The 3-game run is stamped with the week it reached 3, not where it ended.
        expect(book.longestStreak[0]).toMatchObject({ year: '2025', week: 3, detail: 'Consecutive Wins' });
    });

    it('counts a streak still alive at the end of history', () => {
        const book = buildRecordBook([season('2026', [week([1, 100, 2, 50]), week([1, 100, 2, 50])])]);
        expect(book.longestStreak[0]).toMatchObject({ teamName: 'Team 1', value: 2 });
    });

    it('breaks both streaks on a tie', () => {
        const book = buildRecordBook([season('2025', [
            week([1, 100, 2, 50]),
            week([1, 70, 2, 70]),
            week([1, 100, 2, 50]),
        ])]);
        expect(book.longestStreak.map(r => r.value)).toEqual([1, 1]);
    });

    it('ranks the closest matchups and shows both scores', () => {
        const book = buildRecordBook([season('2025', [
            week([1, 100, 2, 99.9], [3, 80, 4, 60]),
        ])]);
        expect(book.closestMatch[0]).toMatchObject({
            value: '0.10',
            detail: 'Diff (100.00 - 99.90)',
            sub: '100.00 - 99.90',
        });
        expect(book.closestMatch[1].value).toBe('20.00');
    });

    it('carries the scores only on the matchup record', () => {
        const book = buildRecordBook([season('2025', [week([1, 100, 2, 50])])]);
        expect(book.closestMatch[0].sub).toBe('100.00 - 50.00');
        expect(book.highestScore[0].sub).toBeUndefined();
        expect(book.longestStreak[0].sub).toBeUndefined();
    });

    it('skips byes and weeks with a missing score', () => {
        const bye = [side(1, 100, null)];
        const unscored = [side(1, null, 1), side(2, 50, 1)];
        const book = buildRecordBook([season('2025', [bye, unscored])]);
        expect(book.highestScore).toEqual([]);
        expect(book.closestMatch).toEqual([]);
    });

    it('returns empty lists with no history', () => {
        expect(buildRecordBook([])).toEqual({
            highestScore: [], lowestScore: [], closestMatch: [], longestStreak: [],
        });
    });
});
