import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import LeaguePulse from './LeaguePulse';
import MyMatchupHero from './MyMatchupHero';
import StandingsStrip from './StandingsStrip';
import QuickStats4 from './QuickStats4';
import { NewsItem } from './RosterNews';
import LineupToday from './LineupToday';
vi.mock('../hooks/useGameLiveDetails', () => ({ useGameLiveDetails: () => ({ details: {} }) }));
vi.mock('../../league/hooks/useWeekProjections', () => ({ useWeekProjections: () => ({ projections: {} }) }));
vi.mock('../../tools/hooks/useMarketValues', () => ({ useMarketValues: () => ({ data: {} }) }));
vi.mock('../hooks/usePlayoffOdds', () => ({ usePlayoffOdds: () => ({ odds: {}, loading: false }) }));
const props = {
    league: { league_id: '123', season: '2026' }, week: 2, completedWeek: 3,
    viewMatchups: [{ roster_id: 1, matchup_id: 1, starters: ['a'], points: 162 }, { roster_id: 2, matchup_id: 1, starters: ['b'], points: 105 }],
    rosters: [{ roster_id: 1, owner_id: 'u1' }, { roster_id: 2, owner_id: 'u2' }],
    users: [{ user_id: 'u1', display_name: 'Alpha' }, { user_id: 'u2', display_name: 'Beta' }],
    selectedUserId: 'u2', selectedRosterId: 2, players: {}, seasonMatchups: {},
};
const render = (Component, extra = {}) => renderToStaticMarkup(<MemoryRouter><Component {...props} {...extra} /></MemoryRouter>);
describe('dashboard reliability', () => {
    it('links the selected team and week, labels guest viewing honestly, and avoids nested controls', () => {
        const hero = render(MyMatchupHero);
        expect(hero).toContain('/matchup/2?roster=2');
        expect(hero).toContain('Viewing');
        expect(hero).not.toContain('· You');
        expect(hero).not.toContain('role="button"');
        expect(hero).toContain('Matchup result: Loss');
        expect(hero).not.toContain('Est. Win');
        const pulse = render(LeaguePulse);
        expect(pulse).toContain('Final');
        expect(pulse).not.toContain('Soon');
        expect(pulse).toContain('/matchup/2?roster=1');
        expect(pulse).not.toContain('role="button"');
    });
    it('keeps loading and failed rankings distinct from no completed games', () => {
        const loading = render(StandingsStrip, { loading: true });
        expect(loading).toContain('Calculating rankings');
        expect(loading).not.toContain('once games are played');
        const error = render(StandingsStrip, { error: 'failed' });
        expect(error).toContain('Refresh data');
        expect(error).not.toContain('once games are played');
    });
    it('does not show zero margins or no-games conclusions while records load', () => {
        const html = render(QuickStats4, { recordsLoading: true });
        expect(html).toContain('calculating…');
        expect(html).not.toContain('no completed weeks');
        expect(html).not.toContain('not ranked yet');
        expect(html).not.toContain('+0');
    });
    it('does not turn news without a valid destination into a fake link', () => {
        for (const link of [null, '#', 'javascript:alert(1)']) {
            expect(renderToStaticMarkup(<NewsItem item={{ title: 'Injury update', link, type: 'alert' }} />)).not.toContain('<a ');
        }
        expect(renderToStaticMarkup(<NewsItem item={{ title: 'News', link: 'https://example.com/story' }} />)).toContain('href="https://example.com/story"');
        expect(renderToStaticMarkup(<NewsItem item={{ title: 'Injury update', type: 'alert' }} />)).toContain('Roster status');
    });
    it('names the selected week instead of implying a historical lineup is current', () => {
        const html = renderToStaticMarkup(<MemoryRouter><LineupToday
            league={props.league} week={2} roster={props.rosters[0]} players={{}}
            viewMatchups={props.viewMatchups} slotLabels={['QB']} />
        </MemoryRouter>);
        expect(html).toContain('Week 2 lineup');
        expect(html).not.toContain("Today's Lineup");
    });
});
