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
        const text = formatTradeResponse({ mode: 'trade-up', candidates: [{ opponentRosterId: 2, give: [p('Alpha',600),p('Beta',500)], receive: [p('Gamma',1000)], giveValue: 1100, receiveValue: 1000,
            me: { strategy: 'contender', nowChange: 0.12, futureChange: -0.02, gain: 0.12 }, them: { strategy: 'rebuilder', nowChange: -0.1, futureChange: 0.03, gain: 0.03 } }], teamName: 'Mine', opponentName: () => 'Theirs', valuesAvailable: true });
        expect(text).toContain('Alpha'); expect(text).toContain('Beta'); expect(text).toContain('Gamma');
        expect(text).toContain('10.0% paid by you'); expect(text).toContain('not weekly scoring projections');
        expect(text).toContain('You (Contender): starting lineup +12.0% this season, future value −2.0% (judged on this season)');
        expect(text).toContain('Theirs (Rebuilder): starting lineup −10.0% this season, future value +3.0% (judged on future value)');
    });
    it('describes picks without an age and credits the premium to the consolidating side', () => {
        const pick = { kind: 'pick', position: 'PICK', name: '2027 1st (Early)', tradeValue: 600 };
        const text = formatTradeResponse({ mode: 'sell-high', candidates: [{ opponentRosterId: 2, give: [{ name: 'Vet', position: 'RB', age: 30, tradeValue: 1000, ownershipStatus: 'Active' }], receive: [pick, { name: 'Kid', position: 'WR', age: 22, tradeValue: 550, ownershipStatus: 'Active' }],
            giveValue: 1000, receiveValue: 1150, me: { strategy: 'rebuilder', nowChange: -0.2, futureChange: 0.05, gain: 0.05 }, them: { strategy: 'contender', nowChange: 0.08, futureChange: -0.04, gain: 0.08 } }], teamName: 'Mine', opponentName: () => 'Theirs', valuesAvailable: true });
        expect(text).toContain('2027 1st (Early) (draft pick; value 600)');
        expect(text).not.toContain('age unknown');
        expect(text).toContain('15.0% paid by them');
    });
});
