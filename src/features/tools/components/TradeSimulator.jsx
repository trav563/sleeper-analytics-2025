import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchSleeper } from '../../../utils/sleeper';
import { useMarketValues } from '../hooks/useMarketValues';
import { useToolState } from '../../../hooks/useToolState';
import { ownedPlayerIds } from '../../../utils/valuation';
import { scoreStatLine } from '../../../utils/scoring';
import { displayTeamName } from '../../../utils/nflData';
import { TRADE_VALUE_TOLERANCE, CONSOLIDATION_PREMIUM, trustworthyMarket } from '../../../utils/tradeCandidates';

export default function TradeSimulator({ league, rosters, users, players }) {
    const { user } = useSleeper();
    const [summaryOpen, setSummaryOpen] = useState(false);
    const myId = (rosters.find(r => r.owner_id === user?.user_id) || rosters[0])?.roster_id;
    const [form, setForm] = useToolState(`simulator:${league.league_id}`, () => ({
        teams: [myId, rosters.find(r => r.roster_id !== myId)?.roster_id], selections: [[], []], search: ['', ''], position: ['ALL', 'ALL'],
    }));
    const { snapshot, isLoading, refetch } = useMarketValues(league, rosters.length);
    const season = Number(league.season) - 1;
    const { data: stats } = useQuery({ queryKey: ['seasonStats', String(season)], queryFn: () => fetchSleeper(`/stats/nfl/regular/${season}`), staleTime: 3600000 });
    const ownerName = id => displayTeamName(users.find(u => u.user_id === rosters.find(r => r.roster_id === id)?.owner_id));
    const sides = useMemo(() => form.teams.map(id => {
        const roster = rosters.find(r => r.roster_id === id);
        return ownedPlayerIds(roster).map(pid => {
            const p = players[pid];
            if (!p || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) return null;
            const stat = stats?.[pid];
            const points = scoreStatLine(stat, league.scoring_settings);
            return { id: pid, name: `${p.first_name || ''} ${p.last_name || ''}`.trim(), position: p.position, age: p.age,
                value: snapshot?.values?.[pid], ppg: stat?.gp > 0 && points != null ? points / stat.gp : null,
                status: roster.reserve?.includes(pid) ? 'IR' : roster.taxi?.includes(pid) ? 'Taxi' : '' };
        }).filter(Boolean).sort((a, b) => (b.value || 0) - (a.value || 0));
    }), [form.teams, rosters, players, stats, snapshot, league.scoring_settings]);
    const selected = sides.map((list, side) => list.filter(p => form.selections[side].includes(p.id)));
    const totals = selected.map(list => list.reduce((sum, p) => sum + (p.value || 0), 0));
    const ready = selected.every(list => list.length > 0) && selected.flat().every(p => Number.isFinite(p.value) && p.value > 0) && trustworthyMarket(snapshot);
    const packageSide = selected[0].length > selected[1].length ? 0 : selected[1].length > selected[0].length ? 1 : null;
    const adjusted = totals.map((value, i) => packageSide === i ? value / (1 + CONSOLIDATION_PREMIUM) : value);
    const difference = Math.abs(adjusted[0] - adjusted[1]) / Math.max(...adjusted, 1);
    const update = (field, side, value) => setForm(prev => ({ ...prev, [field]: prev[field].map((v, i) => i === side ? value : v) }));
    const chooseTeam = (side, id) => setForm(prev => ({ ...prev, teams: prev.teams.map((v, i) => i === side ? id : v), selections: prev.selections.map((v, i) => i === side ? [] : v) }));
    const toggle = (side, id) => update('selections', side, form.selections[side].includes(id) ? form.selections[side].filter(p => p !== id) : [...form.selections[side], id]);
    return <section className="space-y-4">
        <header className="bg-bg-1 border border-line rounded-xl p-5"><h2 className="text-xl font-bold">Trade Simulator</h2>
            <p className="mt-2 text-sm text-text-dim">Compare {snapshot?.settings?.isDynasty ? 'dynasty' : 'redraft'} market values. Age is already reflected in dynasty prices. {season} PPG is shown separately.</p>
            <p className="text-xs text-text-dim mt-2">{isLoading ? 'Loading market values…' : snapshot?.source}{snapshot?.fetchedAt ? ` · retrieved ${new Date(snapshot.fetchedAt).toLocaleString()}` : ''}. {snapshot?.approximation}</p>
            {!isLoading && !snapshot?.trustworthy && <button onClick={() => refetch()} className="min-h-11 text-signal text-sm">Retry market values</button>}
        </header>
        <div className="grid md:grid-cols-2 gap-4">{sides.map((list, side) => <section key={side} className="min-w-0 bg-bg-1 border border-line rounded-xl overflow-hidden">
            <div className="p-4 space-y-3 border-b border-line">
                <label className="block text-sm font-semibold">{side === 0 ? 'Your team sends' : 'Other team sends'}<select aria-label={`Trade team ${side + 1}`} value={form.teams[side] || ''} onChange={e => chooseTeam(side, Number(e.target.value))} className="mt-2 min-h-11 w-full bg-bg-2 rounded-md border border-line px-3">{rosters.filter(r => r.roster_id !== form.teams[1 - side]).map(r => <option key={r.roster_id} value={r.roster_id}>{ownerName(r.roster_id)}</option>)}</select></label>
                <div className="flex gap-2"><input aria-label={`Search team ${side + 1} players`} placeholder="Search players" value={form.search[side]} onChange={e => update('search', side, e.target.value)} className="min-w-0 flex-1 min-h-11 px-3 bg-bg-2 rounded-md border border-line text-sm" /><select aria-label={`Team ${side + 1} position`} value={form.position[side]} onChange={e => update('position', side, e.target.value)} className="min-h-11 px-2 bg-bg-2 rounded-md border border-line text-sm">{['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(pos => <option key={pos}>{pos}</option>)}</select></div>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-line">{list.filter(p => p.name.toLowerCase().includes(form.search[side].toLowerCase()) && (form.position[side] === 'ALL' || p.position === form.position[side])).map(p => <button key={p.id} type="button" onClick={() => toggle(side, p.id)} aria-pressed={form.selections[side].includes(p.id)} className={`w-full min-h-[68px] px-4 py-3 flex items-start gap-3 text-left ${form.selections[side].includes(p.id) ? 'bg-signal/10' : 'hover:bg-bg-2'}`}>
                <span aria-hidden="true" className="text-signal w-4 pt-0.5">{form.selections[side].includes(p.id) ? '✓' : '+'}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold break-words">{p.name}</span><span className="block text-xs text-text-dim mt-1">{p.position}{p.position !== 'DEF' && p.age ? ` · ${p.age}yo` : ''}{p.status ? ` · ${p.status}` : ''}{p.ppg != null ? ` · ${p.ppg.toFixed(1)} PPG` : ''}</span></span>
                <span className="text-sm tnum shrink-0">{p.value != null ? p.value.toLocaleString() : '—'}</span>
            </button>)}</div>
        </section>)}</div>
        <aside aria-label="Trade summary" className="trade-summary sticky bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-4 bg-bg-1 border border-line-strong shadow-pop rounded-xl p-4 z-20">
            <div className="flex justify-between items-center gap-3"><h3 className="hidden md:block font-bold text-base">Offer summary</h3><button type="button" aria-expanded={summaryOpen} aria-controls="offer-details" className="md:hidden min-h-11 text-left text-sm font-semibold" onClick={() => setSummaryOpen(v => !v)}>Offer · {totals[0].toLocaleString()} / {totals[1].toLocaleString()} <span className="text-signal ml-2">{summaryOpen ? "Hide" : "Details"}</span></button><button className="text-sm text-signal min-h-11 -my-2 px-2" onClick={() => setForm(prev => ({ ...prev, selections: [[], []] }))}>Reset</button></div>
            <div id="offer-details" className={`${summaryOpen ? "block" : "hidden"} md:block max-h-[35dvh] overflow-y-auto`}><div className="grid sm:grid-cols-2 gap-3 mt-3">{selected.map((list, i) => <div key={i} className="text-sm min-w-0"><p className="font-semibold">{ownerName(form.teams[i])}: {totals[i].toLocaleString()}</p><p className="text-text-dim break-words text-xs mt-1">{list.map(p => p.name).join(', ') || 'Select players above'}</p></div>)}</div>
            <p className={`mt-3 text-sm ${ready && difference <= TRADE_VALUE_TOLERANCE ? 'text-good' : 'text-text-dim'}`}>{ready ? difference <= TRADE_VALUE_TOLERANCE ? 'Within the market-value screen' : 'Outside the 15% value screen' : 'Choose valued assets on both sides to compare. Missing values are not zero.'}</p>
            {packageSide != null && ready && <p className="text-xs text-text-dim mt-1">Includes a 10% premium for consolidating a larger package. Roster fit and manager preference still matter.</p>}
            </div>
        </aside>
    </section>;
}
