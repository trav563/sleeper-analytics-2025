import { describe, expect, it } from 'vitest';
import { clearLegacyProbabilityHistory, layoutProbabilityWindows, matchupProbabilityPoints, probabilitySegments } from './winProbabilityHistory';

const MIN = 60_000;
const series = minutes => minutes.map(m => ({ at: m * MIN, p: .5 }));

describe('matchupProbabilityPoints', () => {
    it('picks one matchup from league-wide samples and skips samples without it', () => {
        const samples = [{ at: 1, p: { 1: .6, 2: .3 } }, { at: 2, p: { 2: .4 } }, { at: 3, p: { 1: .7 } }];
        expect(matchupProbabilityPoints(samples, 1)).toEqual([{ at: 1, p: .6 }, { at: 3, p: .7 }]);
    });
    it('rejects malformed values and tolerates missing data', () => {
        expect(matchupProbabilityPoints([{ at: 1, p: { 1: 2 } }, { at: 2, p: { 1: 'x' } }, { at: 3 }], 1)).toEqual([]);
        expect(matchupProbabilityPoints(undefined, 1)).toEqual([]);
    });
});

describe('probabilitySegments', () => {
    it('keeps normal 5-minute sampling continuous', () => {
        expect(probabilitySegments(series([0, 5, 10, 15]))).toHaveLength(1);
    });
    it('splits on a stretch of missed samples', () => {
        expect(probabilitySegments(series([0, 5, 25, 30]))).toHaveLength(2);
    });
});

describe('layoutProbabilityWindows', () => {
    it('starts a new window after an hour with no samples', () => {
        expect(layoutProbabilityWindows(series([0, 5, 30, 35]))).toHaveLength(1);
        expect(layoutProbabilityWindows(series([0, 5, 70, 75]))).toHaveLength(2);
    });
    it('collapses idle time so width follows game time rather than the calendar', () => {
        // Thursday 3h, then three idle days, then Sunday 9h, sampled every 30 minutes.
        const sunday = 3 * 24 * 60;
        const every30 = (from, hours) => Array.from({ length: hours * 2 + 1 }, (_, i) => from + i * 30);
        const [thu, sun] = layoutProbabilityWindows(series([...every30(0, 3), ...every30(sunday, 9)]));
        expect((sun.x1 - sun.x0) / (thu.x1 - thu.x0)).toBeCloseTo(3);
        expect(sun.x0 - thu.x1).toBe(10);
    });
    it('fills the plot and keeps points in order', () => {
        const windows = layoutProbabilityWindows(series([0, 120, 300, 420]));
        expect(windows[0].x0).toBe(12);
        expect(windows.at(-1).x1).toBeCloseTo(308);
        const xs = windows.flatMap(w => w.points.map(p => p.x));
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });
    it('centres a lone sample', () => {
        expect(layoutProbabilityWindows(series([0]))[0].points[0].x).toBe(160);
    });
    it('returns no windows for no points', () => {
        expect(layoutProbabilityWindows([])).toEqual([]);
    });
});

describe('clearLegacyProbabilityHistory', () => {
    it('removes only the old browser-recorded history', () => {
        localStorage.setItem('league-win-history-v1-uncertainty45', '{}');
        localStorage.setItem('other', '1');
        clearLegacyProbabilityHistory();
        expect(localStorage.getItem('league-win-history-v1-uncertainty45')).toBeNull();
        expect(localStorage.getItem('other')).toBe('1');
    });
});
