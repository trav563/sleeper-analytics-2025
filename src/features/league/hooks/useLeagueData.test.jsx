import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLeagueData } from './useLeagueData';

const mock = vi.hoisted(() => ({ options: [], state: null, league: null, details: {}, invalidateQueries: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mock.invalidateQueries }),
    useQuery: options => {
        mock.options.push(options);
        const name = options.queryKey[0];
        return { data: name === 'nflState' ? mock.state : name === 'league' ? mock.league : [], dataUpdatedAt: 1234 };
    },
}));
vi.mock('../../dashboard/hooks/useGameLiveDetails', () => ({ useGameLiveDetails: () => ({ details: mock.details }) }));
function Probe() { useLeagueData('test-league'); return null; }
let root, container;
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mock.state = { season: '2026', season_type: 'regular', week: 1, display_week: 1 };
    mock.league = { season: '2026', settings: { playoff_week_start: 15 } };
    mock.details = { KC: { statusName: 'STATUS_IN_PROGRESS' } };
    mock.options = [];
    mock.invalidateQueries.mockClear();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const render = () => act(async () => root.render(<Probe />));
const scores = () => mock.options.findLast(o => o.queryKey[0] === 'leagueMatchups');

describe('live fantasy score refresh', () => {
    it('polls every minute while games are active, but not in a hidden tab', async () => {
        await render();
        expect(scores().refetchInterval).toBe(60000);
        expect(scores().refetchIntervalInBackground).toBe(false);
    });
    it('fetches the final score when the last game ends before stopping polling', async () => {
        await render();
        mock.details = { KC: { statusName: 'STATUS_FINAL' } };
        await render();
        expect(scores().refetchInterval).toBe(false);
        expect(mock.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leagueMatchups', 'test-league', 1] });
    });
    it.each(['pre', 'off'])('does not poll fantasy scores during %s', async seasonType => {
        mock.state.season_type = seasonType;
        await render(); expect(scores().refetchInterval).toBe(false);
    });
    it('does not poll historical scores when current NFL games are live', async () => {
        mock.league.season = '2025';
        await render(); expect(scores().refetchInterval).toBe(false);
    });
});
