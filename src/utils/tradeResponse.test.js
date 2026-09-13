import { describe, expect, it } from 'vitest';
import { formatTradeResponse } from './tradeResponse';
describe('verified trade response', () => {
    it('reports no offers when screening finds none', () => {
        const text = formatTradeResponse({ mode: 'trade-up', candidates: [], valuesAvailable: true });
        expect(text).toContain('No supported deals passed');
        expect(text).not.toContain('You send:');
    });
    it('renders only verified assets and computes the actual premium', () => {
        const p = (name, value) => ({ name, position: 'WR', age: 25, tradeValue: value, ownershipStatus: 'Active' });
        const text = formatTradeResponse({ mode: 'trade-up', candidates: [{ opponentRosterId: 2, give: [p('Alpha',600),p('Beta',500)], receive: [p('Gamma',1000)], giveValue: 1100, receiveValue: 1000, myGain: 400, theirGain: 300 }], teamName: 'Mine', opponentName: () => 'Theirs', valuesAvailable: true });
        expect(text).toContain('Alpha'); expect(text).toContain('Beta'); expect(text).toContain('Gamma');
        expect(text).toContain('10.0%'); expect(text).toContain('not weekly scoring projections');
    });
});
