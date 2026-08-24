import { describe, it, expect } from 'vitest';
import { isSeasonStarted, deriveCurrentWeek } from './seasonState';

const league = (season, playoffWeekStart = 15) => ({
    season: String(season),
    settings: { playoff_week_start: playoffWeekStart },
});
// Real shape from GET /state/nfl during the 2026 preseason.
const preseason = { season: '2026', season_type: 'pre', week: 2, display_week: 2 };
const regular = { season: '2026', season_type: 'regular', week: 5, display_week: 5 };
const offseason = { season: '2026', season_type: 'off', week: 1, display_week: 1 };
const postseason = { season: '2026', season_type: 'post', week: 16, display_week: 16 };

describe('isSeasonStarted', () => {
    it('is false during the preseason and offseason', () => {
        expect(isSeasonStarted(league(2026), preseason)).toBe(false);
        expect(isSeasonStarted(league(2026), offseason)).toBe(false);
    });

    it('is true during the regular season and playoffs', () => {
        expect(isSeasonStarted(league(2026), regular)).toBe(true);
        expect(isSeasonStarted(league(2026), postseason)).toBe(true);
    });

    it('treats past seasons as started regardless of current NFL state', () => {
        expect(isSeasonStarted(league(2023), preseason)).toBe(true);
    });

    it('treats a future league season as not started', () => {
        expect(isSeasonStarted(league(2027), preseason)).toBe(false);
    });

    it('is false when state is missing', () => {
        expect(isSeasonStarted(league(2026), null)).toBe(false);
        expect(isSeasonStarted(null, null)).toBe(false);
    });
});

describe('deriveCurrentWeek', () => {
    it('anchors to week 1 in the preseason instead of the preseason week number', () => {
        // The reported bug: display_week 2 is PRESEASON week 2.
        expect(deriveCurrentWeek(league(2026), preseason)).toBe(1);
        expect(deriveCurrentWeek(league(2026), offseason)).toBe(1);
    });

    it('uses the NFL display week once the season is under way', () => {
        expect(deriveCurrentWeek(league(2026), regular)).toBe(5);
        expect(deriveCurrentWeek(league(2026), postseason)).toBe(16);
    });

    it('anchors past seasons to the last regular-season week', () => {
        expect(deriveCurrentWeek(league(2023, 15), regular)).toBe(14);
        expect(deriveCurrentWeek({ season: '2023' }, regular)).toBe(17); // no playoff setting
    });

    it('falls back to week 1 with no usable state', () => {
        expect(deriveCurrentWeek(league(2026), {})).toBe(1);
        expect(deriveCurrentWeek(null, null)).toBe(1);
    });
});
