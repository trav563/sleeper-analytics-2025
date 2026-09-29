import { describe, it, expect } from 'vitest';
import { matchupStatus, remainingStarters } from './matchupStatus';
import { projectMatchup } from './liveProjection';

const players = { a: { team: 'A' }, b: { team: 'B' }, NYJ: { position: 'DEF' } };
const matchups = [{ starters: ['a', '0'], points: 162 }, { starters: ['b'], points: 105 }];
const games = (a, b) => ({ A: { statusName: a }, B: { statusName: b } });
const status = (gameData, extra = {}) => matchupStatus({ matchups, players, games: gameData, week: 4, ...extra });

describe('shared matchup status', () => {
    it('never labels a completed matchup upcoming', () => {
        expect(status(games('STATUS_FINAL', 'STATUS_FINAL_OVERTIME'))).toBe('Final');
        expect(status({}, { completedWeek: 4 })).toBe('Final');
    });
    it('checks both teams for live play including intermissions', () => {
        expect(status(games('STATUS_FINAL', 'STATUS_END_PERIOD'))).toBe('Live');
        expect(status(games('STATUS_FINAL', 'STATUS_HALFTIME'))).toBe('Live');
    });
    it('distinguishes upcoming games from a week between games', () => {
        expect(status(games('STATUS_SCHEDULED', 'STATUS_PREGAME'))).toBe('Upcoming');
        expect(status(games('STATUS_FINAL', 'STATUS_SCHEDULED'))).toBe('In progress');
    });
    it('does not infer finality or zero players remaining from points or missing clocks', () => {
        expect(status({})).toBe('Unavailable');
        expect(status(games('STATUS_FINAL', 'STATUS_POSTPONED'))).toBe('Unavailable');
        expect(remainingStarters(matchups[0], players, {})).toBeNull();
        expect(remainingStarters(matchups[0], players, {}, true)).toBe(0);
    });
    it('handles defense identifiers and ignores empty starter slots', () => {
        expect(matchupStatus({ matchups: [{ starters: ['NYJ', '0'] }], players, games: { NYJ: { statusName: 'STATUS_FINAL' } } })).toBe('Final');
        expect(matchupStatus({ matchups: [{ starters: [] }], players })).toBe('Unavailable');
    });
    it('uses actual team points for a confirmed completed week without historical clock data', () => {
        const projected = projectMatchup({ matchup: matchups[0], players, games: {}, projections: {}, isWeekFinal: true });
        expect(projected).toMatchObject({ final: 162, remaining: 0, isFinal: true, available: true });
        expect(projectMatchup({ matchup: matchups[0], players, games: {}, projections: {} }).available).toBe(false);
    });
});
