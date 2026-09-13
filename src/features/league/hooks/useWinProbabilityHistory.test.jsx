import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecordWinProbabilityHistory } from './useWinProbabilityHistory';
import { useWeekProjections } from './useWeekProjections';
import { readProbabilityHistory, probabilityHistoryKey, subscribeProbabilityHistory, HISTORY_STORAGE_KEY } from '../../../lib/winProbabilityHistory';

const api = vi.hoisted(() => ({ projections: vi.fn() }));
vi.mock('../../../utils/sleeper', () => ({ fetchWeekProjections: (...args) => api.projections(...args) }));
let container, root, queryClient;
const now = Date.now();
const context = { league: { league_id: 'hook-test', season: '2026', scoring_settings: { pass_yd: .04 } }, week: 1,
    matchups: [{ roster_id: 1, matchup_id: 1, points: 10, starters: ['a'], starters_points: [10] },
        { roster_id: 2, matchup_id: 1, points: 5, starters: ['b'], starters_points: [5] }],
    players: { a: { position: 'QB', team: 'A' }, b: { position: 'QB', team: 'B' } },
    games: { A: { statusName: 'STATUS_HALFTIME' }, B: { statusName: 'STATUS_HALFTIME' } },
    scoresUpdatedAt: now, gamesUpdatedAt: now, enabled: true };
const key = probabilityHistoryKey({ leagueId: 'hook-test', season: '2026', week: 1, matchupId: 1, rosterIds: [1, 2] });

function Probe({ args }) {
    useRecordWinProbabilityHistory(args);
    // Simulate the existing Matchup/Dashboard subscriber to the very same query.
    useWeekProjections(args.league.season, args.week, args.league.scoring_settings);
    return null;
}
const render = async args => {
    await act(async () => root.render(<QueryClientProvider client={queryClient}><Probe args={args} /></QueryClientProvider>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
};
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    const off = subscribeProbabilityHistory(() => {});
    window.dispatchEvent(new StorageEvent('storage', { key: HISTORY_STORAGE_KEY })); off();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    api.projections.mockReset(); api.projections.mockResolvedValue({ a: { pass_yd: 500 }, b: { pass_yd: 500 } });
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); container.remove(); vi.restoreAllMocks(); });

describe('recording without additional polling', () => {
    it('shares one projection request with the page and records from existing feed updates', async () => {
        await render(context);
        expect(api.projections).toHaveBeenCalledTimes(1);
        expect(readProbabilityHistory(key)).toHaveLength(1);
        await render({ ...context, scoresUpdatedAt: now + 1000 });
        expect(api.projections).toHaveBeenCalledTimes(1);
        const query = queryClient.getQueryCache().find({ queryKey: ['weekProjections', '2026', 1] });
        expect(query.options.refetchInterval).toBeUndefined();
    });
    it('skips recording while hidden or disabled', async () => {
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
        await render(context);
        expect(readProbabilityHistory(key)).toHaveLength(0);
        vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
        await render({ ...context, enabled: false });
        expect(readProbabilityHistory(key)).toHaveLength(0);
    });
});
