import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let rateLimitedFetch;
beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-13T20:00:00Z'));
    vi.stubGlobal('fetch', vi.fn());
    ({ rateLimitedFetch } = await import('./rateLimitedFetch'));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const limited = retryAfter => ({ status: 429, headers: new Headers(retryAfter ? { 'Retry-After': retryAfter } : {}) });

describe('provider backpressure', () => {
    it('honors long Retry-After periods across queries without additional network attempts', async () => {
        fetch.mockResolvedValueOnce(limited('300')).mockResolvedValue({ status: 200, ok: true });
        await expect(rateLimitedFetch('https://api.sleeper.app/v1/state/nfl')).rejects.toMatchObject({ status: 429 });
        for (let i = 0; i < 100; i++) {
            await expect(rateLimitedFetch(`https://api.sleeper.app/v1/league/${i}`)).rejects.toMatchObject({ status: 429 });
        }
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(300_000);
        await expect(rateLimitedFetch('https://api.sleeper.app/v1/state/nfl')).resolves.toMatchObject({ ok: true });
        expect(fetch).toHaveBeenCalledTimes(2);
    });
    it('supports HTTP-date Retry-After and isolates provider origins', async () => {
        fetch.mockResolvedValueOnce(limited('Sun, 13 Sep 2026 20:02:00 GMT')).mockResolvedValue({ status: 200 });
        await expect(rateLimitedFetch('https://api.sleeper.app/v1/state/nfl')).rejects.toMatchObject({ retryAt: Date.now() + 120_000 });
        await expect(rateLimitedFetch('https://site.api.espn.com/scoreboard')).resolves.toMatchObject({ status: 200 });
    });
    it('backs off for a minute when the provider omits Retry-After', async () => {
        fetch.mockResolvedValue(limited());
        await expect(rateLimitedFetch('https://api.sleeper.app/v1/state/nfl')).rejects.toMatchObject({ retryAt: Date.now() + 60_000 });
    });
    it('prevents nested Sleeper retries from multiplying 429 requests', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { fetchSleeper } = await import('./sleeper');
        fetch.mockResolvedValue(limited('120'));
        await expect(fetchSleeper('/state/nfl')).rejects.toMatchObject({ status: 429 });
        await expect(fetchSleeper('/league/123')).rejects.toMatchObject({ status: 429 });
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it('uses shared freshness-window URLs rather than unique per-viewer cache busters', async () => {
        const { fetchLeagueMatchups } = await import('./sleeper');
        fetch.mockResolvedValue({ status: 200, ok: true, json: async () => [] });
        await fetchLeagueMatchups('123', 1, true);
        vi.advanceTimersByTime(1000);
        await fetchLeagueMatchups('123', 1, true);
        expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
        vi.advanceTimersByTime(30_000);
        await fetchLeagueMatchups('123', 1, true);
        expect(fetch.mock.calls[2][0]).not.toBe(fetch.mock.calls[1][0]);
    });
});
