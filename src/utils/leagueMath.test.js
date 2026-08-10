import { describe, it, expect } from 'vitest';
import { groupMatchups, buildOwnerLookup, activeRosterIds } from './leagueMath';

describe('groupMatchups', () => {
    it('groups entries into head-to-head pairs by matchup_id', () => {
        const matchups = [
            { roster_id: 1, matchup_id: 1 },
            { roster_id: 2, matchup_id: 1 },
            { roster_id: 3, matchup_id: 2 },
            { roster_id: 4, matchup_id: 2 },
        ];
        const groups = groupMatchups(matchups);
        expect(groups).toHaveLength(2);
        expect(groups.every((g) => g.length === 2)).toBe(true);
        expect(groups[0].map((m) => m.roster_id).sort()).toEqual([1, 2]);
    });

    it('keeps a lone entry as a length-1 group (caller filters byes via length !== 2)', () => {
        const groups = groupMatchups([
            { roster_id: 1, matchup_id: 1 },
            { roster_id: 2, matchup_id: 1 },
            { roster_id: 3, matchup_id: 2 }, // odd one out
        ]);
        const sizes = groups.map((g) => g.length).sort();
        expect(sizes).toEqual([1, 2]);
    });

    it('buckets all null matchup_id entries together (parity with old inline behavior)', () => {
        // Two byes with no matchup_id collapse into one group under the null key —
        // a length-2 group the callers then skip. This matches the pre-extraction code.
        const groups = groupMatchups([
            { roster_id: 1, matchup_id: null },
            { roster_id: 2, matchup_id: null },
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0]).toHaveLength(2);
    });

    it('returns [] for empty or nullish input', () => {
        expect(groupMatchups([])).toEqual([]);
        expect(groupMatchups(null)).toEqual([]);
        expect(groupMatchups(undefined)).toEqual([]);
    });
});

describe('buildOwnerLookup', () => {
    const rosters = [
        { roster_id: 1, owner_id: 'u1' },
        { roster_id: 2, owner_id: 'u2' },
    ];
    const users = [
        { user_id: 'u1', display_name: 'Alice' },
        { user_id: 'u2', display_name: 'Bob' },
    ];

    it('maps roster_id to the owning user', () => {
        const getOwner = buildOwnerLookup(rosters, users);
        expect(getOwner(1).display_name).toBe('Alice');
        expect(getOwner(2).display_name).toBe('Bob');
    });

    it('returns undefined for an unknown roster (parity with users.find chain)', () => {
        const getOwner = buildOwnerLookup(rosters, users);
        expect(getOwner(99)).toBeUndefined();
    });

    it('returns undefined when the roster owner has no matching user', () => {
        const getOwner = buildOwnerLookup(
            [{ roster_id: 1, owner_id: 'ghost' }],
            users
        );
        expect(getOwner(1)).toBeUndefined();
    });

    it('tolerates empty or nullish inputs', () => {
        expect(buildOwnerLookup(null, null)(1)).toBeUndefined();
        expect(buildOwnerLookup([], [])(1)).toBeUndefined();
    });
});

describe('activeRosterIds', () => {
    it('excludes taxi and reserve players from roster.players', () => {
        const roster = {
            players: ['1', '2', '3', '4', '5'],
            taxi: ['4'],
            reserve: ['5'],
        };
        expect(activeRosterIds(roster)).toEqual(['1', '2', '3']);
    });

    it('returns all players when taxi/reserve are absent', () => {
        expect(activeRosterIds({ players: ['1', '2'] })).toEqual(['1', '2']);
    });

    it('tolerates nullish rosters', () => {
        expect(activeRosterIds(null)).toEqual([]);
        expect(activeRosterIds({})).toEqual([]);
    });
});
