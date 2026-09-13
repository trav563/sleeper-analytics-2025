import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useAnalyzeTeam } from './useAnalyzeTeam';
import { analysisCacheKey } from '../../../utils/analysisStream';
let root, host, hook, requests;
function Probe(props) { const value = useAnalyzeTeam(props); useEffect(() => { hook = value; }); return <p>{value.analysis}</p>; }
const props = { leagueId: '1', userId: '2', week: 1, analysisType: 'roster' };
function response(text, complete = true) { return { ok: true, body: new ReadableStream({ start(c) {
    c.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));
    if (complete) c.enqueue(new TextEncoder().encode('data: {"done":true,"status":"complete","finishReason":"stop"}\n\n'));
    c.close();
} }) }; }
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear(); requests = [];
    vi.stubGlobal('fetch', vi.fn((url, options) => new Promise(resolve => requests.push({ options, resolve }))));
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
    act(() => root.render(<Probe {...props} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
describe('AI request isolation', () => {
    it.each([{ week: 2 }, { userId: '3' }, { leagueId: '4' }, { analysisType: 'waivers' }])('isolates rapid selection changes %j', async change => {
        let older, newer;
        act(() => { older = hook.analyze(); });
        act(() => root.render(<Probe {...props} {...change} />));
        act(() => { newer = hook.analyze(); });
        expect(requests[0].options.signal.aborted).toBe(true);
        await act(async () => { requests[1].resolve(response('New selection')); await newer; });
        await act(async () => { requests[0].resolve(response('Old selection')); await older; });
        expect(hook.analysis).toBe('New selection');
        expect(localStorage.getItem(analysisCacheKey('1','2',1,'roster'))).toBeNull();
    });
    it('isolates trade mode and lets the user explicitly return to cached grades', async () => {
        const key = analysisCacheKey('1','2',1,'roster');
        localStorage.setItem(key, JSON.stringify({ status: 'complete', text: 'Grades', timestamp: Date.now() }));
        let trade;
        act(() => { trade = hook.analyze({ constraint: 'trade-up' }); });
        await act(async () => { await hook.analyze(); });
        await act(async () => { requests[0].resolve(response('Old trade')); await trade; });
        expect(hook.analysis).toBe('Grades'); expect(hook.activeConstraint).toBeNull();
        expect(requests[0].options.signal.aborted).toBe(true);
    });
    it('keeps the old result visible during refresh, flags a cutoff, and never overwrites a successful cache', async () => {
        const key = analysisCacheKey('1','2',1,'roster');
        localStorage.setItem(key, JSON.stringify({ status: 'complete', text: 'Previous result', timestamp: Date.now() }));
        let pending;
        act(() => { pending = hook.analyze({ force: true }); });
        expect(hook.analysis).toBe('Previous result'); expect(hook.loading).toBe(true);
        await act(async () => { requests[0].resolve(response('Partial',false)); await pending; });
        expect(hook.incomplete).toBe(true); expect(hook.error).toContain('cut short');
        expect(JSON.parse(localStorage.getItem(key)).text).toBe('Previous result');
    });
    it('reports provider failure and permits retry', async () => {
        let pending;
        act(() => { pending = hook.analyze(); });
        await act(async () => { requests[0].resolve({ ok: false, status: 503, json: async () => ({ error: 'Unavailable' }) }); await pending; });
        expect(hook.error).toBe('Unavailable'); expect(hook.loading).toBe(false);
        act(() => { pending = hook.analyze({ force: true }); });
        await act(async () => { requests[1].resolve(response('Recovered')); await pending; });
        expect(hook.analysis).toBe('Recovered'); expect(hook.incomplete).toBe(false);
    });
});
