import { describe, it, expect } from 'vitest';
import { csvField, csvText, toCSV, csvSlug, csvFilename } from './csv';

describe('csvField', () => {
    it('passes plain values through unquoted', () => {
        expect(csvField('Saco Rams')).toBe('Saco Rams');
        expect(csvField(42)).toBe('42');
        expect(csvField(0)).toBe('0');
    });

    it('quotes a value containing a comma', () => {
        // The real case: this league has a team called "Big Socks, Big Dicker".
        expect(csvField('Big Socks, Big Dicker')).toBe('"Big Socks, Big Dicker"');
    });

    it('doubles inner quotes and wraps', () => {
        expect(csvField('He said "hi"')).toBe('"He said ""hi"""');
    });

    it('quotes newlines and carriage returns', () => {
        expect(csvField('a\nb')).toBe('"a\nb"');
        expect(csvField('a\rb')).toBe('"a\rb"');
    });

    it('renders nullish as an empty cell', () => {
        expect(csvField(null)).toBe('');
        expect(csvField(undefined)).toBe('');
    });
});

describe('csvText — formula injection guard', () => {
    it('neutralizes a leading formula character', () => {
        expect(csvText('=HYPERLINK("http://x","click")')).toBe(
            '\'=HYPERLINK("http://x","click")'
        );
        expect(csvText('+SUM(A1:A9)')).toBe("'+SUM(A1:A9)");
        expect(csvText('@foo')).toBe("'@foo");
        expect(csvText('-2+3')).toBe("'-2+3");
    });

    it('cannot be bypassed with leading whitespace', () => {
        expect(csvText('   =1+1')).toBe("'=1+1");
        expect(csvText('\t=1+1')).toBe("'=1+1");
    });

    it('leaves ordinary names untouched', () => {
        expect(csvText('Saco Rams')).toBe('Saco Rams');
        expect(csvText('Big Socks, Big Dicker')).toBe('Big Socks, Big Dicker');
        expect(csvText('Epstein’s Protégée')).toBe('Epstein’s Protégée');
    });

    it('is not applied to numbers by the caller, but is harmless on positives', () => {
        // Guard rail documenting intent: csvText is for user-authored text only.
        // A real negative number must never be routed through it.
        expect(csvText(12.5)).toBe('12.5');
        expect(csvText(-4)).toBe("'-4"); // exactly why numerics bypass this
    });

    it('renders nullish and blank as an empty cell', () => {
        expect(csvText(null)).toBe('');
        expect(csvText('   ')).toBe('');
    });
});

describe('toCSV', () => {
    it('joins cells with commas and rows with newlines', () => {
        expect(toCSV([['a', 'b'], [1, 2]])).toBe('a,b\n1,2');
    });

    it('emits a blank spacer line for an empty row', () => {
        expect(toCSV([['a'], [], ['b']])).toBe('a\n\nb');
    });

    it('escapes through csvField', () => {
        expect(toCSV([['Big Socks, Big Dicker', 1]])).toBe('"Big Socks, Big Dicker",1');
    });

    it('tolerates nullish input', () => {
        expect(toCSV(null)).toBe('');
        expect(toCSV([])).toBe('');
    });
});

describe('csvSlug', () => {
    it('collapses whitespace to underscores', () => {
        expect(csvSlug('12 Guys 1 Cup')).toBe('12_Guys_1_Cup');
    });

    it('falls back for a blank or whitespace-only name', () => {
        // The pre-existing bug this fixes: '   ' used to slug to '_'.
        expect(csvSlug('   ')).toBe('fantasy');
        expect(csvSlug('')).toBe('fantasy');
        expect(csvSlug(null)).toBe('fantasy');
        expect(csvSlug(undefined, 'team')).toBe('team');
    });

    it('strips characters that are illegal in filenames', () => {
        expect(csvSlug('A/B:C*D?E"F<G>H|I')).toBe('ABCDEFGHI');
    });
});

describe('csvFilename', () => {
    it('builds prefix_league_date.csv', () => {
        expect(csvFilename('rivalries', '12 Guys 1 Cup', new Date(2026, 7, 5))).toBe(
            'rivalries_12_Guys_1_Cup_2026-08-05.csv'
        );
    });

    it('zero-pads month and day', () => {
        expect(csvFilename('x', 'L', new Date(2026, 0, 9))).toBe('x_L_2026-01-09.csv');
    });

    it('uses the local date, so an evening export is not stamped tomorrow', () => {
        // 2026-08-05 23:30 local must stay 2026-08-05, which a UTC stamp would
        // roll forward for any timezone behind UTC.
        expect(csvFilename('x', 'L', new Date(2026, 7, 5, 23, 30))).toBe('x_L_2026-08-05.csv');
    });

    it('falls back on a blank league name', () => {
        expect(csvFilename('rivalries', '  ', new Date(2026, 7, 5))).toBe(
            'rivalries_fantasy_2026-08-05.csv'
        );
    });
});
