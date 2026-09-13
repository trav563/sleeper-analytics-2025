import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchValuationSnapshot } from './fantasyCalc';
import { fetchDynastyProcessValues } from './dynastyProcess';
import { buildPickLedger } from '../features/tools/utils/pickLedger';

vi.mock('./dynastyProcess', () => ({ fetchDynastyProcessValues: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('format-specific market snapshots', () => {
    it('requests exact reception scoring, league size, and QB format with source metadata', async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [
            { player: { sleeperId: '1', position: 'QB' }, value: 2400 },
            { player: { sleeperId: 'bad', position: 'RB' }, value: -5 },
        ] });
        vi.stubGlobal('fetch', fetch);
        const settings = { isDynasty: false, numQbs: 1, numTeams: 10, ppr: 1 };
        const result = await fetchValuationSnapshot(settings);
        expect(fetch.mock.calls[0][0]).toContain('isDynasty=false&numQbs=1&numTeams=10&ppr=1');
        expect(result).toMatchObject({ source: 'FantasyCalc', trustworthy: true, settings, values: { '1': 2400 } });
        expect(result.values.bad).toBeUndefined();
        expect(result.fetchedAt).toBeGreaterThan(0);
    });

    it('never substitutes dynasty prices for an unavailable redraft market', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unavailable')));
        expect(await fetchValuationSnapshot({ isDynasty: false })).toMatchObject({ trustworthy: false, values: {} });
        expect(fetchDynastyProcessValues).not.toHaveBeenCalled();
    });

    it('labels fallback scoring approximations explicitly', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unavailable')));
        fetchDynastyProcessValues.mockResolvedValue({ '1': 2400 });
        const result = await fetchValuationSnapshot({ isDynasty: true, numQbs: 2, numTeams: 14, ppr: 1 });
        expect(fetchDynastyProcessValues).toHaveBeenCalledWith(true);
        expect(result).toMatchObject({ source: 'DynastyProcess', trustworthy: true });
        expect(result.approximation).toContain('reception scoring and league size are approximate');
    });

    it('does not invent future rookie picks in redraft leagues', () => {
        expect(buildPickLedger({ season: '2026', settings: { type: 0 } }, [{ roster_id: 1 }], [])).toEqual({ allPicks: [], ledgerByRoster: {} });
    });
});
