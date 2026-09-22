import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import samples from '../../research/sleeper-live-projections/samples.json';
import MyMatchupHero from '../features/dashboard/components/MyMatchupHero';
import MatchupDetail from '../features/league/components/MatchupDetail';

const feeds = vi.hoisted(() => ({ projections: {}, details: {}, error: null }));
vi.mock('../features/league/hooks/useWeekProjections', () => ({
    useWeekProjections: () => ({ projections: feeds.projections, hasProjections: true, error: feeds.error }),
}));
vi.mock('../features/dashboard/hooks/useGameLiveDetails', () => ({
    useGameLiveDetails: () => ({ details: feeds.details }),
}));

function fixture() {
    feeds.error = null;
    const players = {}, projections = {}, details = {};
    const viewMatchups = samples.teams.slice(-2).map((team, index) => {
        const starters = team.players.map((p, i) => `${index}-${i}`);
        team.players.forEach((p, i) => {
            const pid = starters[i];
            players[pid] = { first_name: p.name, last_name: '', team: pid, position: p.position };
            projections[pid] = p.pregame;
            details[pid] = { statusName: p.clock === 'SOON' ? 'STATUS_SCHEDULED' : p.clock === 'FINAL' ? 'STATUS_FINAL' : 'STATUS_IN_PROGRESS', period: 3, displayClock: p.clock };
        });
        return { roster_id: index + 1, matchup_id: 1, starters, starters_points: team.players.map(p => p.actual), points: team.players.reduce((sum, p) => sum + p.actual, 0) };
    });
    feeds.projections = projections;
    feeds.details = details;
    return { league: { league_id: 'test', season: '2026', roster_positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF'] },
        players, viewMatchups, week: 1, currentNFLWeek: 1, selectedRosterId: 1, selectedUserId: 'u1',
        rosters: [{ roster_id: 1, owner_id: 'u1' }, { roster_id: 2, owner_id: 'u2' }],
        users: [{ user_id: 'u1', display_name: 'Gerry' }, { user_id: 'u2', display_name: 'Creed' }] };
}

const render = (Component, props) => renderToStaticMarkup(<MemoryRouter><Component {...props} /></MemoryRouter>);

describe('Dashboard and Matchup projection integration', () => {
    it('explains overtime in both views without discarding original forecasts', () => {
        const props = fixture();
        feeds.details['0-0'] = { statusName: 'STATUS_IN_PROGRESS', period: 5, displayClock: '06:30' };
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, props);
            expect(html).toContain('Live estimate unavailable during overtime');
            expect(html).not.toContain('131.86');
        }
        expect(render(MatchupDetail, props)).toContain('21.84');
    });
    it('reports a failed weekly projection request in both views', () => {
        const props = fixture();
        feeds.projections = {};
        feeds.error = new Error('Request failed');
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            expect(render(Component, props)).toContain('Weekly projections could not be refreshed');
        }
    });
    it('shows matching team estimates and original player projections', () => {
        const props = fixture();
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, props);
            expect(html).toContain('131.86');
            expect(html).toContain('116.84');
            expect(html).not.toContain('NaN');
        }
        const detail = render(MatchupDetail, props);
        expect(detail).toContain('21.84'); // Original forecast remains distinct from actual points.
        expect(detail).not.toContain('28.95');
    });
    it('does not reuse another week or team projection when its context is missing', () => {
        const props = fixture();
        feeds.details = {};
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, { ...props, week: 2 });
            expect(html).toContain('estimate unavailable');
            expect(html).not.toContain('131.86');
            expect(html).not.toMatch(/>100%<\//);
        }
        fixture();
        delete feeds.projections['0-0'];
        expect(render(MatchupDetail, props)).toContain('estimate unavailable');
    });
    it('settles both views on actual points once every game is final', () => {
        const props = fixture();
        for (const game of Object.values(feeds.details)) game.statusName = 'STATUS_FINAL';
        feeds.projections = {};
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, props);
            expect(html).toContain('67.46');
            expect(html).toContain('72.62');
            expect(html).not.toContain('estimate unavailable');
        }
    });
});
