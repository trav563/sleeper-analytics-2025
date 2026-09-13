import { useToolState } from '../../../hooks/useToolState';
import { useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { useMarketValues } from '../hooks/useMarketValues';
import { generateTradeCandidates } from '../../../utils/tradeCandidates';
import { tradeWindowOpen } from '../../../utils/valuation';
import { displayTeamName } from '../../../utils/nflData';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

export default function TradeFinder({ league, rosters, users, players, state }) {
    const { user } = useSleeper();
    const [chosen, setChosen] = useToolState(`finder-team:${league.league_id}`, null);
    const [mode, setMode] = useToolState(`finder-mode:${league.league_id}`, 'trade-up');
    const rosterId = rosters.some(r => r.roster_id === chosen) ? chosen : (rosters.find(r => r.owner_id === user?.user_id) || rosters[0])?.roster_id;
    const { snapshot, isLoading, refetch } = useMarketValues(league, rosters.length);
    const offers = useMemo(() => generateTradeCandidates({ league, rosters, players, snapshot, rosterId, mode, state }), [league, rosters, players, snapshot, rosterId, mode, state]);
    const teamName = id => displayTeamName(users.find(u => u.user_id === rosters.find(r => r.roster_id === id)?.owner_id));
    return <section className="bg-bg-1 border border-line rounded-xl p-4 sm:p-5 space-y-5">
        <header><h2 className="text-xl font-bold">Trade Finder</h2><p className="text-sm text-text-dim mt-1">Offers screened for market value and long-term roster fit. IR/taxi ownership is separate from weekly availability.</p></header>
        <label className="block text-sm">Your team<select aria-label="Trade Finder team" value={rosterId || ''} onChange={e => setChosen(Number(e.target.value))} className="block w-full min-h-11 mt-2 rounded-md bg-bg-2 border border-line px-3">{rosters.map(r => <option key={r.roster_id} value={r.roster_id}>{teamName(r.roster_id)}</option>)}</select></label>
        <SegmentedTabs tabs={[{ value: 'trade-up', label: 'Trade-up packages' }, { value: 'swap', label: 'Position swaps' }]} value={mode} onChange={setMode} />
        <p className="text-xs text-text-dim">{snapshot?.source || 'Loading market values'}{snapshot?.fetchedAt ? ` · retrieved ${new Date(snapshot.fetchedAt).toLocaleString()}` : ''}. Values account for {snapshot?.settings?.isDynasty ? 'dynasty age and long-term value' : 'redraft value'}. {snapshot?.approximation}</p>
        {!tradeWindowOpen(league, state) ? <p className="text-warn text-sm">Trading is closed for this season or past the league deadline. No actionable offers are shown.</p>
            : isLoading ? <p role="status">Screening roster fits…</p>
            : !snapshot?.trustworthy ? <div role="status"><p>Market values are unavailable. Precise trade recommendations are paused.</p><button className="min-h-11 text-signal" onClick={() => refetch()}>Retry market values</button></div>
            : offers.length === 0 ? <p className="text-sm text-text-dim py-4">No realistic {mode === 'trade-up' ? 'trade-up packages' : 'position swaps'} passed the checks. We require useful players, comparable values, and a stronger starting group for both teams.</p>
            : <div className="space-y-4">{offers.map(o => <article key={o.opponentRosterId} className="border border-line rounded-lg p-4 space-y-3">
                <h3 className="font-bold">With {teamName(o.opponentRosterId)}</h3>
                <div className="grid sm:grid-cols-2 gap-4">{[['You send', o.give, o.giveValue], ['You receive', o.receive, o.receiveValue]].map(([label, assets, total]) => <div key={label}><h4 className="text-sm text-signal mb-2">{label}</h4><ul>{assets.map(p => <li key={p.id} className="text-sm py-1"><strong>{p.first_name} {p.last_name}</strong><span className="block text-xs text-text-dim">{p.position}{p.ownershipStatus !== "Active" ? ` · ${p.ownershipStatus}` : ""} · {p.age ? `${p.age}yo · ` : ''}{p.tradeValue.toLocaleString()} value</span></li>)}</ul><p className="text-xs mt-2">Total: {total.toLocaleString()}</p></div>)}</div>
                <p className="text-sm text-text-dim">{o.reason} Your starting-group value increases by {o.myGain.toLocaleString()}; theirs by {o.theirGain.toLocaleString()}.</p>
                <p className="text-xs text-text-dim">Market-fit estimate, not a guarantee of acceptance or a weekly points projection.</p>
            </article>)}</div>}
    </section>;
}
