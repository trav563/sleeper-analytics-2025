import { describe, it, expect } from 'vitest';
import {
    buildPlayoffKeys,
    buildRivalries,
    pairKey,
    rivalryBalance,
    rivalryMargin,
    sortRivalries,
    MAX_SCORED_WEEK,
} from './rivalries';

const OWNERS = { 1: 'a', 2: 'b', 3: 'c', 4: 'd' };

/** Two matchup entries sharing a matchup_id. */
const game = (rosterA, pointsA, rosterB, pointsB, matchupId = 1) => [
    { roster_id: rosterA, matchup_id: matchupId, points: pointsA },
    { roster_id: rosterB, matchup_id: matchupId, points: pointsB },
];

/** `games` is keyed by 1-based week number. */
function season({
    season: year = '2024',
    playoffWeekStart = 15,
    rosterIdToOwnerId = OWNERS,
    games = {},
    bracket = [],
} = {}) {
    const weeks = Array.from({ length: MAX_SCORED_WEEK }, () => []);
    Object.entries(games).forEach(([week, entries]) => {
        weeks[Number(week) - 1] = entries;
    });
    return {
        season: year,
        playoffWeekStart,
        rosterIdToOwnerId,
        weeks,
        playoffKeys: buildPlayoffKeys(bracket, playoffWeekStart, rosterIdToOwnerId),
    };
}

const find = (list, a, b) => list.find((r) => pairKey(r.aId, r.bId) === pairKey(a, b));

describe('pairKey', () => {
    it('is order-independent', () => {
        expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
    });
});

describe('buildPlayoffKeys', () => {
    it('maps bracket round r to week playoffWeekStart + r - 1', () => {
        const keys = buildPlayoffKeys(
            [
                { r: 1, t1: 1, t2: 2 },
                { r: 3, t1: 1, t2: 3 },
            ],
            15,
            OWNERS
        );
        expect(keys.has(`15|${pairKey('a', 'b')}`)).toBe(true);
        expect(keys.has(`17|${pairKey('a', 'c')}`)).toBe(true);
    });

    it('honors a non-default playoffWeekStart', () => {
        const keys = buildPlayoffKeys([{ r: 1, t1: 1, t2: 2 }], 14, OWNERS);
        expect(keys.has(`14|${pairKey('a', 'b')}`)).toBe(true);
        expect(keys.has(`15|${pairKey('a', 'b')}`)).toBe(false);
    });

    it('skips unplayed rounds whose t1/t2 are still placeholders', () => {
        // Sleeper emits { w: matchId } / { l: matchId } until a game resolves.
        const keys = buildPlayoffKeys(
            [
                { r: 1, t1: 1, t2: 2 },
                { r: 2, t1: { w: 1 }, t2: { l: 1 } },
            ],
            15,
            OWNERS
        );
        expect(keys.size).toBe(1);
    });

    it('skips bracket entries whose rosters have no owner', () => {
        expect(buildPlayoffKeys([{ r: 1, t1: 1, t2: 99 }], 15, OWNERS).size).toBe(0);
    });

    it('tolerates nullish input', () => {
        expect(buildPlayoffKeys(null, 15, OWNERS).size).toBe(0);
        expect(buildPlayoffKeys([], 15, null).size).toBe(0);
    });
});

describe('buildRivalries — week window', () => {
    it('counts weeks before playoff_week_start as regular season', () => {
        const list = buildRivalries({
            seasons: [season({ games: { 14: game(1, 100, 2, 90) } })],
            currentOwnerIds: ['a', 'b'],
        });
        const ab = find(list, 'a', 'b');
        expect(ab.reg).toMatchObject({ w: 1, l: 0, g: 1 });
        expect(ab.all).toMatchObject({ w: 1, l: 0, g: 1, playoffGames: 0 });
    });

    it('derives the window per season instead of assuming week 15', () => {
        // A league with playoff_week_start 14 must treat week 14 as postseason.
        const list = buildRivalries({
            seasons: [
                season({
                    playoffWeekStart: 14,
                    games: { 14: game(1, 100, 2, 90) },
                    bracket: [{ r: 1, t1: 1, t2: 2 }],
                }),
            ],
            currentOwnerIds: ['a', 'b'],
        });
        const ab = find(list, 'a', 'b');
        expect(ab.reg.g).toBe(0);
        expect(ab.all).toMatchObject({ w: 1, g: 1, playoffGames: 1 });
    });
});

describe('buildRivalries — playoff vs consolation', () => {
    const seasons = [
        season({
            games: {
                // Championship-bracket semifinal, in the winners bracket.
                15: game(1, 120, 2, 110, 1),
                // Same week, loser bracket — must not count anywhere.
                16: game(3, 130, 4, 100, 2),
            },
            bracket: [{ r: 1, t1: 1, t2: 2 }],
        }),
    ];

    it('includes a real playoff meeting in all-time but not regular season', () => {
        const ab = find(buildRivalries({ seasons, currentOwnerIds: ['a', 'b', 'c', 'd'] }), 'a', 'b');
        expect(ab.reg.g).toBe(0);
        expect(ab.all).toMatchObject({ w: 1, l: 0, g: 1, playoffGames: 1 });
    });

    it('excludes consolation-bracket games from both scopes', () => {
        const cd = find(buildRivalries({ seasons, currentOwnerIds: ['a', 'b', 'c', 'd'] }), 'c', 'd');
        expect(cd.reg.g).toBe(0);
        expect(cd.all.g).toBe(0);
    });
});

describe('buildRivalries — ties', () => {
    it('counts an exact tie rather than dropping or awarding it', () => {
        const ab = find(
            buildRivalries({
                seasons: [season({ games: { 5: game(1, 101.5, 2, 101.5) } })],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        expect(ab.reg).toMatchObject({ w: 0, l: 0, t: 1, g: 1 });
        // The invariant the old code broke: W + L + T accounts for every game.
        expect(ab.reg.w + ab.reg.l + ab.reg.t).toBe(ab.reg.g);
    });
});

describe('buildRivalries — data hygiene', () => {
    it('skips rosters with no owner (orphan teams)', () => {
        const list = buildRivalries({
            seasons: [
                season({
                    rosterIdToOwnerId: { 1: 'a' }, // roster 2 orphaned
                    games: { 3: game(1, 100, 2, 90) },
                }),
            ],
            currentOwnerIds: ['a', 'b'],
        });
        expect(find(list, 'a', 'b').all.g).toBe(0);
    });

    it('skips scheduled-but-unplayed games where both sides scored 0', () => {
        const list = buildRivalries({
            seasons: [season({ season: '2026', games: { 1: game(1, 0, 2, 0) } })],
            currentOwnerIds: ['a', 'b'],
        });
        expect(find(list, 'a', 'b').all.g).toBe(0);
    });

    it('ignores entries with a null matchup_id instead of pairing them', () => {
        const list = buildRivalries({
            seasons: [
                season({
                    games: {
                        4: [
                            { roster_id: 1, matchup_id: null, points: 100 },
                            { roster_id: 2, matchup_id: null, points: 90 },
                        ],
                    },
                }),
            ],
            currentOwnerIds: ['a', 'b'],
        });
        expect(find(list, 'a', 'b').all.g).toBe(0);
    });

    it('skips groups that are not exactly two teams', () => {
        const list = buildRivalries({
            seasons: [
                season({
                    games: { 4: [{ roster_id: 1, matchup_id: 1, points: 100 }] },
                }),
            ],
            currentOwnerIds: ['a', 'b'],
        });
        expect(find(list, 'a', 'b').all.g).toBe(0);
    });

    it('excludes pairs involving owners outside currentOwnerIds', () => {
        const list = buildRivalries({
            seasons: [season({ games: { 4: game(1, 100, 3, 90) } })],
            currentOwnerIds: ['a', 'b'],
        });
        expect(list).toHaveLength(1); // only a|b seeded
        expect(find(list, 'a', 'b').all.g).toBe(0);
    });

    it('handles a season with no games played at all', () => {
        const list = buildRivalries({
            seasons: [season({ season: '2026' })],
            currentOwnerIds: ['a', 'b', 'c'],
        });
        expect(list).toHaveLength(3);
        expect(list.every((r) => r.all.g === 0 && r.games.length === 0)).toBe(true);
    });

    it('tolerates nullish input', () => {
        expect(buildRivalries()).toEqual([]);
        expect(buildRivalries({ seasons: null, currentOwnerIds: null })).toEqual([]);
    });
});

describe('buildRivalries — shape and orientation', () => {
    it('seeds every pair so the row count is n choose 2', () => {
        const list = buildRivalries({
            seasons: [],
            currentOwnerIds: ['a', 'b', 'c', 'd'],
        });
        expect(list).toHaveLength(6);
    });

    it('orients wins and points to aId regardless of matchup order', () => {
        // 'b' listed first in the raw matchup, but 'a' is the canonical aId.
        const ab = find(
            buildRivalries({
                seasons: [season({ games: { 2: game(2, 130, 1, 90) } })],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        expect(ab.aId).toBe('a');
        expect(ab.reg).toMatchObject({ w: 0, l: 1, pointsA: 90, pointsB: 130 });
    });

    it('accumulates across seasons and sorts games chronologically', () => {
        const ab = find(
            buildRivalries({
                // Deliberately newest-first, matching leagueHistory order.
                seasons: [
                    season({ season: '2025', games: { 3: game(1, 100, 2, 90) } }),
                    season({ season: '2024', games: { 7: game(1, 80, 2, 95) } }),
                ],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        expect(ab.reg).toMatchObject({ w: 1, l: 1, g: 2 });
        expect(ab.games.map((g) => `${g.season}w${g.week}`)).toEqual(['2024w7', '2025w3']);
    });

    it('flags playoff games in the game log', () => {
        const ab = find(
            buildRivalries({
                seasons: [
                    season({
                        games: { 4: game(1, 100, 2, 90), 15: game(1, 120, 2, 130) },
                        bracket: [{ r: 1, t1: 1, t2: 2 }],
                    }),
                ],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        expect(ab.games.map((g) => g.isPlayoff)).toEqual([false, true]);
    });
});

describe('rivalryBalance / rivalryMargin', () => {
    it('scores volume and evenness together', () => {
        expect(rivalryBalance({ w: 5, l: 4, t: 0 })).toBe(8);
        expect(rivalryBalance({ w: 4, l: 4, t: 0 })).toBe(8);
        expect(rivalryBalance({ w: 6, l: 5, t: 0 })).toBe(10);
        expect(rivalryBalance({ w: 6, l: 0, t: 0 })).toBe(0);
    });

    it('counts ties toward balance', () => {
        expect(rivalryBalance({ w: 1, l: 1, t: 2 })).toBe(4);
    });

    it('measures margin as games apart', () => {
        expect(rivalryMargin({ w: 6, l: 0 })).toBe(6);
        expect(rivalryMargin({ w: 3, l: 3 })).toBe(0);
    });

    it('tolerates a missing record', () => {
        expect(rivalryBalance(null)).toBe(0);
        expect(rivalryMargin(undefined)).toBe(0);
    });
});

describe('sortRivalries', () => {
    const mk = (aId, bId, w, l, g = w + l) => ({
        aId,
        bId,
        reg: { w, l, t: 0, g, pointsA: 0, pointsB: 0, playoffGames: 0 },
        all: { w, l, t: 0, g, pointsA: 0, pointsB: 0, playoffGames: 0 },
        games: [],
    });

    const list = [
        mk('a', 'b', 6, 0), // lopsided
        mk('c', 'd', 4, 4), // even, 8 games
        mk('e', 'f', 5, 4), // even, 9 games
        mk('g', 'h', 1, 1), // even but tiny
    ];

    it('closest puts the most balanced, highest-volume series first', () => {
        const sorted = sortRivalries(list, 'closest', 'reg');
        expect([sorted[0].aId, sorted[1].aId]).toEqual(['e', 'c']); // bal 8/9g, then 8/8g
        expect(sorted[3].aId).toBe('a'); // 6-0 sinks to the bottom
    });

    it('meetings sorts by games played', () => {
        expect(sortRivalries(list, 'meetings', 'reg')[0].aId).toBe('e'); // 9 games
    });

    it('lopsided sorts by margin', () => {
        expect(sortRivalries(list, 'lopsided', 'reg')[0].aId).toBe('a'); // margin 6
    });

    it('respects the requested scope', () => {
        const scoped = [
            {
                aId: 'a',
                bId: 'b',
                reg: { w: 0, l: 0, t: 0, g: 0 },
                all: { w: 3, l: 3, t: 0, g: 6 },
                games: [],
            },
            {
                aId: 'c',
                bId: 'd',
                reg: { w: 3, l: 3, t: 0, g: 6 },
                all: { w: 3, l: 3, t: 0, g: 6 },
                games: [],
            },
        ];
        expect(sortRivalries(scoped, 'closest', 'reg')[0].aId).toBe('c');
        expect(sortRivalries(scoped, 'closest', 'all')[0].aId).toBe('a');
    });

    it('is deterministic for equal entries and does not mutate the input', () => {
        const a = sortRivalries(list, 'closest', 'reg').map((r) => r.aId);
        const b = sortRivalries(list, 'closest', 'reg').map((r) => r.aId);
        expect(a).toEqual(b);
        expect(list[0].aId).toBe('a'); // original order untouched
    });

    it('tolerates nullish input', () => {
        expect(sortRivalries(null)).toEqual([]);
    });
});
