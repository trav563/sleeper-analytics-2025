import { describe, expect, it } from 'vitest';
import { computeWinProbability, formatWinProbabilityPercent } from './winProbability';

// Current score, opponent score, projected finals, then Sleeper's displayed %.
const latest = [
    ['Gerry', 83.52, 72.12, 134.53, 106.94, 82],
    ['Second Sanborn', 51.80, 55.52, 111.50, 96.75, 68],
    ['Prescott', 30.20, 43.60, 103.14, 97.24, 57],
    ['Epstein', 62.30, 64.90, 81.46, 94.36, 23],
    ['Saco', 67.30, 63.40, 91.21, 106.75, 24],
    ['Big Socks', 44.50, 49.50, 106.66, 91.45, 70],
];
const earlier = [
    ['Gerry', 67.46, 72.62, 131.64, 116.84, 67],
    ['Prescott', 25.70, 31.90, 103.62, 90.74, 65],
    ['Epstein', 54.30, 65.98, 82.03, 103.35, 16],
    ['Second Sanborn', 35.50, 50.92, 101.14, 96.18, 56],
    ['Saco', 56.90, 60.90, 93.79, 114.77, 23],
];
const inputs = ([, myCurrent, oppCurrent, myFinal, oppFinal]) => ({
    myCurrent, oppCurrent, myProjRemaining: myFinal - myCurrent, oppProjRemaining: oppFinal - oppCurrent,
});

describe('estimated win probability calibration', () => {
    it.each(latest)('stays within three percentage points of the latest %s example', (...row) => {
        expect(Math.abs(computeWinProbability(inputs(row)) * 100 - row[5])).toBeLessThan(3);
    });
    it('retains agreement with the earlier screenshots', () => {
        const errors = earlier.map(row => Math.abs(computeWinProbability(inputs(row)) * 100 - row[5]));
        expect(Math.max(...errors)).toBeLessThan(3.5);
        expect(errors.reduce((sum, error) => sum + error, 0) / errors.length).toBeLessThan(1.3);
    });
    it('reduces the prior overconfidence for Gerry', () => {
        expect(formatWinProbabilityPercent(computeWinProbability(inputs(latest[0])))).toBe('84%');
        expect(computeWinProbability({ ...inputs(latest[0]), varianceFactor: .18 })).toBeGreaterThan(.99);
    });
    it('is symmetric when swapping teams and neutral for equal projected scores', () => {
        const args = inputs(latest[0]);
        const opposite = { myCurrent: args.oppCurrent, oppCurrent: args.myCurrent,
            myProjRemaining: args.oppProjRemaining, oppProjRemaining: args.myProjRemaining };
        expect(computeWinProbability(args) + computeWinProbability(opposite)).toBeCloseTo(1, 8);
        expect(computeWinProbability({ myCurrent: 20, oppCurrent: 30, myProjRemaining: 20, oppProjRemaining: 10 })).toBeCloseTo(.5, 8);
    });
    it('settles completed matchups on the actual result, including ties and negative scores', () => {
        expect(computeWinProbability({ myCurrent: 100, oppCurrent: 99 })).toBe(1);
        expect(computeWinProbability({ myCurrent: -2, oppCurrent: 0 })).toBe(0);
        expect(computeWinProbability({ myCurrent: 100, oppCurrent: 100 })).toBe(.5);
    });
});
