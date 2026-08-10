import { describe, it, expect } from 'vitest';
import { parseCsv } from './dynastyProcess';

describe('parseCsv', () => {
    it('parses simple rows', () => {
        expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
    });

    it('handles quoted fields with commas and escaped quotes', () => {
        const rows = parseCsv('"player","note"\n"Smith, Jr.","said ""hi"""');
        expect(rows[1]).toEqual(['Smith, Jr.', 'said "hi"']);
    });

    it('handles CRLF line endings and trailing newline', () => {
        expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    });

    it('matches the DynastyProcess values header shape', () => {
        const rows = parseCsv('"player","pos","value_1qb","value_2qb","fp_id"\n"2026 Pick 1.01","PICK",5639,7276,NA');
        expect(rows[0]).toContain('value_2qb');
        expect(rows[1][0]).toBe('2026 Pick 1.01');
        expect(Number(rows[1][3])).toBe(7276);
    });
});
