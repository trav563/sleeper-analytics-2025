import { describe, it, expect } from 'vitest';
import { classifyInjury } from './nflData';

// Field combinations taken verbatim from a live GET /players/nfl pull.
// Sleeper splits availability across two fields with different vocabularies:
//   injury_status: Questionable | Doubtful | Out | IR | PUP | Sus | NA | COV | DNR
//   status:        Active | Inactive | Injured Reserve |
//                  Physically Unable to Perform | Non Football Injury | Practice Squad
describe('classifyInjury', () => {
    it('flags an unresolved designation on an active player as POTENTIAL', () => {
        // Josh Jacobs (5850) — on the report with a groin injury, no game
        // designation assigned yet. Used to classify OK and render green.
        expect(classifyInjury({ status: 'Active', injury_status: 'NA' })).toBe('POTENTIAL');
        expect(classifyInjury({ status: 'Active', injury_status: 'DNR' })).toBe('POTENTIAL');
        expect(classifyInjury({ status: 'Active', injury_status: 'COV' })).toBe('POTENTIAL');
    });

    it('escalates an unresolved designation to INCOMPLETE when the player is not active', () => {
        expect(classifyInjury({ status: 'Inactive', injury_status: 'NA' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Practice Squad', injury_status: 'NA' })).toBe('INCOMPLETE');
    });

    it('treats out designations as INCOMPLETE', () => {
        expect(classifyInjury({ status: 'Active', injury_status: 'Out' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Active', injury_status: 'IR' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Active', injury_status: 'PUP' })).toBe('INCOMPLETE');
        // Sleeper abbreviates suspension as "Sus", never "Suspended".
        expect(classifyInjury({ status: 'Active', injury_status: 'Sus' })).toBe('INCOMPLETE');
    });

    it('reads the roster status field, which uses long-form values', () => {
        // These never matched before: the old code tested `status` against
        // injury_status abbreviations ("ir", "pup", "suspension").
        expect(classifyInjury({ status: 'Injured Reserve' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Physically Unable to Perform' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Non Football Injury' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Practice Squad' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'Inactive' })).toBe('INCOMPLETE');
    });

    it('treats game-time decisions as POTENTIAL', () => {
        expect(classifyInjury({ status: 'Active', injury_status: 'Questionable' })).toBe('POTENTIAL');
        expect(classifyInjury({ status: 'Active', injury_status: 'Doubtful' })).toBe('POTENTIAL');
    });

    it('returns OK for healthy players and missing data', () => {
        expect(classifyInjury({ status: 'Active', injury_status: null })).toBe('OK');
        expect(classifyInjury({ status: 'Active' })).toBe('OK');
        expect(classifyInjury({})).toBe('OK');
        expect(classifyInjury(null)).toBe('OK');
        expect(classifyInjury(undefined)).toBe('OK');
    });

    it('is case- and whitespace-insensitive', () => {
        expect(classifyInjury({ injury_status: '  ir  ' })).toBe('INCOMPLETE');
        expect(classifyInjury({ status: 'INJURED RESERVE' })).toBe('INCOMPLETE');
    });
});
