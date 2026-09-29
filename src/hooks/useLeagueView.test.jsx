import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, Link, useParams } from 'react-router-dom';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { SleeperProvider, useSleeper } from '../context/SleeperContext';
import { useLeagueView, resolveViewedRoster, validWeek } from './useLeagueView';
vi.mock('../utils/sleeper', () => ({ fetchNFLState: async () => ({ season: '2026' }), fetchUser: vi.fn(), fetchUserLeagues: vi.fn() }));
const rosters = [{ roster_id: 1, owner_id: 'first' }, { roster_id: 2, owner_id: 'second', co_owners: ['coowner'] }];
let host, root, week = 4;
function Page() {
    const { leagueId } = useParams();
    const { user, signOut } = useSleeper();
    const view = useLeagueView(leagueId, rosters, user, week);
    return <><output>{leagueId}:{view.roster.roster_id}:{view.week}</output>
        <button onClick={() => { view.selectRoster(2); view.selectWeek(2); }}>Select</button>
        <button onClick={signOut}>Forget</button>
        <Link to={`/league/${leagueId}/matchup`}>Matchup</Link>
        <Link to="/league/b">Other league</Link><Link to="/league/a">Dashboard</Link></>;
}
const app = () => <SleeperProvider><MemoryRouter initialEntries={['/league/a']}><Routes><Route path="/league/:leagueId/*" element={<Page />} /></Routes></MemoryRouter></SleeperProvider>;
const click = async text => act(async () => [...host.querySelectorAll('a,button')].find(el => el.textContent === text).click());
beforeEach(async () => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; localStorage.clear(); week = 4; host = document.createElement('div'); document.body.append(host); root = createRoot(host); await act(async () => root.render(app())); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
it('retains team/week across routes, isolates leagues and clears them on sign out', async () => {
    await click('Select'); await click('Matchup'); expect(host.querySelector('output').textContent).toBe('a:2:2');
    await click('Other league'); expect(host.querySelector('output').textContent).toBe('b:1:4');
    await click('Dashboard'); expect(host.querySelector('output').textContent).toBe('a:2:2');
    await click('Forget'); expect(host.querySelector('output').textContent).toBe('a:1:4');
});
it('returns to the current week on rollover while retaining the selected team', async () => {
    await click('Select'); week = 5; await act(async () => root.render(app()));
    expect(host.querySelector('output').textContent).toBe('a:2:5');
});
it('respects explicit selection and co-ownership, rejecting invalid weeks', () => {
    expect(resolveViewedRoster(rosters, null, 'coowner').roster_id).toBe(2);
    expect(resolveViewedRoster(rosters, 1, 'coowner').roster_id).toBe(1);
    expect(resolveViewedRoster(rosters, 999, 'second').roster_id).toBe(2);
    for (const value of [null, '', 0, 19, -1, 1.5, 'no']) expect(validWeek(value)).toBe(false);
});
