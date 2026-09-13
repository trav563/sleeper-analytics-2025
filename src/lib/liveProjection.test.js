import { describe, expect, it } from 'vitest';
import samples from '../../research/sleeper-live-projections/samples.json';
import { gamePhase, regulationFractionRemaining, projectPlayer, projectMatchup, starterPoints } from './liveProjection';
import { projectedPointsOrNull } from '../utils/scoring';

const live = (period = 3, displayClock = '15:00') => ({ statusName: 'STATUS_IN_PROGRESS', period, displayClock });
const gameFor = clock => clock === 'SOON' ? { statusName: 'STATUS_SCHEDULED' }
    : clock === 'FINAL' ? { statusName: 'STATUS_FINAL' }
        : clock === 'HALF' ? { statusName: 'STATUS_HALFTIME' } : live(3, clock);

describe('live projection screenshot regressions', () => {
    for (const team of samples.teams) {
        it(`reproduces ${team.team}'s total and starter estimates`, () => {
            const players = {}, projections = {}, games = {};
            const matchup = { starters: [], starters_points: [], points: 0 };
            for (const [index, sample] of team.players.entries()) {
                const pid = String(index + 1);
                matchup.starters.push(pid);
                matchup.starters_points.push(sample.actual);
                matchup.points += sample.actual;
                players[pid] = { position: sample.position, team: pid };
                projections[pid] = sample.pregame;
                games[pid] = gameFor(sample.clock);
            }
            const result = projectMatchup({ matchup, players, projections, games });
            expect(result.available).toBe(true);
            expect(Math.abs(result.final - team.sleeper_projected_total)).toBeLessThan(.55);
            team.players.forEach((sample, index) => {
                if (sample.position === 'K') return; // Documented source-value differences, no arbitrary adjustment.
                const expected = sample.clock === 'FINAL' ? sample.actual : sample.screenshot_projection;
                expect(Math.abs(result.bySlot[index].final - expected)).toBeLessThanOrEqual(.01);
            });
        });
    }
});

describe('game clocks and completion', () => {
    it.each([[1, '15:00', 1], [1, '0:00', .75], [2, '0:00', .5], [3, '15:00', .5], [4, '0:00', 0]])(
        'handles Q%s %s', (period, displayClock, expected) => {
            expect(regulationFractionRemaining(live(period, displayClock))).toBe(expected);
        });
    it('distinguishes a quarter ending from a finished game', () => {
        const game = { ...live(1, '0:00'), statusName: 'STATUS_END_PERIOD' };
        expect(gamePhase(game)).toBe('LIVE');
        expect(regulationFractionRemaining(game)).toBe(.75);
        expect(regulationFractionRemaining({ statusName: 'STATUS_FULL_TIME' })).toBe(0);
    });
    it.each([undefined, {}, live(0), live(5, '5:00'), live(3, ''), live(3, '16:00'), live(3, '8:61'),
        { statusName: 'STATUS_POSTPONED' }, { statusName: 'STATUS_SUSPENDED' }])(
        'does not invent a clock or assume overtime is final: %j', game => {
            expect(projectPlayer({ actual: 7, projection: 12, position: 'RB', game }).final).toBeNull();
        });
    it('uses final actual scores even when historical projections are missing', () => {
        expect(projectPlayer({ actual: -2, projection: undefined, game: { statusName: 'STATUS_FINAL' } })).toMatchObject({ final: -2, remaining: 0 });
    });
});

describe('scoring and aggregation', () => {
    it('keeps explicit zero projections and rejects ADP-only or missing data', () => {
        expect(projectedPointsOrNull({ rush_yd: 0 }, { rush_yd: .1 })).toBe(0);
        expect(projectedPointsOrNull({ pts_half_ppr: 0 }, { rec: .5 })).toBe(0);
        expect(projectedPointsOrNull({ adp_dd_ppr: 30, gp: 1 }, { rec: .5 })).toBeNull();
        expect(projectPlayer({ actual: 0, projection: 0, position: 'RB', game: live() }).final).toBe(0);
        expect(projectPlayer({ actual: 0, projection: undefined, position: 'RB', game: live() }).final).toBeNull();
    });
    it('applies custom league scoring before the clock formula', () => {
        const projection = projectedPointsOrNull({ pass_td: 2, pass_int: 1, pass_yd: 250 }, { pass_td: 6, pass_int: -2, pass_yd: .04 });
        expect(projection).toBe(20);
        expect(projectPlayer({ actual: 10, projection, position: 'QB', game: live() }).final).toBe(17.5);
    });
    it('handles negative actual and pregame values without discarding them', () => {
        expect(projectPlayer({ actual: -2, projection: 10, position: 'RB', game: live() }).final).toBe(3.5);
        expect(projectPlayer({ actual: -2, projection: -3, position: 'DEF', game: live() }).final).toBe(-2);
        expect(projectPlayer({ actual: 0, projection: -3, position: 'DEF', game: gameFor('SOON') }).final).toBe(-3);
    });
    it('preserves slot indices, zeroes, negative scores and commissioner adjustments; excludes the bench', () => {
        const matchup = { points: 10, starters: ['0', 'a', 'b'], starters_points: [0, 0, -2], players_points: { a: 99, bench: 100 } };
        const options = { matchup, players: { a: { team: 'A', position: 'WR' }, b: { team: 'B', position: 'DEF' } },
            projections: { a: 10, b: 8, bench: 100 }, games: { A: live(), B: gameFor('FINAL') } };
        expect(starterPoints(matchup, 1)).toBe(0);
        expect(projectMatchup(options)).toMatchObject({ remaining: 5, final: 15, available: true });
        expect(projectMatchup({ ...options, games: {} })).toMatchObject({ remaining: null, final: null, available: false });
        expect(projectMatchup(options).final).toBe(15); // Restoring the current context restores its result.
    });
    it('uses players_points when slot scores are absent and treats unknown live scores as unavailable', () => {
        expect(starterPoints({ starters: ['a'], players_points: { a: -1 } }, 0)).toBe(-1);
        expect(starterPoints({ starters: ['a'] }, 0)).toBeNull();
        const args = { matchup: { starters: ['a'], points: 0 }, players: { a: { team: 'A', position: 'RB' } }, projections: { a: 12 } };
        expect(projectMatchup({ ...args, games: { A: live() } }).final).toBeNull();
        expect(projectMatchup({ ...args, games: { A: gameFor('SOON') } }).final).toBe(12);
    });
    it('does not double count points when the clock feed still says scheduled', () => {
        expect(projectPlayer({ actual: 10, projection: 15, position: 'DEF', game: gameFor('SOON') })).toMatchObject({ final: 15, remaining: 5 });
    });
});
