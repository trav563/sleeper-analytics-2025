import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, { MAX_TRACKED_LEAGUES } from './win-probability.js';
import { _resetDenyCache, RATE_LIMIT_PER_DAY } from './_rateLimit.js';

function fakeWorld({ flat = [], existing = null, active = 0, league = { sport: 'nfl', season: '2026', scoring_settings: { rec: 1 } }, incr = 1 } = {}) {
    const redisCalls = [];
    const fetchImpl = vi.fn(async (url, options) => {
        url = String(url);
        const ok = body => ({ ok: true, status: 200, json: async () => body });
        if (url.includes('fake.upstash.io')) {
            const commands = JSON.parse(options.body);
            redisCalls.push(...commands);
            return ok(commands.map(([name]) => {
                if (name === 'HGETALL') return { result: flat };
                if (name === 'ZSCORE') return { result: existing };
                if (name === 'ZCOUNT') return { result: active };
                if (name === 'INCR') return { result: incr };
                return { result: 1 };
            }));
        }
        if (url.includes('/state/nfl')) return ok({ season: '2026' });
        if (url.includes('/league/')) return ok(league);
        throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchImpl);
    return { fetchImpl, redisCalls };
}
const response = () => ({
    statusCode: 200, body: null, headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
});
const get = async query => { const res = response(); await handler({ method: 'GET', query, headers: {} }, res); return res; };
const post = async body => { const res = response(); await handler({ method: 'POST', body, headers: { 'x-vercel-forwarded-for': '1.2.3.4' } }, res); return res; };
const names = world => world.redisCalls.map(([name]) => name);

beforeEach(() => {
    _resetDenyCache();
    process.env.KV_REST_API_URL = 'https://fake.upstash.io';
    process.env.KV_REST_API_TOKEN = 'tok';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('GET history', () => {
    const query = { leagueId: '123', season: '2026', week: '9' };
    it('returns samples in time order with a CDN cache header', async () => {
        const world = fakeWorld({ flat: ['200', '{"1":0.6}', '100', '{"1":0.5}'] });
        const res = await get(query);
        expect(res.body.samples).toEqual([{ at: 100, p: { 1: .5 } }, { at: 200, p: { 1: .6 } }]);
        expect(res.headers['Cache-Control']).toContain('s-maxage=60');
        expect(world.redisCalls).toEqual([['HGETALL', 'wp:uncertainty45:123:2026:9']]);
    });
    it('returns an empty list for a week with no samples', async () => {
        fakeWorld();
        expect((await get(query)).body.samples).toEqual([]);
    });
    it('rejects invalid parameters without touching Redis', async () => {
        const world = fakeWorld();
        for (const change of [{ leagueId: 'abc' }, { leagueId: undefined }, { season: '26' }, { week: '0' }, { week: '19' }, { week: 'x' }]) {
            expect((await get({ ...query, ...change })).statusCode).toBe(400);
        }
        expect(world.redisCalls).toHaveLength(0);
    });
    it('does not let the CDN cache an outage', async () => {
        fakeWorld();
        delete process.env.KV_REST_API_URL;
        const res = await get(query);
        expect(res.statusCode).toBe(503);
        expect(res.headers['Cache-Control']).toBe('no-store');
    });
});

describe('POST tracking', () => {
    it('stores the league with its scoring settings and nothing about the visitor', async () => {
        const world = fakeWorld();
        const res = await post({ leagueId: '123' });
        expect(res.body).toEqual({ tracked: true });
        const add = world.redisCalls.find(([name]) => name === 'ZADD');
        expect(add[1]).toBe('wp:leagues');
        expect(add[3]).toBe('123');
        expect(world.redisCalls.find(([name]) => name === 'HSET')).toEqual(['HSET', 'wp:meta', '123', JSON.stringify({ season: '2026', scoring: { rec: 1 } })]);
        const stored = JSON.stringify(world.redisCalls.filter(([name]) => ['ZADD', 'HSET'].includes(name)));
        expect(stored).not.toContain('1.2.3.4');
    });
    it('rejects a malformed league id without any lookups', async () => {
        const world = fakeWorld();
        for (const leagueId of ['abc', 123, undefined, '1'.repeat(31)]) {
            expect((await post({ leagueId })).statusCode).toBe(400);
        }
        expect(world.fetchImpl).not.toHaveBeenCalled();
    });
    it('returns 404 for a league Sleeper does not know', async () => {
        const world = fakeWorld({ league: null });
        expect((await post({ leagueId: '123' })).statusCode).toBe(404);
        expect(names(world)).not.toContain('ZADD');
    });
    it('does not track another sport or a past season', async () => {
        for (const league of [{ sport: 'nba', season: '2026' }, { sport: 'nfl', season: '2025' }]) {
            const world = fakeWorld({ league });
            expect((await post({ leagueId: '123' })).body).toEqual({ tracked: false });
            expect(names(world)).not.toContain('ZADD');
        }
    });
    it('turns away a new league at the cap but keeps a tracked one current', async () => {
        const full = fakeWorld({ active: MAX_TRACKED_LEAGUES });
        expect((await post({ leagueId: '123' })).body).toEqual({ tracked: false });
        expect(names(full)).not.toContain('ZADD');
        const known = fakeWorld({ active: MAX_TRACKED_LEAGUES, existing: '1700000000000' });
        expect((await post({ leagueId: '123' })).body).toEqual({ tracked: true });
        expect(names(known)).toContain('ZADD');
    });
    it('uses its own rate-limit counters, separate from AI analysis', async () => {
        const world = fakeWorld();
        await post({ leagueId: '123' });
        expect(world.redisCalls.find(([name]) => name === 'INCR')[1]).toContain('rl:h:wp:1.2.3.4:');
    });
    it('stops at the rate limit before calling Sleeper', async () => {
        const world = fakeWorld({ incr: RATE_LIMIT_PER_DAY });
        expect((await post({ leagueId: '123' })).statusCode).toBe(429);
        expect(world.fetchImpl.mock.calls.filter(([url]) => String(url).includes('sleeper'))).toHaveLength(0);
    });
    it('reports an outage when Redis is unavailable', async () => {
        fakeWorld();
        delete process.env.KV_REST_API_URL;
        expect((await post({ leagueId: '123' })).statusCode).toBe(503);
    });
});

describe('methods', () => {
    it('rejects anything but GET and POST', async () => {
        const res = response();
        await handler({ method: 'DELETE', headers: {} }, res);
        expect(res.statusCode).toBe(405);
    });
});
