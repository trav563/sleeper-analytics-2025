import { useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { useToolState } from '../../../hooks/useToolState';
import { useMarketValues } from '../hooks/useMarketValues';
import { getRookieLockState } from '../../../utils/sleeper';
import { generateWaiverMoves } from '../../../utils/waiverCandidates';
import { displayTeamName } from '../../../utils/nflData';

export default function RosterClogger({ rosters, players, league, drafts, users }) {
    const { user, viewedTeams } = useSleeper();
    const [chosen, setChosen] = useToolState(`clogger-team:${league.league_id}`, () => viewedTeams[league.league_id] || rosters.find(r => r.owner_id === user?.user_id)?.roster_id || rosters[0]?.roster_id);
    const { snapshot, isLoading, refetch } = useMarketValues(league, rosters.length);
    const { rookiesLocked } = getRookieLockState(league, drafts);
    const moves = useMemo(() => generateWaiverMoves({ league, rosters, rosterId: chosen, players, snapshot, rookiesLocked }), [league, rosters, chosen, players, snapshot, rookiesLocked]);
    const name = id => `${players[id]?.first_name || ''} ${players[id]?.last_name || ''}`.trim();
    return <section className="bg-bg-1 border border-line rounded-xl p-5 space-y-4">
        <header><h2 className="text-xl font-bold">Roster Clogger</h2><p className="text-sm text-text-dim mt-2">Review lower-value bench depth. Starters, IR/taxi, young dynasty stashes, and valuable dynasty assets are protected.</p></header>
        <label className="block text-sm font-semibold">Team<select aria-label="Roster Clogger team" value={chosen} onChange={e => setChosen(Number(e.target.value))} className="block w-full min-h-11 mt-2 bg-bg-2 border border-line rounded-md px-3">{rosters.map(r => <option key={r.roster_id} value={r.roster_id}>{displayTeamName(users?.find(u => u.user_id === r.owner_id))}</option>)}</select></label>
        <p className="text-xs text-text-dim">{isLoading ? 'Loading market values…' : snapshot?.source}{snapshot?.fetchedAt ? ` · retrieved ${new Date(snapshot.fetchedAt).toLocaleString()}` : ''}. {snapshot?.approximation}</p>
        {rookiesLocked && <p className="text-sm text-warn">Rookies are excluded until the rookie draft is complete.</p>}
        {!isLoading && !snapshot?.trustworthy ? <div role="status"><p>Market values are unavailable. Drop recommendations are paused.</p><button className="min-h-11 text-signal" onClick={() => refetch()}>Retry market values</button></div>
            : !isLoading && !moves.length ? <p className="text-sm text-text-dim">No supported add/drop upgrades were found. Missing values are not treated as zero.</p>
                : <ul className="divide-y divide-line">{moves.map(m => <li className="py-4 text-sm" key={m.drop}><p><strong className="text-good">Add {name(m.add)}</strong> · {m.addValue.toLocaleString()} market value</p><p className="mt-2 text-text-dim">Review dropping {name(m.drop)} · {m.dropValue.toLocaleString()} value</p><p className="text-xs text-text-dim mt-2">Same position. Consider trade interest before releasing an owned asset.</p></li>)}</ul>}
    </section>;
}
