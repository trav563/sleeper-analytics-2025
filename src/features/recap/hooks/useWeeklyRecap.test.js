import { describe, it, expect } from 'vitest';
import { computeWeeklyRecap } from './useWeeklyRecap';

const league = { league_id: '1', season: '2026', roster_positions: ['QB', 'RB', 'WR', 'TE', 'BN'] };
const rosters = [
    { roster_id: 1, owner_id: 'u1', players: ['p1', 'p2'], starters: ['p1'] },
    { roster_id: 2, owner_id: 'u2', players: ['p3', 'p4'], starters: ['p3'] },
];
const users = [
    { user_id: 'u1', display_name: 'Alice' },
    { user_id: 'u2', display_name: 'Bob' },
];
const players = {
    p1: { first_name: 'A', last_name: 'One', position: 'QB', years_exp: 3 },
    p2: { first_name: 'A', last_name: 'Two', position: 'RB', years_exp: 0 },
    p3: { first_name: 'B', last_name: 'Three', position: 'QB', years_exp: 4 },
    p4: { first_name: 'B', last_name: 'Four', position: 'RB', years_exp: 1 },
};

const week = (scores) =>
    scores.map(([roster_id, points, playerPoints]) => ({
        roster_id,
        matchup_id: 1,
        points,
        starters: roster_id === 1 ? ['p1'] : ['p3'],
        players: roster_id === 1 ? ['p1', 'p2'] : ['p3', 'p4'],
        players_points: playerPoints,
        starters_points: [playerPoints[roster_id === 1 ? 'p1' : 'p3']],
    }));

describe('computeWeeklyRecap', () => {
    it('awards nothing when no games have been played (all-zero preseason week)', () => {
        // Preseason returns real roster entries with every score at 0. Before
        // the fix, the maximum-finders seeded at -1 so 0 > -1 crowned a
        // "Manager Malpractice" and a "Player of the Week" worth 0.00 points.
        const matchups = week([
            [1, 0, { p1: 0, p2: 0 }],
            [2, 0, { p3: 0, p4: 0 }],
        ]);
        const result = computeWeeklyRecap(league, matchups, rosters, users, players, 2, { 1: matchups });

        expect(result.worstManager).toBeNull();
        expect(result.boomGame).toBeNull();
        expect(result.topRookie).toBeNull();
        expect(result.robbery).toBeNull();
        expect(result.tankCommander).toBeNull();
    });

    it('still awards normally once real scores exist', () => {
        const matchups = week([
            [1, 20, { p1: 20, p2: 15 }],
            [2, 12, { p3: 12, p4: 1 }],
        ]);
        const result = computeWeeklyRecap(league, matchups, rosters, users, players, 2, { 1: matchups });

        // The seed change must not suppress genuine awards.
        expect(result.boomGame).not.toBeNull();
        expect(result.boomGame.points).toBe('20.00');
        expect(result.robbery).not.toBeNull(); // team 2 lost with 12
    });

    it('returns null without matchups', () => {
        expect(computeWeeklyRecap(league, [], rosters, users, players, 2, {})).toBeNull();
        expect(computeWeeklyRecap(league, null, rosters, users, players, 2, {})).toBeNull();
    });
});
