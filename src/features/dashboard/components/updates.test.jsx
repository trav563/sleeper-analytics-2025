import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { act, cloneElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import LineupToday from './LineupToday';
import PlayerDetail from './PlayerDetail';
import RosterDetail from '../../league/components/RosterDetail';
import InjuryReport from './InjuryReport';

const feeds = vi.hoisted(() => ({ projections: {}, details: {}, logs: {}, weeks: {}, matchups: [] }));
vi.mock('../../league/hooks/useWeekProjections', () => ({ useWeekProjections: () => ({ projectionFor: id => feeds.projections[id] ?? null, projections: feeds.projections }) }));
vi.mock('../hooks/useGameLiveDetails', () => ({ useGameLiveDetails: () => ({ details: feeds.details }) }));
vi.mock('../../league/hooks/useLeagueData', () => ({ useLeagueData: () => ({ matchups: feeds.matchups }) }));
vi.mock('../../analytics/hooks/useSeasonMatchups', () => ({ useSeasonMatchups: () => ({ seasonMatchups: feeds.weeks, completedWeek: 2 }) }));
vi.mock('../../stats/hooks/useCompletedPlayerStats', () => ({ useCompletedPlayerStats: () => ({ logs: feeds.logs }) }));
vi.mock('../../analytics/hooks/useDefenseRanks', () => ({ useDefenseRanks: () => ({}) }));
vi.mock('../../analytics/hooks/usePowerRankings', () => ({ usePowerRankings: () => ({ rankings: [], ranked: false }) }));
vi.mock('../hooks/useGameWeather', () => ({ useGameWeather: () => ({ weather: {} }) }));
vi.mock('../hooks/usePlayerNews', () => ({ usePlayerNews: () => ({ personalNews: [], isLoading: false }) }));
vi.mock('recharts', async importOriginal => ({ ...(await importOriginal()), ResponsiveContainer: ({children}) => cloneElement(children, {width:320,height:240}) }));

let host, root;
const player = {player_id:'a',first_name:'Alice',last_name:'Runner',team:'BAL',position:'RB',status:'Active'};
const players = {a:player,b:{...player,player_id:'b',first_name:'Bob',team:'KC'}};
const roster = {roster_id:1,owner_id:'u',players:['a','b'],starters:['b']};
const league = {league_id:'test',season:'2026',roster_positions:['RB'],scoring_settings:{rush_yd:.1}};
const props = {league,players,rosters:[roster],roster,users:[{user_id:'u',display_name:'Owner'}],state:{season:'2026',season_type:'regular',week:3,display_week:2},currentWeek:2,seasonMatchups:{}};
beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    feeds.projections={a:0,b:15}; feeds.details={BAL:{statusName:'STATUS_SCHEDULED'},KC:{statusName:'STATUS_FINAL'}};
    feeds.logs={a:[{week:1,points:10}]}; feeds.weeks={}; feeds.matchups=[];
    host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(() => {act(()=>root.unmount());host.remove();vi.restoreAllMocks();});
const render = component => act(()=>root.render(<MemoryRouter>{component}</MemoryRouter>));

it('uses historical starters and slot scores rather than the current roster', () => {
    feeds.details.BAL.statusName='STATUS_FINAL';
    render(<LineupToday {...props} week={1} slotLabels={['RB']} viewMatchups={[{roster_id:1,starters:['a'],starters_points:[-2],players_points:{a:99}}]} />);
    expect(host.textContent).toContain('Runner'); expect(host.textContent).toContain('-2.0');
    expect(host.textContent).not.toContain('99.0'); expect(host.querySelector('img').src).toContain('/a.jpg');
});
it('labels a real zero pregame projection and leaves unknown forecasts unavailable', () => {
    const lineup = <LineupToday {...props} week={2} slotLabels={['RB']} viewMatchups={[{roster_id:1,starters:['a']}]} />;
    render(lineup);expect(host.textContent).toContain('Proj0.0');
    feeds.projections={};render(<LineupToday {...props} week={2} slotLabels={['RB']} viewMatchups={[{roster_id:1,starters:['a']}]} />);
    expect(host.textContent).toContain('Proj—');
});
it('does not use current roster starters for a missing historical lineup', () => {
    render(<LineupToday {...props} week={1} slotLabels={['RB']} viewMatchups={[]} />);
    expect(host.textContent).toContain('Lineup unavailable');expect(host.querySelector('img')).toBeNull();
});
it.each(['starters','bench','taxi','reserve'])('links to and focuses the owning %s row', section => {
    const selected = {...roster,starters:section==='starters'?['a']:['b'],taxi:section==='taxi'?['a']:[],reserve:section==='reserve'?['a']:[]};
    const data={...props,roster:selected,rosters:[selected]};
    act(()=>root.render(<MemoryRouter initialEntries={['/player']}><Routes>
        <Route path="/player" element={<PlayerDetail {...data} player={player} />} />
        <Route path="/league/test/team/1" element={<RosterDetail {...data} />} />
    </Routes></MemoryRouter>));
    act(()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='View in Lineup').click());
    expect(document.activeElement?.dataset.playerId).toBe('a');
    expect(host.querySelector('[data-player-id="a"]').getAttribute('aria-current')).toBe('true');
});
it('omits the lineup shortcut for an unowned player', () => {
    render(<PlayerDetail {...props} rosters={[]} player={player}/>);
    expect(host.textContent).not.toContain('View in Lineup');
});
it('handles a stale highlight without hiding the roster', () => {
    act(()=>root.render(<MemoryRouter initialEntries={['/?player=gone']}><RosterDetail {...props}/></MemoryRouter>));
    expect(host.querySelectorAll('[data-player-id]')).toHaveLength(2);
    expect(host.querySelector('[aria-current="true"]')).toBeNull();
});
it('caps a single-game bar and keeps the actual week label', () => {
    feeds.logs={a:[{week:2,points:-2}]};
    render(<PlayerDetail {...props} player={player}/>);
    const bars=[...host.querySelectorAll('.recharts-bar-rectangle path')];
    expect(bars).toHaveLength(1);
    expect(Number(bars[0].getAttribute('width'))).toBeLessThanOrEqual(48);
    expect(host.textContent).toContain('W2');expect(host.textContent).not.toContain('W1');
});
it('uses player headshots in the injury report', () => {
    render(<InjuryReport roster={roster} players={{...players,a:{...player,injury_status:'Out'}}}/>);
    expect(host.querySelector('img').src).toContain('/content/nfl/players/a.jpg');
});
it('renders a full-season chart without synthesizing missing weeks', () => {
    const weeks = Array.from({length:18}, (_,i) => i + 1).filter(w => w !== 7);
    feeds.logs = {a:weeks.map(week => ({week,points:week === 2 ? -3 : week}))};
    render(<PlayerDetail {...props} player={player}/>);
    const bars = [...host.querySelectorAll('.recharts-bar-rectangle path')];
    expect(bars).toHaveLength(17);
    expect(bars.every(bar => Number(bar.getAttribute('width')) <= 48)).toBe(true);
    expect(host.querySelector('.recharts-reference-line')).not.toBeNull();
});
