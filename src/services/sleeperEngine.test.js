import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchLeagueHistory } from './sleeperEngine';
import { fetchLeague, fetchLeagueRosters } from '../utils/sleeper';

vi.mock('../utils/sleeper', () => ({
    fetchLeague: vi.fn(),
    fetchLeagueRosters: vi.fn(),
}));

const league = (id, season, prev) => ({
    league_id: id,
    season,
    name: `League ${season}`,
    draft_id: `d${id}`,
    settings: { playoff_week_start: 15 },
    previous_league_id: prev,
});

beforeEach(() => {
    vi.clearAllMocks();
    fetchLeagueRosters.mockResolvedValue([{ roster_id: 1, owner_id: 'u1' }]);
});

describe('fetchLeagueHistory', () => {
    it('walks the previous_league_id chain newest-first', async () => {
        fetchLeague
            .mockResolvedValueOnce(league('c', '2026', 'b'))
            .mockResolvedValueOnce(league('b', '2025', 'a'))
            .mockResolvedValueOnce(league('a', '2024', null));

        const { chain, truncated } = await fetchLeagueHistory('c', 'u1');
        expect(truncated).toBe(false);
        expect(chain.map((l) => l.season)).toEqual(['2026', '2025', '2024']);
        expect(chain[0].roster.owner_id).toBe('u1');
    });

    it('terminates on a cyclic previous_league_id chain', async () => {
        fetchLeague
            .mockResolvedValueOnce(league('a', '2026', 'b'))
            .mockResolvedValueOnce(league('b', '2025', 'a')); // cycle back to a

        const { chain } = await fetchLeagueHistory('a', 'u1');
        expect(chain).toHaveLength(2);
        expect(fetchLeague).toHaveBeenCalledTimes(2);
    });

    it('terminates a self-referential league', async () => {
        fetchLeague.mockResolvedValue(league('a', '2026', 'a'));
        const { chain } = await fetchLeagueHistory('a', 'u1');
        expect(chain).toHaveLength(1);
        expect(fetchLeague).toHaveBeenCalledTimes(1);
    });

    it('caps the walk depth on an endless chain', async () => {
        let n = 0;
        fetchLeague.mockImplementation(async (id) => {
            n++;
            return league(id, String(2100 - n), `next${n}`);
        });
        const { chain } = await fetchLeagueHistory('head', 'u1');
        expect(chain.length).toBeLessThanOrEqual(15);
    });

    it('throws when the first league fails to load', async () => {
        fetchLeague.mockRejectedValue(new Error('boom'));
        await expect(fetchLeagueHistory('dead', 'u1')).rejects.toThrow('boom');
    });

    it('flags truncation when a deeper hop fails, keeping the partial chain', async () => {
        fetchLeague
            .mockResolvedValueOnce(league('c', '2026', 'b'))
            .mockRejectedValueOnce(new Error('mid-chain 500'));

        const { chain, truncated } = await fetchLeagueHistory('c', 'u1');
        expect(truncated).toBe(true);
        expect(chain.map((l) => l.league_id)).toEqual(['c']);
    });
});
