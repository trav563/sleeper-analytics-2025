import { describe, it, expect } from 'vitest';
import { leagueRecords, scheduleLuck } from './leagueRecords';
import { computePowerRankings } from '../features/analytics/hooks/usePowerRankings';

const rosters = [1, 2, 3, 4].map(roster_id => ({ roster_id }));
const league = { settings: { league_average_match: 1, start_week: 1, playoff_week_start: 3 } };
const week = scores => scores.map((points, i) => ({ roster_id: i + 1, matchup_id: Math.floor(i / 2) + 1, points }));
describe('league records', () => {
    it('adds median results without doubling weekly production or all-play', () => {
        const weeks = { 1: week([120, 110, 100, 90]) };
        const ordinary = leagueRecords(rosters, weeks);
        const result = leagueRecords(rosters, weeks, league);
        expect(result.map(r => r.record)).toEqual(['2-0', '1-1', '1-1', '0-2']);
        result.forEach((r, i) => {
            expect(r.weeksPlayed).toBe(1); expect(r.recordGames).toBe(2);
            expect(r.ppg).toBe(ordinary[i].ppg); expect(r.totalPoints).toBe(ordinary[i].totalPoints);
            expect(r.apWinPct).toBe(ordinary[i].apWinPct); expect(r.sos).toBe(ordinary[i].sos);
            expect(scheduleLuck(r)).toBe(scheduleLuck(ordinary[i]));
        });
    });
    it('preserves head-to-head and median ties, zeroes and negative scores', () => {
        const result = leagueRecords(rosters, { 1: week([0, 0, -2, 2]) }, league);
        expect(result.map(r => r.record)).toEqual(['0-0-2', '0-0-2', '0-2', '2-0']);
        expect(result[0].winPct).toBe(.5);
    });
    it('uses the selected season settings and regular-season window', () => {
        const weeks = { 1: week([1, 2, 3, 4]), 2: week([4, 3, 2, 1]), 3: week([9, 8, 7, 6]) };
        const result = leagueRecords(rosters, weeks, { settings: { start_week: 2, playoff_week_start: 3, league_average_match: 0 } });
        expect(result[0]).toMatchObject({ record: '1-0', weeksPlayed: 1, throughWeek: 2, totalPoints: 4 });
    });
    it.each([week([1, 2, 3]), week([1, null, 3, 4]), [ ...week([1, 2, 3]), { roster_id: 1, matchup_id: 2, points: 4 } ]])('rejects partial or duplicate median input', rows => {
        const result = leagueRecords(rosters, { 1: rows }, league);
        expect(result.every(r => !r.complete && r.median.wins + r.median.losses + r.median.ties === 0)).toBe(true);
        expect(computePowerRankings({ 1: rows }, rosters, [], league).rankings).toEqual([]);
    });
    it('does not publish partial rankings when a completed week is missing', () => {
        const result = leagueRecords(rosters, { 2: week([1, 2, 3, 4]) }, league);
        expect(result[0].incompleteWeeks).toEqual([1]);
        expect(computePowerRankings({ 1: week([1, 2, 3, 4]), 2: [] }, rosters, [], league).rankings).toEqual([]);
    });
    it('never adds median wins to the API cumulative record', () => {
        const official = rosters.map(r => ({ ...r, settings: { wins: 10, losses: 10 } }));
        expect(leagueRecords(official, { 1: week([120, 110, 100, 90]) }, league)[0].record).toBe('2-0');
    });
});
