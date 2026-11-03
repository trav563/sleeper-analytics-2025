import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import handler, { isSamplingWindow, runSchedule, BATCH_SIZE, BATCH_STAGGER_MS } from './win-probability-tick.js';

const NOW = Date.UTC(2026, 10, 8, 18, 3, 0);
const BUCKET = Date.UTC(2026, 10, 8, 18, 0, 0); // Hour-aligned, so the TTL refresh also runs.
const live = { statusName: 'STATUS_IN_PROGRESS', period: 2, displayClock: '5:00' };
const event = (home, status, date) => ({ id: home, date, competitions: [{ status: { type: { name: status }, period: 2, displayClock: '5:00' },
    competitors: [{ team: { abbreviation: home }, homeAway: 'home', score: '7' }, { team: { abbreviation: 'NE' }, homeAway: 'away', score: '3' }] }] });
const matchups = [{ roster_id: 1, matchup_id: 1, points: 10, starters: ['a'], starters_points: [10] },
    { roster_id: 2, matchup_id: 1, points: 5, starters: ['b'], starters_points: [5] }];

/** Fake internet: Sleeper, ESPN and an Upstash that answers by command name. */
function fakeWorld({ status = 'STATUS_IN_PROGRESS', leagues = ['111'], expired = [], lastLive = null, seasonType = 'regular', cachedPlayers = true, failLeague = null } = {}) {
    const redisCalls = [];
    const meta = JSON.stringify({ season: '2026', scoring: { pass_yd: .04 } });
    const fetchImpl = vi.fn(async (url, options) => {
        url = String(url);
        const ok = body => ({ ok: true, status: 200, json: async () => body });
        if (url.includes('fake.upstash.io')) {
            const commands = JSON.parse(options.body);
            redisCalls.push(commands);
            return ok(commands.map(([name, key, second]) => {
                if (name === 'GET') return { result: key === 'wp:lastLive' ? lastLive : (cachedPlayers ? JSON.stringify({ a: { team: 'KC', position: 'QB' }, b: { team: 'KC', position: 'QB' } }) : null) };
                if (name === 'ZRANGEBYSCORE') return { result: second === '-inf' ? expired : leagues };
                if (name === 'HMGET') return { result: commands[0].slice(2).map(() => meta) };
                return { result: 1 };
            }));
        }
        if (url.includes('/state/nfl')) return ok({ season: '2026', season_type: seasonType, week: 10, display_week: 10 });
        if (url.includes('espn.com')) return ok({ events: [event('KC', status, new Date(NOW + 3600_000 * 5).toISOString())] });
        if (url.includes('/projections/')) return ok({ a: { pass_yd: 500 }, b: { pass_yd: 500 } });
        if (url.includes('/players/nfl')) return ok({ a: { team: 'KC', position: 'QB' }, b: { team: 'KC', position: 'QB' }, c: { team: null, position: 'WR' } });
        if (url.includes('/matchups/')) {
            if (failLeague && url.includes(`/league/${failLeague}/`)) return { ok: false, status: 500 };
            return ok(matchups);
        }
        throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchImpl);
    return { fetchImpl, redisCalls, commands: () => redisCalls.flat() };
}
const callsTo = (fetchImpl, part) => fetchImpl.mock.calls.filter(([url]) => String(url).includes(part));
const noWait = () => Promise.resolve();

beforeEach(() => {
    process.env.KV_REST_API_URL = 'https://fake.upstash.io';
    process.env.KV_REST_API_TOKEN = 'tok';
    process.env.CRON_SECRET = 'sekret';
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('isSamplingWindow', () => {
    const kickoffIn = ms => ({ KC: { statusName: 'STATUS_SCHEDULED', kickoff: new Date(NOW + ms).toISOString() } });
    it('samples during a live game', () => expect(isSamplingWindow({ KC: live }, NOW, 0)).toBe(true));
    it('starts 10 minutes before kickoff, not earlier', () => {
        expect(isSamplingWindow(kickoffIn(9 * 60_000), NOW, 0)).toBe(true);
        expect(isSamplingWindow(kickoffIn(11 * 60_000), NOW, 0)).toBe(false);
    });
    it('keeps sampling a kickoff that is running late', () => {
        expect(isSamplingWindow(kickoffIn(-30 * 60_000), NOW, 0)).toBe(true);
        expect(isSamplingWindow(kickoffIn(-3 * 3600_000), NOW, 0)).toBe(false);
    });
    it('continues for 20 minutes after the last live game, then stops', () => {
        const done = { KC: { statusName: 'STATUS_FINAL' } };
        expect(isSamplingWindow(done, NOW, NOW - 19 * 60_000)).toBe(true);
        expect(isSamplingWindow(done, NOW, NOW - 21 * 60_000)).toBe(false);
    });
});

describe('runSchedule', () => {
    const run = (now = NOW) => runSchedule({ now, wait: noWait });

    it('stops after one ESPN call when no games are active', async () => {
        const world = fakeWorld({ status: 'STATUS_FINAL' });
        expect(await run()).toEqual({ skipped: 'no games active' });
        expect(callsTo(world.fetchImpl, '/matchups/')).toHaveLength(0);
        expect(callsTo(world.fetchImpl, '/projections/')).toHaveLength(0);
        expect(world.commands().filter(([name]) => name === 'HSET')).toHaveLength(0);
    });
    it('does nothing outside the regular season', async () => {
        const world = fakeWorld({ seasonType: 'post' });
        expect((await run()).skipped).toBe('not regular season');
        expect(callsTo(world.fetchImpl, 'espn.com')).toHaveLength(0);
    });
    it('writes one bucketed sample per league', async () => {
        const world = fakeWorld({ leagues: ['111', '222'] });
        expect(await run()).toEqual({ leagues: 2, batches: 1, failed: 0 });
        const writes = world.commands().filter(([name]) => name === 'HSET');
        expect(writes.map(w => w[1])).toEqual(['wp:uncertainty45:111:2026:10', 'wp:uncertainty45:222:2026:10']);
        expect(writes[0][2]).toBe(String(BUCKET));
        expect(JSON.parse(writes[0][3])[1]).toBeGreaterThan(.5);
    });
    it('makes one Sleeper call per league and fetches projections once', async () => {
        const world = fakeWorld({ leagues: ['1', '2', '3'] });
        await run();
        expect(callsTo(world.fetchImpl, '/matchups/')).toHaveLength(3);
        expect(callsTo(world.fetchImpl, '/projections/')).toHaveLength(1);
        expect(callsTo(world.fetchImpl, 'espn.com')).toHaveLength(1);
    });
    it('writes to the same field on a repeated run, so samples cannot duplicate', async () => {
        const world = fakeWorld();
        await run();
        await run(NOW + 30_000);
        const fields = world.commands().filter(([name]) => name === 'HSET').map(w => w[2]);
        expect(fields).toEqual([String(BUCKET), String(BUCKET)]);
    });
    it('refreshes the TTL hourly rather than on every sample', async () => {
        const world = fakeWorld();
        await run(NOW + 5 * 60_000);
        expect(world.commands().some(([name]) => name === 'EXPIRE')).toBe(false);
        await run();
        expect(world.commands().some(([name]) => name === 'EXPIRE')).toBe(true);
    });
    it('skips one failing league without losing the others', async () => {
        const world = fakeWorld({ leagues: ['111', '222'], failLeague: '111' });
        expect(await run()).toEqual({ leagues: 2, batches: 1, failed: 1 });
        expect(world.commands().filter(([name]) => name === 'HSET').map(w => w[1])).toEqual(['wp:uncertainty45:222:2026:10']);
    });
    it('paces large runs into batches, with fresh game clocks but one projections fetch', async () => {
        const leagues = Array.from({ length: BATCH_SIZE * 2 + 1 }, (_, i) => String(i));
        const world = fakeWorld({ leagues });
        const wait = vi.fn(noWait);
        expect(await runSchedule({ now: NOW, wait })).toEqual({ leagues: leagues.length, batches: 3, failed: 0 });
        expect(wait).toHaveBeenCalledTimes(2);
        expect(wait.mock.calls[0][0]).toBeGreaterThan(BATCH_STAGGER_MS - 5000);
        expect(wait.mock.calls[1][0]).toBeGreaterThan(BATCH_STAGGER_MS * 2 - 5000);
        expect(callsTo(world.fetchImpl, '/matchups/')).toHaveLength(leagues.length);
        expect(callsTo(world.fetchImpl, 'espn.com')).toHaveLength(3);
        expect(callsTo(world.fetchImpl, '/projections/')).toHaveLength(1);
    });
    it('stays at or under 400 Sleeper calls per paced minute at the league cap', () => {
        expect(BATCH_SIZE / (BATCH_STAGGER_MS / 60_000)).toBeLessThanOrEqual(400);
    });
    it('stops before the function limit rather than being killed mid-write', async () => {
        const leagues = Array.from({ length: BATCH_SIZE + 1 }, (_, i) => String(i));
        const world = fakeWorld({ leagues });
        const clock = vi.spyOn(Date, 'now');
        clock.mockReturnValue(NOW);
        const wait = vi.fn(async () => { clock.mockReturnValue(NOW + 281_000); });
        const result = await runSchedule({ now: NOW, wait });
        expect(result.batches).toBe(1);
        expect(callsTo(world.fetchImpl, '/matchups/')).toHaveLength(BATCH_SIZE);
    });
    it('prunes leagues nobody has opened in 30 days', async () => {
        const world = fakeWorld({ expired: ['999'] });
        await run();
        expect(world.commands()).toContainEqual(['ZREM', 'wp:leagues', '999']);
        expect(world.commands()).toContainEqual(['HDEL', 'wp:meta', '999']);
    });
    it('caches a trimmed player map for a day when it is missing', async () => {
        const world = fakeWorld({ cachedPlayers: false });
        await run();
        const set = world.commands().find(([name, key]) => name === 'SET' && key === 'wp:players');
        expect(Object.keys(JSON.parse(set[2]))).toEqual(['a', 'b']);
        expect(set.slice(3)).toEqual(['EX', '86400']);
    });
    it('does not re-download players while the cache is warm', async () => {
        const world = fakeWorld();
        await run();
        expect(callsTo(world.fetchImpl, '/players/nfl')).toHaveLength(0);
    });
});

describe('daily keep-alive', () => {
    const MIDNIGHT = Date.UTC(2026, 2, 3, 0, 2, 0);
    const keepalives = world => world.commands().filter(([name, key]) => name === 'SET' && key === 'wp:keepalive');

    it('writes once a day even in the offseason, when nothing else touches Redis', async () => {
        const world = fakeWorld({ seasonType: 'off' });
        await runSchedule({ now: MIDNIGHT, wait: noWait });
        expect(keepalives(world)).toHaveLength(1);
    });
    it('does not write on the other ticks of the day', async () => {
        const world = fakeWorld({ seasonType: 'off' });
        await runSchedule({ now: MIDNIGHT + 5 * 60_000, wait: noWait });
        expect(world.redisCalls).toHaveLength(0);
    });
    it('fires on exactly one 5-minute tick per day', () => {
        const ticks = Array.from({ length: 288 }, (_, i) => MIDNIGHT - 120_000 + i * 300_000);
        expect(ticks.filter(t => t % 86400_000 < 300_000)).toHaveLength(1);
    });
});

describe('handler', () => {
    const response = () => ({ statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
    const request = authorization => ({ method: 'GET', headers: { authorization } });

    it('rejects a wrong or missing secret before doing any work', async () => {
        const world = fakeWorld();
        for (const auth of ['Bearer nope', undefined]) {
            const res = response();
            await handler(request(auth), res);
            expect(res.statusCode).toBe(401);
        }
        expect(world.fetchImpl).not.toHaveBeenCalled();
    });
    it('refuses every request when no secret is configured', async () => {
        fakeWorld();
        delete process.env.CRON_SECRET;
        const res = response();
        await handler(request('Bearer undefined'), res);
        expect(res.statusCode).toBe(401);
    });
    it('accepts the GET that Vercel cron sends and rejects other methods', async () => {
        fakeWorld({ status: 'STATUS_FINAL' });
        const ok = response();
        await handler(request('Bearer sekret'), ok);
        expect(ok.statusCode).toBe(200);
        const res = response();
        await handler({ method: 'POST', headers: { authorization: 'Bearer sekret' } }, res);
        expect(res.statusCode).toBe(405);
    });
    it('returns 500 and logs when an upstream fails', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
        const res = response();
        await handler(request('Bearer sekret'), res);
        expect(res.statusCode).toBe(500);
    });
});
