import { describe, it, expect } from 'vitest';
import { redactAnalyticsUrl } from './App';

describe('redactAnalyticsUrl', () => {
    it('strips the league id from analytics paths', () => {
        expect(redactAnalyticsUrl('/league/1312087088669151232/tools'))
            .toBe('/league/[leagueId]/tools');
    });

    it('strips roster, player and week ids', () => {
        expect(redactAnalyticsUrl('/league/123/team/6')).toBe('/league/[leagueId]/team/[rosterId]');
        expect(redactAnalyticsUrl('/league/123/player/4881')).toBe('/league/[leagueId]/player/[playerId]');
        expect(redactAnalyticsUrl('/league/123/matchup/7')).toBe('/league/[leagueId]/matchup/[week]');
    });

    it('handles absolute URLs and drops query strings', () => {
        expect(redactAnalyticsUrl('https://leagueanalysis.app/league/999/tools?u=abc'))
            .toBe('https://leagueanalysis.app/league/[leagueId]/tools');
    });

    it('leaves id-free paths alone', () => {
        expect(redactAnalyticsUrl('/')).toBe('/');
        expect(redactAnalyticsUrl('/league/[leagueId]/tools')).toBe('/league/[leagueId]/tools');
    });

    it('never throws on junk input', () => {
        expect(redactAnalyticsUrl('')).toBe('');
        expect(redactAnalyticsUrl(undefined)).toBe(undefined);
    });

    it('leaves no bare digit id anywhere in a fully-loaded path', () => {
        const out = redactAnalyticsUrl('/league/1312087088669151232/player/12507');
        expect(out).not.toMatch(/\d{4,}/);
    });
});
