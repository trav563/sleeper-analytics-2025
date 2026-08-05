import { describe, it, expect } from 'vitest';
import { buildH2HCsvRows, buildBucketCsvRows, buildManagerCsvRows } from './rivalryCsv';
import { toCSV } from '../../../utils/csv';

const AT_DATE = new Date(2026, 7, 5, 12, 0, 0);
const LEAGUE = '12 Guys 1 Cup';
// The real name that exercises the escaper.
const COMMA_NAME = 'Big Socks, Big Dicker';

const NAMES = { a: 'Saco Rams', b: COMMA_NAME, c: 'Buttery Nipple' };
const nameOf = (id) => NAMES[id] || `User ${id}`;

/** Look up a preamble value by its key. */
const val = (rows, key) => rows.find((r) => r[0] === key)?.[1];
/** The header row is the first one after the blank spacer. */
const headerRow = (rows) => rows[rows.findIndex((r) => r.length === 0) + 1];
const dataRows = (rows) => rows.slice(rows.findIndex((r) => r.length === 0) + 2);

describe('buildH2HCsvRows', () => {
    const h2h = {
        wins1: 2,
        wins2: 1,
        ties: 0,
        points1: 300,
        points2: 280,
        games: 3,
        playoffGames: 1,
        history: [
            { season: '2024', week: 3, isPlayoff: false, score1: 120, score2: 100, winner: 'a' },
            { season: '2024', week: 15, isPlayoff: true, score1: 90, score2: 110, winner: 'b' },
            { season: '2025', week: 7, isPlayoff: false, score1: 90, score2: 70, winner: 'a' },
        ],
    };

    it('emits preamble, header, and one row per game', () => {
        const rows = buildH2HCsvRows({
            leagueName: LEAGUE, scope: 'reg', nameA: NAMES.a, nameB: NAMES.b, h2h, generatedAt: AT_DATE,
        });
        expect(val(rows, 'View')).toBe('Head-to-Head');
        expect(val(rows, 'Scope')).toBe('Regular Season');
        expect(val(rows, 'Record')).toBe('2-1');
        expect(val(rows, 'Generated')).toBe('2026-08-05');
        expect(headerRow(rows)).toEqual([
            'Season', 'Week', 'Type', NAMES.a, COMMA_NAME, 'Winner', 'Margin',
        ]);
        expect(dataRows(rows)).toHaveLength(3);
    });

    it('labels playoff rows and names the winner from the scores', () => {
        const rows = buildH2HCsvRows({
            leagueName: LEAGUE, scope: 'all', nameA: NAMES.a, nameB: NAMES.b, h2h, generatedAt: AT_DATE,
        });
        const data = dataRows(rows);
        expect(data[0][2]).toBe('Regular');
        expect(data[1][2]).toBe('Playoff');
        expect(data[0][5]).toBe(NAMES.a);
        expect(data[1][5]).toBe(COMMA_NAME);
        expect(data[0][6]).toBe('20.0');
    });

    it('includes Playoff Meetings only in the all-time scope', () => {
        const reg = buildH2HCsvRows({ scope: 'reg', nameA: 'A', nameB: 'B', h2h, generatedAt: AT_DATE });
        const all = buildH2HCsvRows({ scope: 'all', nameA: 'A', nameB: 'B', h2h, generatedAt: AT_DATE });
        expect(val(reg, 'Playoff Meetings')).toBeUndefined();
        expect(val(all, 'Playoff Meetings')).toBe(1);
    });

    it('quotes a team name containing a comma once serialized', () => {
        const csv = toCSV(
            buildH2HCsvRows({
                leagueName: LEAGUE, scope: 'reg', nameA: NAMES.a, nameB: NAMES.b, h2h,
                generatedAt: AT_DATE,
            })
        );
        expect(csv).toContain(`"${COMMA_NAME}"`);
    });

    it('returns nothing without an h2h summary', () => {
        expect(buildH2HCsvRows({ h2h: null })).toEqual([]);
    });
});

describe('buildBucketCsvRows', () => {
    const entry = (aId, bId, w, l, g, playoffGames = 0) => ({
        aId, bId,
        reg: { w, l, t: 0, g, pointsA: 0, pointsB: 0, playoffGames },
        all: { w, l, t: 0, g, pointsA: 0, pointsB: 0, playoffGames },
        games: [],
    });
    const entries = [entry('a', 'b', 5, 4, 9), entry('a', 'c', 4, 4, 8)];

    it('ranks rows in the order given and labels the bucket', () => {
        const rows = buildBucketCsvRows({
            leagueName: LEAGUE, scope: 'reg', bucket: 'closest', entries, nameOf, generatedAt: AT_DATE,
        });
        expect(val(rows, 'Bucket')).toBe('Closest');
        expect(val(rows, 'Pairs')).toBe(2);
        expect(headerRow(rows)).toEqual([
            'Rank', 'Bucket', 'Team A', 'Team B', 'W', 'L', 'T', 'Meetings', 'Margin',
            'Playoff Meetings',
        ]);
        const data = dataRows(rows);
        expect(data[0].slice(0, 4)).toEqual([1, 'Closest', NAMES.a, COMMA_NAME]);
        expect(data[1][0]).toBe(2);
    });

    it('computes margin and keeps the column set stable across scopes', () => {
        const rows = buildBucketCsvRows({
            scope: 'reg', bucket: 'lopsided', entries: [entry('a', 'b', 6, 0, 6)], nameOf,
            generatedAt: AT_DATE,
        });
        const data = dataRows(rows);
        expect(data[0][8]).toBe(6); // margin
        expect(data[0][9]).toBe(0); // playoff meetings present even in reg
    });

    it('handles an empty bucket', () => {
        const rows = buildBucketCsvRows({
            scope: 'reg', bucket: 'thin', entries: [], nameOf, generatedAt: AT_DATE,
        });
        expect(val(rows, 'Pairs')).toBe(0);
        expect(dataRows(rows)).toHaveLength(0);
    });
});

describe('buildManagerCsvRows', () => {
    const sp = (w, l, t = 0) => ({
        w, l, t, g: w + l + t, pointsFor: 0, pointsAgainst: 0, playoffGames: 0,
    });
    const split = {
        ownerId: 'a',
        seasons: ['2024', '2025'],
        rows: [
            { opponentId: 'b', total: sp(2, 1), bySeason: { 2024: sp(1, 1), 2025: sp(1, 0) }, seasons: ['2024', '2025'] },
            { opponentId: 'c', total: sp(0, 1), bySeason: { 2025: sp(0, 1) }, seasons: ['2025'] },
        ],
        total: sp(2, 2),
    };

    it('emits a season column per played season and a TOTAL row', () => {
        const rows = buildManagerCsvRows({
            leagueName: LEAGUE, scope: 'reg', managerName: NAMES.a, split, nameOf, generatedAt: AT_DATE,
        });
        expect(val(rows, 'Manager')).toBe(NAMES.a);
        expect(val(rows, 'Opponents')).toBe(2);
        expect(val(rows, 'Record vs current managers')).toBe('2-2');
        expect(headerRow(rows)).toEqual([
            'Opponent', 'Lifetime', 'W', 'L', 'T', 'Meetings', '2024', '2025',
        ]);
        const data = dataRows(rows);
        expect(data).toHaveLength(3); // 2 opponents + TOTAL
        expect(data[2][0]).toBe('TOTAL');
    });

    it('leaves a never-met season cell empty rather than dashed', () => {
        const rows = buildManagerCsvRows({ scope: 'reg', split, nameOf, generatedAt: AT_DATE });
        const cRow = dataRows(rows).find((r) => r[0] === NAMES.c);
        expect(cRow[6]).toBe(''); // 2024 — never met
        expect(cRow[7]).toBe('0-1'); // 2025
    });

    it('column count is 6 + seasons.length', () => {
        const rows = buildManagerCsvRows({ scope: 'reg', split, nameOf, generatedAt: AT_DATE });
        expect(headerRow(rows)).toHaveLength(6 + split.seasons.length);
    });

    it('sums per-season totals across opponents', () => {
        const rows = buildManagerCsvRows({ scope: 'reg', split, nameOf, generatedAt: AT_DATE });
        const totalRow = dataRows(rows).find((r) => r[0] === 'TOTAL');
        expect(totalRow[6]).toBe('1-1'); // 2024: only vs b
        expect(totalRow[7]).toBe('1-1'); // 2025: 1-0 vs b + 0-1 vs c
    });

    it('returns nothing when there are no opponents', () => {
        expect(buildManagerCsvRows({ split: { rows: [] } })).toEqual([]);
        expect(buildManagerCsvRows({})).toEqual([]);
    });
});

describe('formula-injection coverage across every user-authored field', () => {
    // These exist to FAIL if a csvText() call is ever removed from a builder.
    // csv.test.js proves csvText works; only this proves the builders call it.
    const EVIL = '=SUM(A1:A9)';
    const SPACED = '   =1+1';
    const AT = '@cmd';

    it('neutralizes league, manager and opponent names in the manager export', () => {
        const split = {
            ownerId: 'a',
            seasons: ['2025'],
            rows: [
                {
                    opponentId: 'evil',
                    total: { w: 1, l: 0, t: 0, g: 1 },
                    bySeason: { 2025: { w: 1, l: 0, t: 0, g: 1 } },
                    seasons: ['2025'],
                },
            ],
            total: { w: 1, l: 0, t: 0, g: 1 },
        };
        const csv = toCSV(
            buildManagerCsvRows({
                leagueName: EVIL,
                scope: 'reg',
                managerName: SPACED,
                split,
                nameOf: () => AT,
                generatedAt: AT_DATE,
            })
        );
        expect(csv).toContain(`'${EVIL}`);
        expect(csv).toContain("'=1+1");
        expect(csv).toContain(`'${AT}`);
        // No raw formula may survive at the start of a field.
        expect(csv).not.toMatch(/(^|,)=SUM/m);
        expect(csv).not.toMatch(/(^|,)@cmd/m);
    });

    it('neutralizes both team names in the bucket export', () => {
        const csv = toCSV(
            buildBucketCsvRows({
                leagueName: 'ok',
                scope: 'reg',
                bucket: 'closest',
                entries: [
                    {
                        aId: 'x',
                        bId: 'y',
                        reg: { w: 5, l: 4, t: 0, g: 9, playoffGames: 0 },
                        all: { w: 5, l: 4, t: 0, g: 9, playoffGames: 0 },
                        games: [],
                    },
                ],
                nameOf: (id) => (id === 'x' ? EVIL : AT),
                generatedAt: AT_DATE,
            })
        );
        expect(csv).toContain(`'${EVIL}`);
        expect(csv).toContain(`'${AT}`);
        expect(csv).not.toMatch(/(^|,)=SUM/m);
    });

    it('neutralizes team names and the winner in the h2h export', () => {
        const csv = toCSV(
            buildH2HCsvRows({
                leagueName: 'ok',
                scope: 'reg',
                nameA: EVIL,
                nameB: AT,
                h2h: {
                    wins1: 1, wins2: 0, ties: 0, points1: 100, points2: 90, games: 1,
                    playoffGames: 0,
                    history: [
                        { season: '2025', week: 1, isPlayoff: false, score1: 100, score2: 90 },
                    ],
                },
                generatedAt: AT_DATE,
            })
        );
        // Present in both the column header and the Winner cell.
        expect(csv.match(/'=SUM/g)?.length).toBeGreaterThanOrEqual(2);
        expect(csv).not.toMatch(/(^|,)=SUM/m);
    });

    it('leaves genuine negative numbers numeric — the guard must not over-apply', () => {
        const csv = toCSV(
            buildH2HCsvRows({
                leagueName: 'ok',
                scope: 'reg',
                nameA: 'A',
                nameB: 'B',
                h2h: {
                    wins1: 0, wins2: 1, ties: 0, points1: 90, points2: 100, games: 1,
                    playoffGames: 0,
                    history: [
                        { season: '2025', week: 1, isPlayoff: false, score1: -3.5, score2: 100 },
                    ],
                },
                generatedAt: AT_DATE,
            })
        );
        expect(csv).toContain('-3.5');
        expect(csv).not.toContain("'-3.5");
    });
});
