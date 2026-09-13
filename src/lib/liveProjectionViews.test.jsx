import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import samples from '../../research/sleeper-live-projections/samples.json';
import MyMatchupHero from '../features/dashboard/components/MyMatchupHero';
import MatchupDetail from '../features/league/components/MatchupDetail';

const feeds = vi.hoisted(() => ({ projections: {}, details: {} }));
vi.mock('../features/league/hooks/useWeekProjections', () => ({
    useWeekProjections: () => ({ projections: feeds.projections, hasProjections: true }),
}));
vi.mock('../features/dashboard/hooks/useGameLiveDetails', () => ({
    useGameLiveDetails: () => ({ details: feeds.details }),
}));

function fixture() {
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
    it('shows matching team totals and live player estimates', () => {
        const props = fixture();
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, props);
            expect(html).toContain('131.86');
            expect(html).toContain('116.84');
            expect(html).not.toContain('NaN');
        }
        const detail = render(MatchupDetail, props);
        expect(detail).toContain('28.95'); // Lamar's live estimate, not original 21.84.
        expect(detail).toContain('32.73'); // Josh Allen.
    });
    it('does not reuse another week or team projection when its context is missing', () => {
        const props = fixture();
        feeds.details = {};
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, { ...props, week: 2 });
            expect(html).toContain('Estimate unavailable');
            expect(html).not.toContain('131.86');
            expect(html).not.toMatch(/>100%<\//);
        }
        fixture();
        delete feeds.projections['0-0'];
        expect(render(MatchupDetail, props)).toContain('Estimate unavailable');
    });
    it('settles both views on actual points once every game is final', () => {
        const props = fixture();
        for (const game of Object.values(feeds.details)) game.statusName = 'STATUS_FINAL';
        feeds.projections = {};
        for (const Component of [MyMatchupHero, MatchupDetail]) {
            const html = render(Component, props);
            expect(html).toContain('67.46');
            expect(html).toContain('72.62');
            expect(html).not.toContain('Estimate unavailable');
        }
    });
});
