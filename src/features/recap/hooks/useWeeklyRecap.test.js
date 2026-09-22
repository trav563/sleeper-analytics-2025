import { WEEKLY_COPY, fillTemplate } from '../data/roastCopy';
import { describe, it, expect } from 'vitest';
import { completedMatchups } from '../../../utils/seasonState';
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
    it('describes the reported 10.82-point margin without imaginary decisive plays', () => {
        const rows = week([[1,97.36,{p1:20}],[2,86.54,{p3:18}]]);
        const result = computeWeeklyRecap(league, rows, rosters, users, players, 1, {1:rows});
        expect(result.closeCall.margin).toBe('10.82');
        for (const copy of WEEKLY_COPY.closeCall) {
            const text = fillTemplate(copy.text, result.closeCall);
            expect(text).toContain('10.82');
            expect(text).not.toMatch(/knee|spike|catch|stat correction/i);
        }
        expect(computeWeeklyRecap(league, [...rows].reverse(), rosters, users, players, 1, {1:rows}).closeCall).toEqual(result.closeCall);
    });
    it('does not turn unknown scores or empty slots into ghosts', () => {
        const rows = week([[1,10,{}],[2,20,{p3:20}]]);
        rows[0].starters.push('0');
        const result = computeWeeklyRecap(league, rows, rosters, users, players, 1, {1:rows});
        expect(result.ghost).toBeNull(); expect(result.cardioKing).toBeNull();
    });
    it('requires the correct sign for performance awards', () => {
        const prior = week([[1,20,{p1:20}],[2,30,{p3:30}]]);
        const lower = week([[1,10,{p1:10}],[2,15,{p3:15}]]);
        expect(computeWeeklyRecap(league, lower, rosters, users, players, 2, {1:prior,2:lower}).overachiever).toBeNull();
        expect(computeWeeklyRecap(league, prior, rosters, users, players, 2, {1:lower,2:prior}).underachiever).toBeNull();
    });
    it('uses exact flex assignment and preserves commissioner adjustments', () => {
        const ps = {a:{position:'RB',first_name:'A'},b:{position:'WR',first_name:'B'},c:{position:'RB',first_name:'C'}};
        const rows = [{roster_id:1,matchup_id:1,points:18,starters:['b','c'],players:['a','b','c'],players_points:{a:20,b:10,c:5},starters_points:[10,5]}];
        const result = computeWeeklyRecap({...league,roster_positions:['FLEX','RB']}, rows, rosters, users, ps, 1, {1:rows});
        expect(result.worstManager).toMatchObject({actual:'18.00',optimal:'33.00',diff:'15.00'});
    });
    it('does not infer historical rookie status from current experience', () => {
        const rows = week([[1,20,{p1:20,p2:30}],[2,12,{p3:12}]]);
        expect(computeWeeklyRecap({...league,season:'2020'}, rows, rosters, users, players, 1, {1:rows}).topRookie).toBeNull();
        expect(computeWeeklyRecap({...league,season:'2020'}, rows, rosters, users, {...players,p2:{...players.p2,rookie_year:2020}}, 1, {1:rows}).topRookie.points).toBe('30.00');
    });
    it('awards nothing when no games have been played (all-zero preseason week)', () => {
        // Preseason returns real roster entries with every score at 0. Before
        // the fix, the maximum-finders seeded at -1 so 0 > -1 crowned a
        // "Manager Malpractice" and a "Player of the Week" worth 0.00 points.
        const matchups = week([
            [1, 0, { p1: 0, p2: 0 }],
            [2, 0, { p3: 0, p4: 0 }],
        ]);
        const final = completedMatchups({ 1: matchups }, 0);
        expect(computeWeeklyRecap(league, final[1], rosters, users, players, 1, final)).toBeNull();
        const completedZero = computeWeeklyRecap(league, matchups, rosters, users, players, 1, { 1: matchups });
        expect(completedZero.tankCommander.score).toBe('0.00');
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
