import { describe, it, expect } from 'vitest';
import { scoringSlots, lineupIsComplete } from './lineupAssignment';

const SLOTS = ['QB', 'RB', 'RB', 'WR', 'FLEX', 'BN', 'BN'];
const filled = ['qb1', 'rb1', 'rb2', 'wr1', 'wr2'];

describe('scoringSlots', () => {
    it('keeps only the slots that are played', () => {
        expect(scoringSlots(SLOTS)).toEqual(['QB', 'RB', 'RB', 'WR', 'FLEX']);
        expect(scoringSlots(['QB', 'BN', 'IR', 'TAXI'])).toEqual(['QB']);
        expect(scoringSlots(undefined)).toEqual([]);
    });
});

describe('lineupIsComplete', () => {
    it('accepts a lineup with a player in every slot', () => {
        expect(lineupIsComplete({ starters: filled }, SLOTS)).toBe(true);
    });

    it('rejects a lineup Sleeper padded with empty slots', () => {
        // The real shape of an abandoned week: one player, eight "0" placeholders.
        expect(lineupIsComplete({ starters: ['0', '0', '0', '0', 'rb1'] }, SLOTS)).toBe(false);
        // A single gap is still a gap.
        expect(lineupIsComplete({ starters: ['qb1', 'rb1', 'rb2', 'wr1', '0'] }, SLOTS)).toBe(false);
    });

    it('counts a full lineup that simply scored nothing as complete', () => {
        // Every slot filled; the players just had byes or were inactive. That is
        // a bad week, not a forfeit, and it belongs in the record book.
        expect(lineupIsComplete({ starters: filled, starters_points: [0, 0, 0, 0, 0] }, SLOTS)).toBe(true);
    });

    it('rejects a starters list shorter than the lineup', () => {
        expect(lineupIsComplete({ starters: ['qb1', 'rb1'] }, SLOTS)).toBe(false);
    });

    it('falls back to the empty-slot check when the slot list is unknown', () => {
        expect(lineupIsComplete({ starters: filled })).toBe(true);
        expect(lineupIsComplete({ starters: ['qb1', '0'] })).toBe(false);
    });

    it('rejects a missing or empty starters list', () => {
        expect(lineupIsComplete({}, SLOTS)).toBe(false);
        expect(lineupIsComplete({ starters: [] }, SLOTS)).toBe(false);
        expect(lineupIsComplete(undefined, SLOTS)).toBe(false);
    });
});
