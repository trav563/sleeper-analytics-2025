import { describe, it, expect } from 'vitest';
import {
    buildPlayoffKeys,
    buildRivalries,
    bucketRivalries,
    buildManagerSplits,
    formatRecord,
    pairKey,
    rivalryBalance,
    rivalryBucket,
    rivalryMargin,
    seasonSplits,
    sortRivalries,
    MAX_SCORED_WEEK,
    MIN_BUCKET_MEETINGS,
    RIVALRY_BUCKETS,
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
                // Both games in the SAME postseason week, with distinct
                // matchup_ids — the championship and loser brackets really do
                // run concurrently, so each bucket must be classified on its own.
                15: [
                    ...game(1, 120, 2, 110, 1), // championship bracket
                    ...game(3, 130, 4, 100, 2), // loser bracket
                ],
            },
            bracket: [{ r: 1, t1: 1, t2: 2 }],
        }),
    ];

    it('includes a real playoff meeting in all-time but not regular season', () => {
        const ab = find(buildRivalries({ seasons, currentOwnerIds: ['a', 'b', 'c', 'd'] }), 'a', 'b');
        expect(ab.reg.g).toBe(0);
        expect(ab.all).toMatchObject({ w: 1, l: 0, g: 1, playoffGames: 1 });
    });

    it('excludes concurrent loser-bracket games in the same week from both scopes', () => {
        const cd = find(buildRivalries({ seasons, currentOwnerIds: ['a', 'b', 'c', 'd'] }), 'c', 'd');
        expect(cd.reg.g).toBe(0);
        expect(cd.all.g).toBe(0);
    });
});

describe('buildRivalries — placement games inside the winners bracket', () => {
    // Sleeper's `p` marks a placement game deciding places p and p+1, so p:1 is
    // the championship final while p:3 / p:5 are played by eliminated teams.
    const withP = (p) =>
        buildRivalries({
            seasons: [
                season({
                    games: { 17: game(1, 120, 2, 110) },
                    bracket: [{ r: 3, t1: 1, t2: 2, ...(p === undefined ? {} : { p }) }],
                }),
            ],
            currentOwnerIds: ['a', 'b'],
        });

    it('counts an advancement game (no p field)', () => {
        expect(find(withP(undefined), 'a', 'b').all).toMatchObject({ g: 1, playoffGames: 1 });
    });

    it('counts the championship final (p:1)', () => {
        expect(find(withP(1), 'a', 'b').all).toMatchObject({ g: 1, playoffGames: 1 });
    });

    it('excludes the third-place game (p:3)', () => {
        const ab = find(withP(3), 'a', 'b');
        expect(ab.all.g).toBe(0);
        expect(ab.reg.g).toBe(0);
    });

    it('excludes the fifth-place game (p:5)', () => {
        expect(find(withP(5), 'a', 'b').all.g).toBe(0);
    });

    it('keeps placement games out of buildPlayoffKeys entirely', () => {
        const keys = buildPlayoffKeys(
            [
                { r: 1, t1: 1, t2: 2 },        // advancement -> kept
                { r: 3, t1: 1, t2: 3, p: 1 },  // final       -> kept
                { r: 2, t1: 2, t2: 3, p: 5 },  // fifth place -> dropped
                { r: 3, t1: 2, t2: 4, p: 3 },  // third place -> dropped
            ],
            15,
            OWNERS
        );
        expect(keys.size).toBe(2);
        expect(keys.has(`15|${pairKey('a', 'b')}`)).toBe(true);
        expect(keys.has(`17|${pairKey('a', 'c')}`)).toBe(true);
        expect(keys.has(`16|${pairKey('b', 'c')}`)).toBe(false);
        expect(keys.has(`17|${pairKey('b', 'd')}`)).toBe(false);
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

    it('follows an owner whose roster_id changes between seasons', () => {
        // Sleeper reassigns roster_ids across seasons; the map is inverted
        // per-season, so identity must track the owner, not the roster.
        const ab = find(
            buildRivalries({
                seasons: [
                    season({
                        season: '2025',
                        rosterIdToOwnerId: { 7: 'a', 8: 'b' },
                        games: { 3: game(7, 100, 8, 90) },
                    }),
                    season({
                        season: '2024',
                        rosterIdToOwnerId: { 1: 'a', 2: 'b' },
                        games: { 3: game(1, 80, 2, 95) },
                    }),
                ],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        expect(ab.reg).toMatchObject({ w: 1, l: 1, g: 2 });
    });

    it('does not double-count when a roster appears twice in one week', () => {
        // Defensive: the public API gives one entry per roster per week, but a
        // duplicated bucket must not inflate a series.
        const ab = find(
            buildRivalries({
                seasons: [
                    season({
                        games: {
                            4: [
                                ...game(1, 100, 2, 90, 1),
                                ...game(1, 100, 2, 90, 1), // same matchup_id, repeated
                            ],
                        },
                    }),
                ],
                currentOwnerIds: ['a', 'b'],
            }),
            'a',
            'b'
        );
        // The 4-entry bucket is not a clean pair, so it is skipped outright.
        expect(ab.all.g).toBe(0);
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

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------

/** Minimal record for bucket/sort tests. */
const rec = (w, l, t = 0) => ({ w, l, t, g: w + l + t, pointsA: 0, pointsB: 0, playoffGames: 0 });

describe('rivalryBucket', () => {
    it('sends anything under the meeting floor to thin', () => {
        expect(MIN_BUCKET_MEETINGS).toBe(5);
        expect(rivalryBucket(rec(0, 0))).toBe('thin'); // never met
        expect(rivalryBucket(rec(2, 2))).toBe('thin'); // 4 games, dead even
        expect(rivalryBucket(rec(4, 0))).toBe('thin'); // 4 games, lopsided
    });

    it('classifies by margin once the floor is met', () => {
        expect(rivalryBucket(rec(3, 2))).toBe('closest'); // margin 1, 5 games
        expect(rivalryBucket(rec(3, 3))).toBe('closest'); // margin 0
        expect(rivalryBucket(rec(4, 2))).toBe('competitive'); // margin 2
        expect(rivalryBucket(rec(5, 2))).toBe('competitive'); // margin 3
        expect(rivalryBucket(rec(5, 1))).toBe('lopsided'); // margin 4
        expect(rivalryBucket(rec(6, 0))).toBe('lopsided'); // margin 6
    });

    it('counts ties toward the meeting floor', () => {
        expect(rivalryBucket(rec(2, 2, 1))).toBe('closest'); // 5 games, margin 0
    });

    it('treats a nullish or malformed record as thin, not closest', () => {
        // Guards the trap: `undefined < 5` is false, so without normalizing `g`
        // these would fall through to margin 0 and be called "closest".
        expect(rivalryBucket(undefined)).toBe('thin');
        expect(rivalryBucket(null)).toBe('thin');
        expect(rivalryBucket({ w: 3, l: 3 })).toBe('thin'); // no g
        expect(rivalryBucket({ w: 3, l: 3, g: NaN })).toBe('thin');
    });
});

describe('bucketRivalries', () => {
    const entry = (aId, bId, r, a = r) => ({ aId, bId, reg: r, all: a, games: [] });
    const list = [
        entry('a', 'b', rec(5, 4)), // closest
        entry('c', 'd', rec(4, 2)), // competitive
        entry('e', 'f', rec(6, 0)), // lopsided
        entry('g', 'h', rec(1, 1)), // thin
    ];

    it('always returns all four buckets', () => {
        const out = bucketRivalries([], 'reg');
        expect(Object.keys(out).sort()).toEqual([...RIVALRY_BUCKETS].sort());
        expect(RIVALRY_BUCKETS.every((b) => Array.isArray(out[b]))).toBe(true);
    });

    it('partitions: every entry lands in exactly one bucket', () => {
        const out = bucketRivalries(list, 'reg');
        const total = RIVALRY_BUCKETS.reduce((s, b) => s + out[b].length, 0);
        expect(total).toBe(list.length);
        const seen = RIVALRY_BUCKETS.flatMap((b) => out[b].map((e) => pairKey(e.aId, e.bId)));
        expect(new Set(seen).size).toBe(list.length);
    });

    it('lets a pair move bucket when the scope changes', () => {
        // 4 meetings in regular season (thin), 6 once playoffs count (competitive).
        const scoped = [entry('a', 'b', rec(2, 2), rec(4, 2))];
        expect(bucketRivalries(scoped, 'reg').thin).toHaveLength(1);
        expect(bucketRivalries(scoped, 'all').competitive).toHaveLength(1);
    });

    it('orders competitive by substance, not by smallest margin', () => {
        // Documented intent: a 7-meeting 5-2 outranks a 6-meeting 4-2 even though
        // its margin is larger, because the bucket already bounds the margin.
        const out = bucketRivalries(
            [entry('c', 'd', rec(4, 2)), entry('a', 'b', rec(5, 2))],
            'reg'
        );
        expect(out.competitive.map((e) => e.aId)).toEqual(['a', 'c']);
    });

    it('orders lopsided by widest margin first', () => {
        const out = bucketRivalries(
            [entry('a', 'b', rec(5, 1)), entry('c', 'd', rec(6, 0))],
            'reg'
        );
        expect(out.lopsided.map((e) => e.aId)).toEqual(['c', 'a']);
    });

    it('orders thin by meetings so near-qualifiers surface first', () => {
        const out = bucketRivalries(
            [entry('a', 'b', rec(1, 0)), entry('c', 'd', rec(2, 2))],
            'reg'
        );
        expect(out.thin.map((e) => e.aId)).toEqual(['c', 'a']);
    });

    it('does not mutate the input and tolerates nullish', () => {
        const before = list.map((e) => e.aId);
        bucketRivalries(list, 'reg');
        expect(list.map((e) => e.aId)).toEqual(before);
        expect(bucketRivalries(null).closest).toEqual([]);
    });
});

describe('formatRecord', () => {
    it('appends the tie column only when there are ties', () => {
        expect(formatRecord(rec(4, 2))).toBe('4-2');
        expect(formatRecord(rec(4, 2, 1))).toBe('4-2-1');
        expect(formatRecord(rec(0, 0))).toBe('0-0');
        expect(formatRecord(null)).toBe('0-0');
    });
});

// ---------------------------------------------------------------------------
// Per-season splits / one-vs-all
// ---------------------------------------------------------------------------

describe('seasonSplits', () => {
    const build = () =>
        buildRivalries({
            seasons: [
                season({
                    season: '2025',
                    games: { 3: game(1, 120, 2, 100), 15: game(1, 90, 2, 130) },
                    bracket: [{ r: 1, t1: 1, t2: 2 }],
                }),
                season({ season: '2024', games: { 7: game(1, 80, 2, 95) } }),
            ],
            currentOwnerIds: ['a', 'b'],
        });

    it('splits by season and excludes playoff games from the reg scope', () => {
        const s = seasonSplits(find(build(), 'a', 'b'), 'a', 'reg');
        expect(s.seasons).toEqual(['2024', '2025']);
        expect(s.bySeason['2025']).toMatchObject({ w: 1, l: 0, g: 1 });
        expect(s.bySeason['2024']).toMatchObject({ w: 0, l: 1, g: 1 });
        expect(s.total).toMatchObject({ w: 1, l: 1, g: 2, playoffGames: 0 });
    });

    it('includes playoff games in the all scope', () => {
        const s = seasonSplits(find(build(), 'a', 'b'), 'a', 'all');
        expect(s.total).toMatchObject({ w: 1, l: 2, g: 3, playoffGames: 1 });
        expect(s.bySeason['2025']).toMatchObject({ w: 1, l: 1, g: 2, playoffGames: 1 });
    });

    it('orients points and results to the requested owner', () => {
        const entry = find(build(), 'a', 'b');
        const forA = seasonSplits(entry, 'a', 'reg');
        const forB = seasonSplits(entry, 'b', 'reg');
        expect(forA.opponentId).toBe('b');
        expect(forB.opponentId).toBe('a');
        expect(forB.total.w).toBe(forA.total.l);
        expect(forB.total.pointsFor).toBeCloseTo(forA.total.pointsAgainst, 5);
    });

    it('matches the pair record exactly once orientation is normalized', () => {
        // The guard protecting the board and h2h summary from drifting apart. A
        // naive deep-equal against entry[scope] cannot work: that object is
        // oriented to aId, so for ownerId === bId the W/L are swapped.
        const entry = find(build(), 'a', 'b');
        ['reg', 'all'].forEach((scope) => {
            [entry.aId, entry.bId].forEach((ownerId) => {
                const flip = ownerId !== entry.aId;
                const p = entry[scope];
                expect(seasonSplits(entry, ownerId, scope).total).toEqual({
                    w: flip ? p.l : p.w,
                    l: flip ? p.w : p.l,
                    t: p.t,
                    g: p.g,
                    pointsFor: flip ? p.pointsB : p.pointsA,
                    pointsAgainst: flip ? p.pointsA : p.pointsB,
                    playoffGames: p.playoffGames,
                });
            });
        });
    });

    it('omits a season that has no counted game', () => {
        const list = buildRivalries({
            // 2026 is scheduled but unplayed — both sides scored 0.
            seasons: [
                season({ season: '2026', games: { 1: game(1, 0, 2, 0) } }),
                season({ season: '2025', games: { 3: game(1, 120, 2, 100) } }),
            ],
            currentOwnerIds: ['a', 'b'],
        });
        expect(seasonSplits(find(list, 'a', 'b'), 'a', 'reg').seasons).toEqual(['2025']);
    });

    it('returns an empty shape for a nullish entry or a stranger', () => {
        expect(seasonSplits(null, 'a').total.g).toBe(0);
        expect(seasonSplits(find(build(), 'a', 'b'), 'zzz').opponentId).toBeNull();
    });
});

describe('buildManagerSplits', () => {
    const threeSeasons = () =>
        buildRivalries({
            seasons: [
                season({
                    season: '2025',
                    rosterIdToOwnerId: { 1: 'a', 2: 'b', 3: 'c', 4: 'd' },
                    games: { 3: [...game(1, 120, 2, 100, 1), ...game(3, 110, 4, 90, 2)] },
                }),
                season({
                    season: '2024',
                    rosterIdToOwnerId: { 1: 'a', 2: 'b', 3: 'c' },
                    games: { 4: game(1, 80, 3, 95) },
                }),
            ],
            currentOwnerIds: ['a', 'b', 'c', 'd'],
        });

    it('returns one row per opponent, including pairs that never met', () => {
        const split = buildManagerSplits({ rivalries: threeSeasons(), ownerId: 'a' });
        expect(split.rows).toHaveLength(3); // 4 managers -> 3 opponents
        expect(split.rows.some((r) => r.total.g === 0)).toBe(true); // never met 'd'
    });

    it('lists only seasons the manager actually played', () => {
        const rivalries = threeSeasons();
        expect(buildManagerSplits({ rivalries, ownerId: 'a' }).seasons).toEqual(['2024', '2025']);
        // 'd' appears in 2025 only.
        expect(buildManagerSplits({ rivalries, ownerId: 'd' }).seasons).toEqual(['2025']);
    });

    it('totals equal the sum of its rows', () => {
        const split = buildManagerSplits({ rivalries: threeSeasons(), ownerId: 'a' });
        const sum = split.rows.reduce((acc, r) => acc + r.total.g, 0);
        expect(split.total.g).toBe(sum);
        expect(split.total.w + split.total.l + split.total.t).toBe(split.total.g);
    });

    it('sorts by win percentage and is deterministic', () => {
        const split = buildManagerSplits({ rivalries: threeSeasons(), ownerId: 'a' });
        const again = buildManagerSplits({ rivalries: threeSeasons(), ownerId: 'a' });
        expect(split.rows.map((r) => r.opponentId)).toEqual(again.rows.map((r) => r.opponentId));
        expect(split.rows[0].opponentId).toBe('b'); // 1-0 vs b beats 0-1 vs c
        expect(split.rows[split.rows.length - 1].opponentId).toBe('d'); // never met sorts last
    });

    it('returns an empty shape without an ownerId', () => {
        expect(buildManagerSplits({ rivalries: threeSeasons() }).rows).toEqual([]);
        expect(buildManagerSplits().rows).toEqual([]);
    });
});
