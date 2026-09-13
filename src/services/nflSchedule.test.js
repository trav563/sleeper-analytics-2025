import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTeamsOnBye, getGameLiveDetails } from './nflSchedule';

// Builds an ESPN scoreboard payload in which `teams` are the ones playing.
const scoreboard = (teams) => ({
    events: teams.reduce((events, team, i) => {
        if (i % 2 === 0) events.push({ competitions: [{ competitors: [] }] });
        events[events.length - 1].competitions[0].competitors.push({
            team: { abbreviation: team },
        });
        return events;
    }, []),
});

const ok = (body) => ({ ok: true, json: async () => body });

const ALL_32 = [
    'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
    'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB',
    'TEN', 'WAS',
];

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('game context for live projections', () => {
    it('uses event-level clocks when competition status is absent and keys the requested season/week', async () => {
        const payload = scoreboard(['WSH', 'PHI']);
        payload.events[0].status = { type: { name: 'STATUS_END_PERIOD' }, period: 3, displayClock: '0:00' };
        fetch.mockResolvedValue(ok(payload));
        const games = await getGameLiveDetails(2, '2025');
        expect(games.WAS).toMatchObject({ statusName: 'STATUS_END_PERIOD', period: 3, displayClock: '0:00' });
        expect(fetch.mock.calls[0][0]).toContain('week=2&seasontype=2&dates=2025');
    });

    it('propagates failed game context so consumers can identify delayed estimates', async () => {
        fetch.mockResolvedValue({ ok: false });
        await expect(getGameLiveDetails(1, '2026')).rejects.toThrow('Game context unavailable');
    });
});

describe('getTeamsOnBye', () => {
    it('answers from the generated schedule data without touching the network', async () => {
        // 2026 week 11 is the season's heaviest bye week.
        await expect(getTeamsOnBye(11, '2026')).resolves.toEqual(
            ['ATL', 'CLE', 'GB', 'LAR', 'NE', 'SEA']
        );
        await expect(getTeamsOnBye(5, 2026)).resolves.toEqual(['CAR', 'KC']);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('distinguishes a week with no byes from an unknown season', async () => {
        // Week 1 of a covered season: genuinely nobody on bye.
        await expect(getTeamsOnBye(1, '2026')).resolves.toEqual([]);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('falls back to ESPN for a season the generated data does not cover', async () => {
        fetch.mockResolvedValue(ok(scoreboard(ALL_32.filter((t) => t !== 'GB' && t !== 'KC'))));
        await expect(getTeamsOnBye(5, '2019')).resolves.toEqual(['GB', 'KC']);
        expect(fetch).toHaveBeenCalledOnce();
    });

    it('returns null — never [] — when the ESPN fetch fails', async () => {
        // [] would mean "nobody is on bye", silently passing every lineup
        // that starts a bye-week player.
        fetch.mockRejectedValue(new Error('network down'));
        await expect(getTeamsOnBye(5, '2019')).resolves.toBeNull();

        fetch.mockResolvedValue({ ok: false, statusText: 'Service Unavailable' });
        await expect(getTeamsOnBye(5, '2019')).resolves.toBeNull();
    });

    it('returns null when the scoreboard is empty or truncated', async () => {
        // A 200 with no events would otherwise read as all 32 teams on bye.
        fetch.mockResolvedValue(ok({ events: [] }));
        await expect(getTeamsOnBye(5, '2019')).resolves.toBeNull();

        // Half a slate is a partial response, not a bye-heavy week.
        fetch.mockResolvedValue(ok(scoreboard(ALL_32.slice(0, 16))));
        await expect(getTeamsOnBye(5, '2019')).resolves.toBeNull();
    });

    it('normalizes ESPN\'s WSH to Sleeper\'s WAS', async () => {
        const playing = ALL_32.filter((t) => t !== 'WAS' && t !== 'GB');
        // WAS plays, but ESPN calls it WSH — it must not read as on bye.
        fetch.mockResolvedValue(ok(scoreboard([...playing, 'WSH'])));
        await expect(getTeamsOnBye(5, '2019')).resolves.toEqual(['GB']);
    });
});
