import { describe, it, expect } from 'vitest';
import { computePowerRankings } from './usePowerRankings';

const rosters = [
    { roster_id: 1, owner_id: 'u1' },
    { roster_id: 2, owner_id: 'u2' },
    { roster_id: 3, owner_id: 'u3' },
    { roster_id: 4, owner_id: 'u4' },
];
const users = [
    { user_id: 'u1', display_name: 'Alice' },
    { user_id: 'u2', display_name: 'Bob' },
    { user_id: 'u3', display_name: 'Cara' },
    { user_id: 'u4', display_name: 'Dan' },
];

const week = (scores) =>
    scores.map(([roster_id, matchup_id, points]) => ({ roster_id, matchup_id, points }));

describe('computePowerRankings', () => {
    it('returns empty results for missing input', () => {
        const empty = { rankings: [], weeksPlayed: [], ranked: false };
        expect(computePowerRankings(null, rosters, users)).toEqual(empty);
        expect(computePowerRankings({}, rosters, users)).toEqual(empty);
        expect(computePowerRankings({ 1: [] }, null, users)).toEqual(empty);
    });

    it('reports ranked=false when no games have been played', () => {
        // Every composite ties at 0, so the stable sort would otherwise hand
        // back roster order dressed up as a ranking.
        const scoreless = {
            1: week([[1, 1, 0], [2, 1, 0], [3, 2, 0], [4, 2, 0]]),
        };
        const { ranked, rankings } = computePowerRankings(scoreless, rosters, users);
        expect(ranked).toBe(false);
        expect(rankings.map((r) => r.rosterId)).toEqual([1, 2, 3, 4]); // roster order, hence meaningless
    });

    it('reports ranked=true once anyone has scored', () => {
        const played = {
            1: week([[1, 1, 120], [2, 1, 90], [3, 2, 110], [4, 2, 100]]),
        };
        expect(computePowerRankings(played, rosters, users).ranked).toBe(true);
    });

    it('counts all-play losses so AP% is not universally 100%', () => {
        const seasonMatchups = {
            1: week([
                [1, 1, 130], [2, 1, 100],
                [3, 2, 120], [4, 2, 90],
            ]),
        };
        const { rankings } = computePowerRankings(seasonMatchups, rosters, users);
        const byId = Object.fromEntries(rankings.map((t) => [t.rosterId, t]));

        // Roster 1 (130) beats all three others; roster 4 (90) loses to all three.
        expect(byId[1].allPlayWins).toBe(3);
        expect(byId[1].allPlayLosses).toBe(0);
        expect(byId[4].allPlayWins).toBe(0);
        expect(byId[4].allPlayLosses).toBe(3);
        // Roster 3 (120) beats 2 and 4, loses to 1 → AP% strictly between 0 and 1.
        expect(byId[3].apWinPct).toBeCloseTo(2 / 3, 5);
    });

    it('records ties in the final record string', () => {
        const seasonMatchups = {
            1: week([
                [1, 1, 110], [2, 1, 110],
                [3, 2, 125], [4, 2, 95],
            ]),
            2: week([
                [1, 1, 140], [3, 1, 100],
                [2, 2, 105], [4, 2, 115],
            ]),
        };
        const { rankings, weeksPlayed } = computePowerRankings(seasonMatchups, rosters, users);
        const byId = Object.fromEntries(rankings.map((t) => [t.rosterId, t]));

        expect(weeksPlayed).toEqual([1, 2]);
        expect(byId[1].record).toBe('1-0-1');
        expect(byId[2].record).toBe('0-1-1');
        expect(byId[3].record).toBe('1-1');
        expect(byId[4].record).toBe('1-1');
    });

    it('does not count a 0-0 unplayed matchup as a tie', () => {
        const seasonMatchups = {
            1: week([
                [1, 1, 0], [2, 1, 0],
                [3, 2, 125], [4, 2, 95],
            ]),
        };
        const { rankings } = computePowerRankings(seasonMatchups, rosters, users);
        const byId = Object.fromEntries(rankings.map((t) => [t.rosterId, t]));
        expect(byId[1].record).toBe('0-0');
        expect(byId[2].record).toBe('0-0');
    });

    it('sorts by currentRank with the composite leader first', () => {
        const seasonMatchups = {
            1: week([
                [1, 1, 150], [2, 1, 80],
                [3, 2, 120], [4, 2, 110],
            ]),
        };
        const { rankings } = computePowerRankings(seasonMatchups, rosters, users);
        expect(rankings[0].rosterId).toBe(1);
        expect(rankings.map((t) => t.currentRank)).toEqual([1, 2, 3, 4]);
    });
});
