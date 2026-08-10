import { describe, it, expect } from 'vitest';
import { simulateInSeasonOdds, firstWeekToSimulate } from './usePlayoffOdds';
import { computeWinProbability } from '../../../lib/winProbability';

const team = (rosterId, ppg, { wins = 0, fpts = 0, gamesPlayed = 0 } = {}) => ({
    rosterId,
    currentWins: wins,
    currentTies: 0,
    currentFpts: fpts,
    gamesPlayed,
    ppg,
});

describe('simulateInSeasonOdds', () => {
    it('is deterministic for the same seed', () => {
        const args = {
            teams: [team(1, 120), team(2, 110)],
            processedSchedule: [[[1, 2]]],
            playoffSpots: 1,
            seedString: 'seed-a',
            simulations: 2000,
        };
        expect(simulateInSeasonOdds(args)).toEqual(simulateInSeasonOdds(args));
    });

    it('gives a 125-PPG team realistic (not ppg-ratio) odds vs a 105-PPG team', () => {
        // One remaining head-to-head game decides the single playoff spot.
        const results = simulateInSeasonOdds({
            teams: [team(1, 125), team(2, 105)],
            processedSchedule: [[[1, 2]]],
            playoffSpots: 1,
            seedString: 'seed-b',
            simulations: 20000,
        });
        const p1 = results[1] / 20000;
        // Model expectation from the shared normal-CDF model (~75%), far from
        // the old ppg-ratio 125/230 ≈ 54%.
        const expected = computeWinProbability({ myProjRemaining: 125, oppProjRemaining: 105 });
        expect(p1).toBeGreaterThan(0.65);
        expect(Math.abs(p1 - expected)).toBeLessThan(0.02);
    });

    it('varies the points-for tiebreaker across simulations', () => {
        // Teams 1 and 2 each beat a pushover, so both finish with equal wins and
        // the single spot comes down to the PF tiebreak (600 vs 599 entering the
        // week). With sampled scores the trailing team must win it sometimes.
        const results = simulateInSeasonOdds({
            teams: [
                team(1, 120, { wins: 5, fpts: 600 }),
                team(2, 120, { wins: 5, fpts: 599 }),
                team(3, 10, { wins: 0, fpts: 100 }),
                team(4, 10, { wins: 0, fpts: 100 }),
            ],
            processedSchedule: [[[1, 3], [2, 4]]],
            playoffSpots: 1,
            seedString: 'seed-c',
            simulations: 2000,
        });
        expect(results[1]).toBeGreaterThan(0);
        expect(results[2]).toBeGreaterThan(0);
    });

    it('coin-flips when both teams have zero ppg (week 1)', () => {
        const results = simulateInSeasonOdds({
            teams: [team(1, 0), team(2, 0)],
            processedSchedule: [[[1, 2]]],
            playoffSpots: 1,
            seedString: 'seed-d',
            simulations: 10000,
        });
        const p1 = results[1] / 10000;
        expect(p1).toBeGreaterThan(0.45);
        expect(p1).toBeLessThan(0.55);
    });
});

describe('firstWeekToSimulate', () => {
    it('simulates the current week while it is still live', () => {
        const teams = [team(1, 100, { gamesPlayed: 5 }), team(2, 100, { gamesPlayed: 5 })];
        expect(firstWeekToSimulate(teams, 6)).toBe(6);
    });

    it('skips the current week once records already include it', () => {
        const teams = [team(1, 100, { gamesPlayed: 6 }), team(2, 100, { gamesPlayed: 6 })];
        expect(firstWeekToSimulate(teams, 6)).toBe(7);
    });
});
