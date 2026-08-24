import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    checkRateLimit, clientIp, _resetDenyCache,
    RATE_LIMIT_PER_DAY, RATE_LIMIT_PER_HOUR,
} from './_rateLimit.js';

/** Fake Upstash: returns the counter values a pipeline INCR would produce. */
const upstash = (hourly, daily) => vi.fn(async () => ({
    ok: true,
    json: async () => [{ result: hourly }, { result: 1 }, { result: daily }, { result: 1 }],
}));

const NOON = Date.UTC(2026, 7, 24, 12, 0, 0);

describe('checkRateLimit', () => {
    beforeEach(() => {
        _resetDenyCache();
        process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io';
        process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('allows a request under both limits', async () => {
        const r = await checkRateLimit('1.2.3.4', { fetchImpl: upstash(1, 1), now: NOON });
        expect(r.allowed).toBe(true);
        expect(r.remaining).toBe(RATE_LIMIT_PER_DAY - 1);
    });

    it('blocks exactly at the hourly limit, not one past it', async () => {
        const at = await checkRateLimit('a', { fetchImpl: upstash(RATE_LIMIT_PER_HOUR, 12), now: NOON });
        expect(at.allowed).toBe(false);
        _resetDenyCache();
        const under = await checkRateLimit('a', { fetchImpl: upstash(RATE_LIMIT_PER_HOUR - 1, 12), now: NOON });
        expect(under.allowed).toBe(true);
    });

    it('blocks exactly at the daily limit, not one past it', async () => {
        const at = await checkRateLimit('b', { fetchImpl: upstash(1, RATE_LIMIT_PER_DAY), now: NOON });
        expect(at.allowed).toBe(false);
        expect(at.remaining).toBe(0);
        _resetDenyCache();
        const under = await checkRateLimit('b', { fetchImpl: upstash(1, RATE_LIMIT_PER_DAY - 1), now: NOON });
        expect(under.allowed).toBe(true);
    });

    describe('fails closed', () => {
        it('when Upstash is not configured', async () => {
            delete process.env.UPSTASH_REDIS_REST_URL;
            const r = await checkRateLimit('c', { fetchImpl: upstash(1, 1), now: NOON });
            expect(r.allowed).toBe(false);
            expect(r.unavailable).toBe(true);
        });

        it('when Upstash returns an error status', async () => {
            const f = vi.fn(async () => ({ ok: false, status: 500 }));
            const r = await checkRateLimit('d', { fetchImpl: f, now: NOON });
            expect(r.allowed).toBe(false);
            expect(r.unavailable).toBe(true);
        });

        it('when the network throws', async () => {
            const f = vi.fn(async () => { throw new Error('ECONNRESET'); });
            const r = await checkRateLimit('e', { fetchImpl: f, now: NOON });
            expect(r.allowed).toBe(false);
            expect(r.unavailable).toBe(true);
        });
    });

    describe('deny cache', () => {
        it('short-circuits a blocked client without touching Redis again', async () => {
            const f = upstash(1, RATE_LIMIT_PER_DAY);
            const first = await checkRateLimit('abuser', { fetchImpl: f, now: NOON });
            expect(first.allowed).toBe(false);
            expect(f).toHaveBeenCalledTimes(1);

            // 50 more attempts must cost zero additional Redis commands.
            for (let i = 0; i < 50; i++) {
                const r = await checkRateLimit('abuser', { fetchImpl: f, now: NOON + i });
                expect(r.allowed).toBe(false);
            }
            expect(f).toHaveBeenCalledTimes(1);
        });

        it('expires exactly when the window rolls over', async () => {
            const blocked = upstash(RATE_LIMIT_PER_HOUR, 12);
            await checkRateLimit('h', { fetchImpl: blocked, now: NOON });
            expect(blocked).toHaveBeenCalledTimes(1);

            // Still inside the hour: cached.
            await checkRateLimit('h', { fetchImpl: blocked, now: NOON + 59 * 60 * 1000 });
            expect(blocked).toHaveBeenCalledTimes(1);

            // Next hour boundary: must re-ask Redis, and quota is fresh.
            const fresh = upstash(1, 13);
            const r = await checkRateLimit('h', { fetchImpl: fresh, now: NOON + 60 * 60 * 1000 });
            expect(r.allowed).toBe(true);
            expect(fresh).toHaveBeenCalledTimes(1);
        });

        it('never caches a denial caused by an outage', async () => {
            const down = vi.fn(async () => { throw new Error('down'); });
            await checkRateLimit('f', { fetchImpl: down, now: NOON });
            // Recovered a moment later: must not still be locked out.
            const r = await checkRateLimit('f', { fetchImpl: upstash(1, 1), now: NOON + 1000 });
            expect(r.allowed).toBe(true);
        });

        it('only ever denies — a cached client cannot gain quota', async () => {
            await checkRateLimit('g', { fetchImpl: upstash(1, RATE_LIMIT_PER_DAY), now: NOON });
            // Redis would now say "allowed", but the cache must not upgrade it.
            const r = await checkRateLimit('g', { fetchImpl: upstash(1, 1), now: NOON + 5 });
            expect(r.allowed).toBe(false);
        });
    });
});

describe('clientIp', () => {
    it('prefers the platform header', () => {
        expect(clientIp({ headers: {
            'x-vercel-forwarded-for': '9.9.9.9',
            'x-forwarded-for': '1.1.1.1, 2.2.2.2',
        } })).toBe('9.9.9.9');
    });

    it('takes the RIGHTMOST x-forwarded-for hop, since the left is spoofable', () => {
        // A caller can send its own XFF; the proxy appends. Trusting the left
        // entry would let anyone mint a fresh quota bucket per request.
        expect(clientIp({ headers: { 'x-forwarded-for': '6.6.6.6, 2.2.2.2, 3.3.3.3' } }))
            .toBe('3.3.3.3');
    });

    it('falls back to the socket, then to a constant', () => {
        expect(clientIp({ headers: {}, socket: { remoteAddress: '5.5.5.5' } })).toBe('5.5.5.5');
        expect(clientIp({ headers: {} })).toBe('unknown');
    });
});
