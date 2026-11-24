import { describe, it, expect } from 'vitest';
import { isPerfectWeek, actualScore, optimalLineup, weekWasPlayed, analyzeTeamWeek, summarizePerfectWeeks } from './perfectWeeks';

const SLOTS = ['QB', 'RB', 'RB', 'WR', 'FLEX', 'BN', 'BN'];

const PLAYERS = {
    qb1: { position: 'QB', fantasy_positions: ['QB'] },
    qb2: { position: 'QB', fantasy_positions: ['QB'] },
    rb1: { position: 'RB', fantasy_positions: ['RB'] },
    rb2: { position: 'RB', fantasy_positions: ['RB'] },
    rb3: { position: 'RB', fantasy_positions: ['RB'] },
    wr1: { position: 'WR', fantasy_positions: ['WR'] },
    wr2: { position: 'WR', fantasy_positions: ['WR'] },
    hybrid: { position: 'DB', fantasy_positions: ['DB', 'WR'] },
};

/** Builds a matchup whose starters_points mirror the chosen starters. */
const matchup = (starters, pointsByPlayer, extra = {}) => ({
    roster_id: 1,
    starters,
    starters_points: starters.map(id => pointsByPlayer[id]),
    players: Object.keys(pointsByPlayer),
    players_points: pointsByPlayer,
    points: starters.reduce((sum, id) => sum + pointsByPlayer[id], 0),
    ...extra,
});

describe('perfect weeks', () => {
    it('counts a lineup that already extracted every available point', () => {
        const points = { qb1: 20, qb2: 30, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
        // qb2 is the better QB but only one QB slot exists; the flex takes the
        // best leftover RB/WR. Nothing on the bench improves this.
        const best = matchup(['qb2', 'rb1', 'rb2', 'wr1', 'wr2'], points);
        expect(isPerfectWeek(best, SLOTS, PLAYERS)).toBe(true);
    });

    it('rejects a lineup that left a better player on the bench', () => {
        const points = { qb1: 20, qb2: 30, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
        const sat = matchup(['qb1', 'rb1', 'rb2', 'wr1', 'wr2'], points); // started the worse QB
        expect(isPerfectWeek(sat, SLOTS, PLAYERS)).toBe(false);
        expect(optimalLineup(sat, SLOTS, PLAYERS).total - actualScore(sat)).toBe(10);
    });

    it('rejects a miss smaller than a point but larger than cent rounding', () => {
        const points = { qb1: 20, qb2: 20.1, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
        expect(isPerfectWeek(matchup(['qb1', 'rb1', 'rb2', 'wr1', 'wr2'], points), SLOTS, PLAYERS)).toBe(false);
        expect(isPerfectWeek(matchup(['qb2', 'rb1', 'rb2', 'wr1', 'wr2'], points), SLOTS, PLAYERS)).toBe(true);
    });

    it('allows a multi-position player into any slot he qualifies for', () => {
        const points = { qb1: 20, rb1: 10, rb2: 9, rb3: 1, wr1: 8, hybrid: 25 };
        // hybrid is listed DB first but is WR-eligible, so the best lineup uses him.
        const withHybrid = matchup(['qb1', 'rb1', 'rb2', 'hybrid', 'wr1'], points);
        expect(isPerfectWeek(withHybrid, SLOTS, PLAYERS)).toBe(true);
        expect(isPerfectWeek(matchup(['qb1', 'rb1', 'rb2', 'wr1', 'rb3'], points), SLOTS, PLAYERS)).toBe(false);
    });

    it('does not credit a week the roster could not even field', () => {
        const points = { qb1: 0, rb1: 0 }; // no WR, no second RB
        expect(isPerfectWeek(matchup(['qb1', 'rb1'], points), SLOTS, PLAYERS)).toBe(false);
    });

    it('ignores a team-week with an unscored starter', () => {
        const points = { qb1: 20, rb1: 10, rb2: 9, wr1: 8, wr2: 2 };
        const partial = { ...matchup(['qb1', 'rb1', 'rb2', 'wr1', 'wr2'], points), starters_points: [20, 10, null, 8, 2] };
        expect(actualScore(partial)).toBeNull();
        expect(isPerfectWeek(partial, SLOTS, PLAYERS)).toBe(false);
    });

    it('treats an all-zero week as unplayed rather than perfect', () => {
        const zeroes = [{ points: 0 }, { points: 0 }];
        expect(weekWasPlayed(zeroes)).toBe(false);
        expect(weekWasPlayed([{ points: 0 }, { points: 94.2 }])).toBe(true);
        expect(weekWasPlayed(undefined)).toBe(false);
    });

    it('names the single change a missed week needed, and the best bench score', () => {
        const points = { qb1: 20, qb2: 30, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
        const judged = analyzeTeamWeek(matchup(['qb1', 'rb1', 'rb2', 'wr1', 'wr2'], points), SLOTS, PLAYERS);
        expect(judged.gap).toBe(10);
        expect(judged.swapIn).toMatchObject({ name: 'qb2', points: 30 });
        expect(judged.swapOut).toMatchObject({ name: 'qb1', points: 20 });
        expect(judged.benchBest).toMatchObject({ name: 'qb2', points: 30 });
    });

    it('reports no change needed on a perfect week', () => {
        const points = { qb1: 20, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
        const judged = analyzeTeamWeek(matchup(['qb1', 'rb1', 'rb2', 'wr1', 'wr2'], points), SLOTS, PLAYERS);
        expect(judged.perfect).toBe(true);
        expect(judged.swapIn).toBeUndefined();
        expect(judged.benchBest).toMatchObject({ name: 'rb3', points: 1 });
    });
});

describe('perfect week summary', () => {
    const miss = { qb1: 20, qb2: 30, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
    const hit = { qb1: 20, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
    const narrow = { qb1: 20, qb2: 20.4, rb1: 10, rb2: 9, rb3: 1, wr1: 8, wr2: 2 };
    const lineup = ['qb1', 'rb1', 'rb2', 'wr1', 'wr2'];

    const season = (year, weeks, playoffWeekStart = 3) => ({
        season: year,
        slots: SLOTS,
        playoffWeekStart,
        weeks,
        resolveTeam: rosterId => ({ key: `owner-${rosterId}`, name: `Team ${rosterId}`, avatar: null }),
    });

    const week = (...pointMaps) => pointMaps.map((points, i) => ({ ...matchup(lineup, points), roster_id: i + 1 }));

    it('tallies totals, rate, per-season rows and the manager ranking', () => {
        const summary = summarizePerfectWeeks([
            season('2025', [week(hit, miss), week(miss, miss)]),
            season('2026', [week(hit, hit)]),
        ], PLAYERS);

        expect(summary.total).toBe(3);
        expect(summary.teamWeeks).toBe(6);
        expect(summary.rate).toBeCloseTo(0.5);
        expect(summary.oneIn).toBe(2);
        expect(summary.bySeason).toEqual([
            { season: '2025', perfect: 1, teamWeeks: 4, weeks: 2 },
            { season: '2026', perfect: 2, teamWeeks: 2, weeks: 1 },
        ]);
        // roster 1 was perfect in both seasons, roster 2 only in 2026.
        expect(summary.byManager.map(m => [m.key, m.count])).toEqual([['owner-1', 2], ['owner-2', 1]]);
    });

    it('splits regular season from postseason on each season own playoff start', () => {
        const summary = summarizePerfectWeeks([
            season('2026', [week(hit, miss), week(miss, miss), week(hit, miss)], 3),
        ], PLAYERS);
        expect(summary.regularSeason).toBe(1); // week 1
        expect(summary.postseason).toBe(1);    // week 3, at the playoff start
    });

    it('keeps near misses, ranks them tightest first, and excludes perfect weeks', () => {
        const summary = summarizePerfectWeeks([season('2026', [week(narrow, miss, hit)])], PLAYERS);
        expect(summary.nearMisses).toHaveLength(1);
        expect(summary.nearMisses[0].week).toBe(1);
        expect(summary.nearMisses[0].gap).toBeCloseTo(0.4);
        expect(summary.nearMisses[0].swapIn).toMatchObject({ name: 'qb2' });
    });

    it('skips unplayed weeks and seasons with no lineup shape', () => {
        const unplayed = [{ ...matchup(lineup, hit), roster_id: 1, points: 0, starters_points: [0, 0, 0, 0, 0] }];
        const summary = summarizePerfectWeeks([
            season('2026', [week(hit), unplayed]),
            { season: '2025', slots: [], weeks: [week(hit)], resolveTeam: () => ({ key: 'x', name: 'x' }) },
        ], PLAYERS);
        expect(summary.teamWeeks).toBe(1);
        expect(summary.bySeason.map(s => s.season)).toEqual(['2026']);
    });

    it('returns an empty but well-formed summary with no history', () => {
        const summary = summarizePerfectWeeks([], PLAYERS);
        expect(summary).toMatchObject({ total: 0, teamWeeks: 0, rate: 0, oneIn: null });
        expect(summary.byManager).toEqual([]);
    });
});
