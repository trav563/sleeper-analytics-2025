import { describe, expect, it } from 'vitest';
import { sampleLeagueProbabilities } from './winProbabilitySampler';

const args = () => ({
    matchups: [{ roster_id: 2, matchup_id: 1, points: 5, starters: ['b'], starters_points: [5] },
        { roster_id: 1, matchup_id: 1, points: 10, starters: ['a'], starters_points: [10] }],
    players: { a: { team: 'AAA', position: 'QB' }, b: { team: 'BBB', position: 'QB' } },
    rawProjections: { a: { pass_yd: 500 }, b: { pass_yd: 500 } },
    scoringSettings: { pass_yd: .04 },
    games: { AAA: { statusName: 'STATUS_HALFTIME' }, BBB: { statusName: 'STATUS_HALFTIME' } },
});

describe('sampleLeagueProbabilities', () => {
    it('orients each probability to the lower roster id, whatever the input order', () => {
        const forward = sampleLeagueProbabilities(args());
        const reversed = sampleLeagueProbabilities({ ...args(), matchups: [...args().matchups].reverse() });
        expect(forward[1]).toBeGreaterThan(.5); // Roster 1 leads 10-5.
        expect(reversed).toEqual(forward);
    });
    it("scores projections with the league's own settings", () => {
        const low = sampleLeagueProbabilities({ ...args(), rawProjections: { a: { pass_yd: 500 }, b: { pass_yd: 900 } } });
        const high = sampleLeagueProbabilities({ ...args(), rawProjections: { a: { pass_yd: 900 }, b: { pass_yd: 500 } } });
        expect(low[1]).toBeLessThan(high[1]);
    });
    it('returns certainty once every game is final', () => {
        const games = { AAA: { statusName: 'STATUS_FINAL' }, BBB: { statusName: 'STATUS_FINAL' } };
        expect(sampleLeagueProbabilities({ ...args(), games })[1]).toBe(1);
    });
    it('leaves out a matchup it cannot project rather than guessing', () => {
        for (const change of [{ rawProjections: {} }, { games: {} }, { matchups: args().matchups.slice(0, 1) }]) {
            expect(sampleLeagueProbabilities({ ...args(), ...change })).toEqual({});
        }
    });
    it('samples each matchup in a league independently', () => {
        const second = args().matchups.map(m => ({ ...m, matchup_id: 2, roster_id: m.roster_id + 2, points: m.points === 10 ? 1 : 30, starters_points: [m.points === 10 ? 1 : 30] }));
        const sample = sampleLeagueProbabilities({ ...args(), matchups: [...args().matchups, ...second] });
        expect(sample[1]).toBeGreaterThan(.5);
        expect(sample[2]).toBeLessThan(.5);
    });
});
