import { describe, it, expect } from 'vitest';
import { ppgField, scoreStatLine, projectedPoints } from './scoring';

// Real "12 Guys 1 Cup" scoring settings (half PPR, INTs at -2, FG distance bonus).
const leagueScoring = {
    rec: 0.5, rec_yd: 0.1, rec_td: 6,
    pass_yd: 0.04, pass_td: 4, pass_int: -2, pass_2pt: 2,
    rush_yd: 0.1, rush_td: 6, rush_2pt: 2,
    fum_lost: -2,
    fgm_yds: 0.1, xpm: 1, xpmiss: -1,
    sack: 1, int: 2, def_td: 6,
};

// Real projection lines from GET /projections/nfl/regular/2026/1.
const wrLine = {
    rec: 6.05, rec_yd: 81.75, rec_td: 0.46, rush_yd: 1.01, rush_td: 0.01,
    fum_lost: 0.03, rec_2pt: 0.03, rush_2pt: 0,
    pts_ppr: 17.13, pts_half_ppr: 14.11, pts_std: 11.08,
};
const qbLine = {
    pass_yd: 256.9, pass_td: 1.79, pass_int: 0.71, pass_2pt: 0.11,
    rush_yd: 8.6, rush_td: 0.1, rush_2pt: 0.01, fum_lost: 0.21,
    pts_ppr: 20.16, pts_half_ppr: 20.16, pts_std: 20.16,
};

describe('ppgField', () => {
    it('matches the league reception setting', () => {
        expect(ppgField({ rec: 1 })).toBe('pts_ppr');
        expect(ppgField({ rec: 0.5 })).toBe('pts_half_ppr');
        expect(ppgField({ rec: 0 })).toBe('pts_std');
    });

    it('defaults to PPR when settings are unknown', () => {
        expect(ppgField(null)).toBe('pts_ppr');
        expect(ppgField({})).toBe('pts_ppr');
    });
});

describe('scoreStatLine', () => {
    it('reproduces half-PPR for a receiver in a half-PPR league', () => {
        // Sleeper's own pts_half_ppr for this line is 14.11.
        expect(scoreStatLine(wrLine, leagueScoring)).toBeCloseTo(14.11, 1);
    });

    it('diverges from the precomputed field where league scoring differs', () => {
        // 256.9*.04 + 1.79*4 + 0.71*-2 + 0.11*2 + 8.6*.1 + 0.1*6 + 0.01*2
        //   + 0.21*-2 = 17.296 — notably NOT Sleeper's pts_ppr of 20.16,
        // which is the whole point: INTs score -2 here, not -1.
        const exact = scoreStatLine(qbLine, leagueScoring);
        expect(exact).toBeCloseTo(17.3, 1);
        expect(exact).not.toBeCloseTo(qbLine.pts_ppr, 1);
    });

    it('scores kickers with a distance bonus the standard fields ignore', () => {
        const kLine = { fgm_yds: 38.5, xpm: 2.1, xpmiss: 0.1, pts_ppr: 7.88 };
        // 38.5*0.1 + 2.1*1 - 0.1*1 = 5.85
        expect(scoreStatLine(kLine, leagueScoring)).toBeCloseTo(5.85, 2);
    });

    it('returns null when nothing is scoreable so callers can fall back', () => {
        expect(scoreStatLine({ adp_dd_ppr: 10, gp: 1 }, leagueScoring)).toBeNull();
        expect(scoreStatLine(null, leagueScoring)).toBeNull();
        expect(scoreStatLine(wrLine, null)).toBeNull();
    });

    it('ignores non-numeric values', () => {
        expect(scoreStatLine({ rec: 2, team: 'KC' }, { rec: 0.5, team: 1 })).toBe(1);
    });
});

describe('projectedPoints', () => {
    it('prefers exact league scoring over the precomputed field', () => {
        expect(projectedPoints(qbLine, leagueScoring)).toBeCloseTo(17.3, 1);
    });

    it('falls back to the precomputed field when the line is unscoreable', () => {
        const opaque = { pts_half_ppr: 9.5, pts_ppr: 12, gp: 1 };
        expect(projectedPoints(opaque, { rec: 0.5 })).toBe(9.5);
    });

    it('returns 0 for a missing line', () => {
        expect(projectedPoints(null, leagueScoring)).toBe(0);
    });
});
