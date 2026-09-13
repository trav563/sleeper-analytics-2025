import { describe, it, expect, beforeEach } from 'vitest';
import { readAnalysisStream, readAnalysisCache, analysisCacheKey } from './analysisStream';
const stream = chunks => new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(new TextEncoder().encode(chunk)); c.close(); } });
const event = value => `data: ${JSON.stringify(value)}\n\n`;
const done = { done: true, status: 'complete', finishReason: 'stop' };
beforeEach(() => localStorage.clear());
describe('AI completion contract', () => {
    it('handles split events and multi-byte text and requires explicit success', async () => {
        const text = event({ text: 'Dynasty · ✅' }) + event(done);
        expect(await readAnalysisStream(stream([text.slice(0,7), text.slice(7,31), text.slice(31)]))).toBe('Dynasty · ✅');
    });
    it.each([
        [event({ text: 'TE A+ —' })],
        [event({ text: 'Partial' }), event({ done: true, status: 'incomplete', finishReason: 'length' })],
        [event({ text: 'Partial' }), event({ done: true })],
        [event(done)],
        ['data: {"tex'],
        [event({ error: 'Provider unavailable' })],
    ])('does not accept an incomplete/error response %#', async (...chunks) => {
        await expect(readAnalysisStream(stream(chunks))).rejects.toThrow();
    });
    it('returns partial text to the UI while refusing to mark it successful', async () => {
        let partial;
        await expect(readAnalysisStream(stream([event({ text: 'Cut short' })]), t => { partial = t; })).rejects.toThrow('cut short');
        expect(partial).toBe('Cut short');
    });
    it('versions and isolates every cache dimension', () => {
        const keys = [analysisCacheKey('1','2',1,'roster'), analysisCacheKey('9','2',1,'roster'), analysisCacheKey('1','3',1,'roster'), analysisCacheKey('1','2',2,'roster'), analysisCacheKey('1','2',1,'waivers'), analysisCacheKey('1','2',1,'roster','trade-up')];
        expect(new Set(keys).size).toBe(6); expect(keys[0]).toContain(':v2:');
    });
    it('ignores legacy, partial, and expired cached results', () => {
        const key = analysisCacheKey('1','2',1,'roster');
        for (const data of [{ text: 'legacy', timestamp: Date.now() }, { text: 'partial', status: 'incomplete', timestamp: Date.now() }, { text: 'expired', status: 'complete', timestamp: Date.now()-8*86400000 }]) {
            localStorage.setItem(key, JSON.stringify(data)); expect(readAnalysisCache(key)).toBeNull();
        }
        localStorage.setItem(key, JSON.stringify({ text: 'valid', status: 'complete', timestamp: Date.now() }));
        expect(readAnalysisCache(key).text).toBe('valid');
    });
});
