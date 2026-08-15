import { describe, it, expect } from 'vitest';
import { validateConfig, validateScheduleIntegrity } from './scheduleValidation';

const mkTeams = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: `Team ${i + 1}` }));

const cleanWeek = (week, pairs, byes = []) => ({
    week,
    matchups: pairs.map(([teamA, teamB]) => ({ teamA, teamB })),
    isRivalry: false,
    isLocked: false,
    byes,
});

describe('validateScheduleIntegrity', () => {
    const teamIds = ['1', '2', '3', '4'];

    it('returns no violations for a clean schedule', () => {
        const schedule = [
            cleanWeek(1, [['1', '2'], ['3', '4']]),
            cleanWeek(2, [['1', '3'], ['2', '4']]),
        ];
        expect(validateScheduleIntegrity(schedule, { teamIds, weeks: 2 })).toEqual([]);
    });

    it('flags a duplicated team and the missing teams it displaces', () => {
        // Team 1 plays twice; teams 3 and 4 vanished — the reported bug shape.
        const schedule = [cleanWeek(1, [['1', '2'], ['1', '2']])];
        const violations = validateScheduleIntegrity(schedule, { teamIds });
        const messages = violations.map(v => v.message).join(' | ');
        expect(messages).toContain('team 1 in 2 matchups');
        expect(messages).toContain('missing team 3');
        expect(messages).toContain('missing team 4');
    });

    it('flags unknown team ids and self-matches', () => {
        const schedule = [cleanWeek(1, [['1', '1'], ['99', '2']])];
        const messages = validateScheduleIntegrity(schedule, { teamIds }).map(v => v.message).join(' | ');
        expect(messages).toContain('matched against itself');
        expect(messages).toContain('unknown team 99');
    });

    it('counts byes toward per-week coverage (odd leagues)', () => {
        const ids = ['1', '2', '3'];
        const good = [cleanWeek(1, [['1', '2']], ['3'])];
        expect(validateScheduleIntegrity(good, { teamIds: ids })).toEqual([]);

        const badBye = [cleanWeek(1, [['1', '2']], ['2'])]; // 2 plays AND is on bye; 3 missing
        const messages = validateScheduleIntegrity(badBye, { teamIds: ids }).map(v => v.message).join(' | ');
        expect(messages).toContain('team 2 in 2');
        expect(messages).toContain('missing team 3');
    });

    it('flags a mutated fixed week', () => {
        const schedule = [
            cleanWeek(1, [['1', '2'], ['3', '4']]),
            cleanWeek(2, [['1', '3'], ['2', '4']]),
        ];
        const fixedWeeks = new Map([[2, { matchups: [['1', '4'], ['2', '3']] }]]);
        const messages = validateScheduleIntegrity(schedule, { teamIds, fixedWeeks }).map(v => v.message).join(' | ');
        expect(messages).toContain('Week 2 no longer matches');

        const okFixed = new Map([[2, { matchups: [['3', '1'], ['4', '2']] }]]); // order-insensitive
        expect(validateScheduleIntegrity(schedule, { teamIds, fixedWeeks: okFixed })).toEqual([]);
    });

    it('flags a wrong week count', () => {
        const schedule = [cleanWeek(1, [['1', '2'], ['3', '4']])];
        const messages = validateScheduleIntegrity(schedule, { teamIds, weeks: 3 }).map(v => v.message).join(' | ');
        expect(messages).toContain('1 weeks, expected 3');
    });
});

describe('validateConfig unknown-id rejection', () => {
    const base = {
        teams: mkTeams(4),
        weeks: 3,
        maxRepeat: 2,
        noBackToBack: false,
        divisions: null,
        lockedWeeks: [],
        rivalryWeek: null,
    };

    it('rejects rivalry matchups referencing a team not in the league', () => {
        const result = validateConfig({
            ...base,
            rivalryWeek: { enabled: true, week: 2, matchups: [{ teamA: '1', teamB: '99' }, { teamA: '3', teamB: '4' }] },
        });
        expect(result.valid).toBe(false);
        expect(result.errors.join(' | ')).toContain('no longer in the league');
    });

    it('rejects locked-week matchups referencing a team not in the league', () => {
        const result = validateConfig({
            ...base,
            lockedWeeks: [{ week: 1, matchups: [{ teamA: '99', teamB: '2' }, { teamA: '3', teamB: '4' }] }],
        });
        expect(result.valid).toBe(false);
        expect(result.errors.join(' | ')).toContain('no longer in the league');
    });

    it('accepts valid fixed weeks', () => {
        const result = validateConfig({
            ...base,
            rivalryWeek: { enabled: true, week: 2, matchups: [{ teamA: '1', teamB: '2' }, { teamA: '3', teamB: '4' }] },
        });
        expect(result.valid).toBe(true);
    });
});
