import { describe, it, expect } from 'vitest';
import { generateWaiverMoves } from './waiverCandidates';
const p = (age = 28) => ({ age, years_exp: 4, position: 'RB', active: true, team: 'BUF' });
const args = () => ({ league: { settings: { type: 2 } }, rosterId: 1,
    rosters: [{ roster_id: 1, players: ['a','valuable','young','rookie'], starters: [], taxi: ['taxi'], reserve: ['ir'] }, { roster_id: 2, players: ['owned'] }],
    players: { a:p(), valuable:p(), young:p(23), rookie:{ ...p(),years_exp:0 }, taxi:p(), ir:p(), owned:p(), add:p(), injured:{...p(),injury_status:'Out'} },
    snapshot: { trustworthy:true, fetchedAt:Date.now(), values: { a:100, valuable:9000, young:50, rookie:10,taxi:10,ir:10,owned:9500,add:1000,injured:9500 } } });
describe('waiver drop safeguards', () => {
    it('protects valuable/young/rookie/IR/taxi assets and verifies the add is unowned and available', () => {
        expect(generateWaiverMoves(args())).toEqual([{ drop:'a',add:'add',dropValue:100,addValue:1000 }]);
    });
    it('does not recommend drops without trustworthy values', () => {
        expect(generateWaiverMoves({ ...args(), snapshot:{ ...args().snapshot,trustworthy:false } })).toEqual([]);
    });
    it('does not drop a starter or trade down in value', () => {
        const a=args();a.rosters[0].starters=['a']; expect(generateWaiverMoves(a)).toEqual([]);
        const b=args();b.snapshot.values.add=50;expect(generateWaiverMoves(b)).toEqual([]);
    });
    it('keeps a pending rookie draft from leaking rookies into waiver adds', () => {
        const a=args();a.players.add.years_exp=0;expect(generateWaiverMoves({ ...a,rookiesLocked:true })).toEqual([]);
    });
});
