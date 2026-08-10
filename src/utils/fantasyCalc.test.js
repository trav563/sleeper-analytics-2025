import { describe, it, expect } from 'vitest';
import { getMarketPickValue } from './fantasyCalc';

const map = {
    PICK_2026_1_S1: 7123,   // "2026 Pick 1.01"
    PICK_2026_1_S12: 2279,  // "2026 Pick 1.12"
    PICK_2026_2: 1680,      // "2026 2nd"
    PICK_2027_1_early: 4572,
    PICK_2027_1_mid: 3011,
    PICK_2027_1_late: 2306,
    PICK_2027_1: 2907,
    PICK_2028_1: 2066,
};

describe('getMarketPickValue', () => {
    it('prefers the exact slot for the upcoming draft year', () => {
        expect(getMarketPickValue(map, { year: 2026, round: 1, rank: 1, tier: 'early' })).toBe(7123);
        expect(getMarketPickValue(map, { year: 2026, round: 1, rank: 12, tier: 'late' })).toBe(2279);
    });

    it('falls back to the tier for future years', () => {
        expect(getMarketPickValue(map, { year: 2027, round: 1, rank: 2, tier: 'early' })).toBe(4572);
        expect(getMarketPickValue(map, { year: 2027, round: 1, rank: 12, tier: 'late' })).toBe(2306);
    });

    it('falls back to the generic year+round when no tier entry exists', () => {
        expect(getMarketPickValue(map, { year: 2026, round: 2, rank: 5, tier: 'mid' })).toBe(1680);
        expect(getMarketPickValue(map, { year: 2028, round: 1, tier: 'mid' })).toBe(2066);
    });

    it('prices a 2027 1st below a comparable early 2026 1st (future-year discount)', () => {
        const now = getMarketPickValue(map, { year: 2026, round: 1, rank: 1, tier: 'early' });
        const future = getMarketPickValue(map, { year: 2027, round: 1, rank: 1, tier: 'early' });
        expect(future).toBeLessThan(now);
    });

    it('returns undefined for unknown picks and missing maps', () => {
        expect(getMarketPickValue(map, { year: 2030, round: 4, tier: 'mid' })).toBeUndefined();
        expect(getMarketPickValue(null, { year: 2026, round: 1 })).toBeUndefined();
    });
});
