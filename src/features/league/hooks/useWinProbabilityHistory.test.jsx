import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrackWinProbability, useWinProbabilitySamples } from './useWinProbabilityHistory';

let container, root, queryClient, fetchSpy, result;

function Probe({ track, read }) {
    useTrackWinProbability(track?.leagueId, track?.enabled);
    const samples = useWinProbabilitySamples(read || { enabled: false });
    useEffect(() => { result = samples; });
    return null;
}
const render = async props => {
    await act(async () => root.render(<QueryClientProvider client={queryClient}><Probe {...props} /></QueryClientProvider>));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
};
const json = body => ({ ok: true, json: async () => body });
const posts = () => fetchSpy.mock.calls.filter(([, options]) => options?.method === 'POST');

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ tracked: true, samples: [] }));
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); queryClient.clear(); container.remove(); vi.restoreAllMocks(); });

describe('useTrackWinProbability', () => {
    it('registers a league once a day, not on every visit', async () => {
        await render({ track: { leagueId: '123', enabled: true } });
        expect(posts()).toHaveLength(1);
        expect(JSON.parse(posts()[0][1].body)).toEqual({ leagueId: '123' });
        await act(async () => root.unmount());
        root = createRoot(container);
        await render({ track: { leagueId: '123', enabled: true } });
        expect(posts()).toHaveLength(1);
        localStorage.setItem('league-win-tracked:123', String(Date.now() - 25 * 3600_000));
        await act(async () => root.unmount());
        root = createRoot(container);
        await render({ track: { leagueId: '123', enabled: true } });
        expect(posts()).toHaveLength(2);
    });
    it('retries on the next visit if registering failed', async () => {
        fetchSpy.mockResolvedValue({ ok: false, status: 503 });
        await render({ track: { leagueId: '123', enabled: true } });
        expect(localStorage.getItem('league-win-tracked:123')).toBeNull();
    });
    it('does nothing for a league that is not in its live season', async () => {
        await render({ track: { leagueId: '123', enabled: false } });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
    it('clears the old browser-recorded history', async () => {
        localStorage.setItem('league-win-history-v1-uncertainty45', '{}');
        await render({ track: { leagueId: '123', enabled: true } });
        expect(localStorage.getItem('league-win-history-v1-uncertainty45')).toBeNull();
    });
});

describe('useWinProbabilitySamples', () => {
    const read = { leagueId: '123', season: '2026', week: 9, live: true };
    it('reads the shared league week from the server', async () => {
        const samples = [{ at: 1, p: { 1: .5 } }];
        fetchSpy.mockResolvedValue(json({ samples }));
        await render({ read });
        expect(fetchSpy.mock.calls[0][0]).toBe('/api/win-probability?leagueId=123&season=2026&week=9');
        expect(result.data).toEqual(samples);
    });
    it('polls only while games are live', async () => {
        await render({ read });
        const query = () => queryClient.getQueryCache().find({ queryKey: ['winProbabilitySamples', '123', '2026', 9] });
        expect(query().options.refetchInterval).toBe(300_000);
        await render({ read: { ...read, live: false } });
        expect(query().options.refetchInterval).toBe(false);
    });
    it('reports an outage instead of an empty history', async () => {
        fetchSpy.mockResolvedValue({ ok: false, status: 503 });
        await render({ read });
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 1200)); }); // The hook's one retry.
        expect(result.error).toBeTruthy();
    });
    it('skips historical seasons', async () => {
        await render({ read: { ...read, enabled: false } });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
