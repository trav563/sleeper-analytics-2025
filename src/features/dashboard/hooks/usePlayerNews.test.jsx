import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useQuery } from '@tanstack/react-query';
import { usePlayerNews } from './usePlayerNews';

vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));

let root;
let host;
const roster = { players: ['p1'] };
const players = { p1: { player_id: 'p1', first_name: 'Alex', last_name: 'Runner', position: 'RB', injury_status: 'Out' } };

function Probe() {
    const result = usePlayerNews(roster, players);
    return <output data-loading={String(result.isLoading)} data-error={result.error?.message || ''}
        data-news={result.personalNews.length} data-headlines={result.topHeadlines.length}
        data-retry={String(typeof result.retry === 'function')} />;
}

beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.resetAllMocks();
});

it('stops loading and exposes recovery when the headline request fails', () => {
    const retry = vi.fn();
    useQuery.mockImplementation(({ queryKey }) => queryKey[0] === 'nflNews'
        ? { data: undefined, isLoading: false, error: new Error('offline'), refetch: retry }
        : { data: [] });
    act(() => root.render(<Probe />));
    expect(host.querySelector('output').dataset).toMatchObject({ loading: 'false', error: 'offline', retry: 'true' });
    expect(retry).not.toHaveBeenCalled();
});

it('does not invent fresh news from an existing injury status', () => {
    useQuery.mockImplementation(({ queryKey }) => queryKey[0] === 'nflNews'
        ? { data: [], isLoading: false, error: null, refetch: vi.fn() }
        : { data: [] });
    act(() => root.render(<Probe />));
    expect(host.querySelector('output').dataset).toMatchObject({ news: '0', headlines: '0' });
});
