import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
vi.mock('ai', () => ({ streamText: vi.fn() }));
vi.mock('./_rateLimit.js', () => ({ checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9 })), clientIp: () => 'test' }));
vi.mock('../src/utils/fantasyCalc.js', () => ({ fetchValuationSnapshot: vi.fn(async () => ({ values: {}, source: 'Unavailable', trustworthy: false, fetchedAt: Date.now() })) }));
vi.mock('rss-parser', () => ({ default: class { async parseURL() { return { items: [] }; } } }));
import { streamText } from 'ai';
import handler, { buildPrompt } from './analyze-team';
const roster = { roster_id: 1, owner_id: '2', players: ['a'], starters: ['a'], taxi: ['taxi'], reserve: ['ir'], settings: {} };
const other = { roster_id: 2, owner_id: '3', players: ['b'], starters: ['b'], taxi: ['otaxi'], reserve: ['oir'], settings: {} };
const league = { league_id: '1', season: '2026', settings: { type: 2 }, scoring_settings: { rec: 1 }, roster_positions: ['QB','BN'] };
const players = Object.fromEntries(['a','b','taxi','ir','otaxi','oir'].map(id => [id, { first_name: id, last_name: 'Player', position: 'QB', age: 23, team: 'BUF', active: true }]));
const data = { league, userRoster: roster, opponentRoster: other, players, users: [], rosters: [roster,other], freeAgents: [], matchups: [], transactions: [], week: 1,
    currentStats: {}, prevStats: {}, weekProjections: {}, allMatchupHistory: {}, pprField: 'pts_ppr', playerNews: [], weekContext: {} };

describe('dedicated analysis instructions', () => {
    it('uses completed records throughout the prompt during live Week 1', () => {
        const liveOther = { ...other, settings: { wins: 1, losses: 0 } };
        const context = { ...data, opponentRoster: liveOther, rosters: [roster, liveOther] };
        const prompt = buildPrompt(context, 'roster');
        expect(prompt).toContain('Record: 0-0, completed weeks only');
        expect(prompt).not.toContain('(1-0)');
        expect(buildPrompt(context, 'playoff')).not.toContain('This is PRESEASON');
        expect(buildPrompt(context, 'roster', 'trade-up')).toContain('(0-0, completed weeks only)');
    });
    it('keeps grades and both trade modes separate', () => {
        const grades = buildPrompt(data,'roster');
        const trades = buildPrompt(data,'roster','trade-up');
        const sell = buildPrompt(data,'roster','sell-high');
        expect(grades).toContain('## Roster Grade');
        expect(trades).toContain('## Trade-up Ideas'); expect(trades).not.toContain('## Roster Grade');
        expect(sell).toContain('## Sell-high Candidates'); expect(sell).not.toContain('## Roster Grade');
        expect(trades).not.toContain('CONSTRAINT: Suggest 2-3');
        expect(sell).toContain('snapshot cannot establish a historical peak');
        for (const prompt of [trades, sell]) {
            expect(prompt).not.toContain('VERIFIED LINEUP');
            expect(prompt).not.toContain('VERIFIED WAIVER MOVES');
            expect(prompt).not.toContain('PRODUCTION GRADING GUIDE');
            expect(prompt).toContain('Empty candidates mean no supported deals');
        }
    });
    it('supplies dynasty designation, complete ownership, and safe fallbacks', () => {
        const prompt = buildPrompt(data,'roster');
        expect(prompt).toContain('DYNASTY / KEEPER'); expect(prompt).toContain('Full PPR');
        for (const name of ['taxi Player','ir Player','otaxi Player','oir Player']) expect(prompt).toContain(name);
        expect(prompt).toContain('missing = unknown'); expect(prompt).toContain('no supported trade found');
        expect(prompt).toContain('Do not recommend dropping IR/taxi players');
        expect(prompt).toContain('Unranked.');
    });
});

function sink() {
    return { headersSent: false, events: '', code: 200, setHeader: vi.fn(), write(text) { this.headersSent = true; this.events += text; }, end: vi.fn(),
        status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}
function model(finishReason = 'stop', late) {
    return { finishReason: Promise.resolve(finishReason), textStream: { async *[Symbol.asyncIterator]() { yield 'Verified response'; if (late) throw new Error('Provider interrupted'); } } };
}
beforeEach(() => {
    vi.stubEnv('AI_GATEWAY_API_KEY','test-only');
    vi.spyOn(console,'error').mockImplementation(() => {}); vi.spyOn(console,'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async url => {
        const u = String(url);
        const body = u.endsWith('/rosters') ? [roster,other] : u.endsWith('/users') ? [] : u.endsWith('/players/nfl') ? players
            : u.endsWith('/state/nfl') ? { season: '2026', season_type: 'regular', week: 1 }
                : /\/league\/1$/.test(u) ? league : /transactions|drafts|matchups/.test(u) ? [] : {};
        return { ok: true, json: async () => body };
    }));
    streamText.mockReset();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('provider completion propagation', () => {
    const req = () => ({ method: 'POST', body: { leagueId: '1', userId: '2', week: 1, analysisType: 'roster' } });
    it.each(['stop','length','content-filter'])('propagates %s accurately', async reason => {
        streamText.mockReturnValue(model(reason)); const res = sink(); await handler(req(),res);
        expect(res.events).toContain(`"finishReason":"${reason}"`);
        expect(res.events).toContain(`"status":"${reason === 'stop' ? 'complete' : 'incomplete'}"`);
        expect(res.end).toHaveBeenCalled();
    });
    it('uses fallback before streaming when the primary is unavailable', async () => {
        streamText.mockImplementationOnce(() => { throw new Error('503 UNAVAILABLE'); }).mockReturnValue(model());
        const res = sink(); await handler(req(),res);
        expect(streamText).toHaveBeenCalledTimes(2); expect(res.events).toContain('"status":"complete"');
    });
    it('never emits successful completion after a midstream failure', async () => {
        streamText.mockReturnValue(model('error',true)); const res = sink(); await handler(req(),res);
        expect(res.events).toContain('"error"'); expect(res.events).not.toContain('"status":"complete"');
    });
    it('returns actionable HTTP failure when both providers fail', async () => {
        streamText.mockImplementation(() => { throw new Error('503 UNAVAILABLE'); }); const res = sink(); await handler(req(),res);
        expect(res.code).toBe(503); expect(res.body.error).toContain('unavailable'); expect(res.events).toBe('');
    });
});
