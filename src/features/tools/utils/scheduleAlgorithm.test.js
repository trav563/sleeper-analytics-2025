import { describe, it, expect } from 'vitest';
import { generateSchedule } from './scheduleAlgorithm';
import { validateScheduleIntegrity } from './scheduleValidation';

const mkTeams = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Team ${i + 1}` }));

const baseConfig = (n, weeks, overrides = {}) => ({
    teams: mkTeams(n),
    weeks,
    maxRepeat: 2,
    noBackToBack: true,
    divisions: null,
    rivalryWeek: null,
    lockedWeeks: [],
    ...overrides,
});

// The exact config reproduced from the bug report: noBackToBack + a rivalry
// week whose pairings collide with an adjacent generated week.
const reproRivalry = {
    enabled: true,
    week: 2,
    matchups: [
        { teamA: '5', teamB: '1' },
        { teamA: '6', teamB: '3' },
        { teamA: '12', teamB: '9' },
        { teamA: '4', teamB: '2' },
        { teamA: '7', teamB: '8' },
        { teamA: '10', teamB: '11' },
    ],
};

/**
 * Assert every week is a perfect matching over teamIds — checked directly,
 * not only via validateScheduleIntegrity, so the generator tests don't rely
 * solely on the checker they cross-validate.
 */
function expectIntegrity(result, teamIds) {
    for (const week of result.schedule) {
        const seen = [];
        for (const m of week.matchups) seen.push(m.teamA, m.teamB);
        seen.push(...(week.byes || []));
        expect(
            seen.slice().sort(),
            `week ${week.week}: ${JSON.stringify(week.matchups)} byes=${JSON.stringify(week.byes)}`
        ).toEqual(teamIds.slice().sort());
    }
    expect(validateScheduleIntegrity(result.schedule, { teamIds })).toEqual([]);
}

const pairSet = (matchups) =>
    new Set(matchups.map(m => [m.teamA, m.teamB].sort().join('|')));

describe('generateSchedule week integrity', () => {
    const ids12 = mkTeams(12).map(t => t.id);

    it('regression: no duplicated/missing teams with noBackToBack + rivalry week (reported bug)', () => {
        const result = generateSchedule(baseConfig(12, 14, { rivalryWeek: reproRivalry }));
        expectIntegrity(result, ids12);
        // Rivalry week survives intact
        const rivalryOut = result.schedule.find(w => w.week === 2);
        expect(pairSet(rivalryOut.matchups)).toEqual(pairSet(reproRivalry.matchups.map(m => ({ ...m }))));
        // The banner may report honest back-to-back violations, but never
        // structural corruption.
        for (const v of result.constraintReport.violations) {
            expect(v.type).not.toBe('integrity');
        }
    });

    it('property sweep: rivalry week at every position keeps integrity + immutability', () => {
        for (let week = 1; week <= 14; week++) {
            const rivalry = { ...reproRivalry, week };
            const result = generateSchedule(baseConfig(12, 14, { rivalryWeek: rivalry }));
            expectIntegrity(result, ids12);
            const out = result.schedule.find(w => w.week === week);
            expect(pairSet(out.matchups), `rivalry at week ${week}`).toEqual(
                pairSet(rivalry.matchups.map(m => ({ ...m })))
            );
            expect(out.isRivalry).toBe(true);
        }
    });

    it('property sweep: locked week at edge and middle positions keeps integrity', () => {
        for (const week of [1, 2, 7, 13, 14]) {
            const locked = { week, matchups: reproRivalry.matchups.map(m => ({ ...m })) };
            const result = generateSchedule(baseConfig(12, 14, { lockedWeeks: [locked] }));
            expectIntegrity(result, ids12);
            const out = result.schedule.find(w => w.week === week);
            expect(pairSet(out.matchups), `locked at week ${week}`).toEqual(pairSet(locked.matchups));
            expect(out.isLocked).toBe(true);
        }
    });

    it('rivalry + locked week in one config both survive intact', () => {
        const locked = {
            week: 6,
            matchups: [
                { teamA: '1', teamB: '2' }, { teamA: '3', teamB: '4' },
                { teamA: '5', teamB: '6' }, { teamA: '7', teamB: '9' },
                { teamA: '8', teamB: '10' }, { teamA: '11', teamB: '12' },
            ],
        };
        const result = generateSchedule(baseConfig(12, 14, { rivalryWeek: reproRivalry, lockedWeeks: [locked] }));
        expectIntegrity(result, ids12);
        expect(pairSet(result.schedule.find(w => w.week === 2).matchups))
            .toEqual(pairSet(reproRivalry.matchups.map(m => ({ ...m }))));
        expect(pairSet(result.schedule.find(w => w.week === 6).matchups))
            .toEqual(pairSet(locked.matchups));
    });

    it('11-team league with rivalry week keeps one correct bye per week', () => {
        const ids11 = mkTeams(11).map(t => t.id);
        const rivalry = {
            enabled: true,
            week: 3,
            matchups: [
                { teamA: '1', teamB: '2' }, { teamA: '3', teamB: '4' },
                { teamA: '5', teamB: '6' }, { teamA: '7', teamB: '8' },
                { teamA: '9', teamB: '10' },
            ],
        };
        const result = generateSchedule(baseConfig(11, 14, { rivalryWeek: rivalry }));
        expectIntegrity(result, ids11); // multiset check covers bye correctness
        for (const week of result.schedule) {
            expect(week.byes.length, `week ${week.week} byes`).toBe(1);
            const playing = new Set(week.matchups.flatMap(m => [m.teamA, m.teamB]));
            expect(playing.has(week.byes[0])).toBe(false);
        }
    });

    it('negative control: same config with noBackToBack false is clean', () => {
        const result = generateSchedule(baseConfig(12, 14, { noBackToBack: false, rivalryWeek: reproRivalry }));
        expectIntegrity(result, ids12);
        expect(result.constraintReport.violations.filter(v => v.type === 'integrity')).toEqual([]);
    });

    it('plain 12-team schedule with no fixed weeks stays clean and satisfied', () => {
        const result = generateSchedule(baseConfig(12, 14));
        expectIntegrity(result, ids12);
    });
});
