import { lazy, Suspense } from 'react';
import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import HistoricalBanner from '../components/layout/HistoricalBanner';

const TOOLS = [
    { id: 'trade-finder', label: 'Trade Finder', group: 'Trades', currentOnly: true, Component: lazy(() => import('../features/tools/components/TradeFinder')) },
    { id: 'trade-simulator', label: 'Trade Simulator', group: 'Trades', currentOnly: true, Component: lazy(() => import('../features/tools/components/TradeSimulator')) },
    { id: 'trade-retro', label: 'Trade Retro', group: 'Trades', Component: lazy(() => import('../features/tools/components/TradeRetro')) },
    { id: 'lineup-checker', label: 'Lineup Check', group: 'Team', currentOnly: true, Component: lazy(() => import('../features/league/components/LineupChecker')) },
    { id: 'roster-clogger', label: 'Roster Clogger', group: 'Team', currentOnly: true, Component: lazy(() => import('../features/tools/components/RosterClogger')) },
    { id: 'dynasty-window', label: 'Dynasty Window', group: 'Dynasty', Component: lazy(() => import('../features/tools/components/DynastyWindow')) },
    { id: 'dynasty-landscape', label: 'Competitive Window', group: 'Dynasty', Component: lazy(() => import('../features/tools/components/DynastyLandscape')) },
    { id: 'draft-board', label: 'Draft Board', group: 'Dynasty', Component: lazy(() => import('../features/tools/components/DraftBoard')) },
    { id: 'tank-tracker', label: 'Tank Tracker', group: 'Dynasty', Component: lazy(() => import('../features/tools/components/TankTracker')) },
    { id: 'schedule-generator', label: 'Schedule Generator', group: 'League', Component: lazy(() => import('../features/tools/components/ScheduleGenerator')) },
];
const GROUPS = ['Trades', 'Team', 'Dynasty', 'League'];

export default function ToolsPage() {
    const { leagueId } = useParams();
    const context = useOutletContext();
    const [params, setParams] = useSearchParams();
    const active = TOOLS.find(t => t.id === params.get('tool')) || TOOLS[0];
    const choose = id => { const next = new URLSearchParams(params); next.set('tool', id); setParams(next); };
    const historical = Number(context.league?.season) < Number(context.state?.season);
    const Component = active.Component;
    return <div className="space-y-5">
        <header><h1 className="text-2xl font-bold">League Tools</h1><p className="text-sm text-text-dim mt-1">Choose a tool. Your inputs stay here while you explore.</p></header>
        <HistoricalBanner message="Historical season: current trade and lineup recommendations are unavailable." />
        <label className="block lg:hidden text-sm font-semibold">Tool
            <select aria-label="Choose a tool" className="block w-full min-h-12 px-3 mt-2 rounded-lg bg-bg-2 border border-line" value={active.id} onChange={e => choose(e.target.value)}>
                {GROUPS.map(group => <optgroup key={group} label={group}>{TOOLS.filter(t => t.group === group).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}
            </select>
        </label>
        <div className="grid lg:grid-cols-[200px_minmax(0,1fr)] gap-5 items-start">
            <nav aria-label="League tools" className="hidden lg:block sticky top-24 bg-bg-1 rounded-xl border border-line p-3 space-y-4">
                {GROUPS.map(group => <div key={group}><h2 className="text-xs font-semibold text-text-dim px-3 mb-1">{group}</h2>{TOOLS.filter(t => t.group === group).map(t => <button key={t.id} onClick={() => choose(t.id)} aria-current={t.id === active.id ? 'page' : undefined} className={`block text-left w-full min-h-11 px-3 rounded-md text-sm ${t.id === active.id ? 'bg-signal/10 text-signal' : 'text-text-dim hover:bg-bg-2'}`}>{t.label}</button>)}</div>)}
            </nav>
            <div className="min-w-0" id="selected-tool">
                {historical && active.currentOnly ? <p className="p-5 bg-bg-1 border border-line rounded-xl text-sm">{active.label} needs the current season. Choose a historical tool or switch seasons.</p>
                    : <Suspense fallback={<p role="status" className="p-8 text-text-dim">Loading {active.label}…</p>}><Component key={`${leagueId}:${active.id}`} {...context} leagueId={leagueId} /></Suspense>}
            </div>
        </div>
    </div>;
}
