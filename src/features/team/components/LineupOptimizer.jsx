import { useMemo } from 'react';
import { Sliders } from 'lucide-react';
import { useGameLiveDetails } from '../../dashboard/hooks/useGameLiveDetails';
import { useWeekProjections } from '../../league/hooks/useWeekProjections';
import { optimizeRoster } from '../../../utils/lineupOptimizer';

const name = p => p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Empty';
export default function LineupOptimizer({ league, roster, players, week, isHistoricalSeason }) {
    const { details: games, error } = useGameLiveDetails(week, league?.season);
    const { projections } = useWeekProjections(league?.season, week, league?.scoring_settings);
    const analysis = useMemo(() => optimizeRoster({ roster, players, slots: league?.roster_positions, projections, games }), [roster, players, league, projections, games]);
    if (isHistoricalSeason) return null;
    return <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
        <header className="p-4 border-b border-line">
            <h3 className="flex items-center gap-2 text-lg font-bold"><Sliders className="w-5 h-5 text-signal" />Start / Sit · Week {week}</h3>
            <p className="text-sm text-text-dim mt-1">Complete lineup · started games stay locked · IR and taxi excluded</p>
        </header>
        {analysis.unavailable || error ? <p role="status" className="p-4 text-sm text-text-dim">{error ? 'Game status unavailable. No moves can be verified right now.' : analysis.unavailable}</p> : <>
            <div className="p-4 flex flex-wrap gap-4 text-sm border-b border-line">
                <span>Current projections <strong className="tnum">{analysis.currentTotal.toFixed(1)}</strong></span>
                <span>Suggested projections <strong className="tnum text-signal">{analysis.optimalTotal.toFixed(1)}</strong></span>
            </div>
            {analysis.unknown && <p className="p-4 text-sm text-warn">Some game statuses or projections are unknown. Affected starters stay in place; totals are partial.</p>}
            {analysis.missing && <p className="p-4 text-sm text-warn">An eligible player is unavailable for one or more slots. Review the empty slots in Sleeper.</p>}
            {!analysis.changed && <p className="p-4 text-sm text-text-dim">No verified improvement is available among your unlocked players.</p>}
            {analysis.changed && <p className="p-4 text-sm text-text-dim">Use the full assignment below, including FLEX changes. This app does not edit your Sleeper lineup.</p>}
            <ol className="divide-y divide-line">{analysis.rows.map(r => <li key={r.index} className={`p-4 grid grid-cols-[64px_1fr] gap-2 text-sm ${r.changed ? 'bg-signal/5' : ''}`}>
                <span className="font-mono text-signal">{r.slot}</span>
                <div><span className="font-semibold">{name(r.next)}</span>{r.locked && <span className="ml-2 text-xs text-text-dim">Locked</span>}
                    {r.changed && <span className="block text-text-dim mt-1">Replaces {name(r.player)}</span>}</div>
            </li>)}</ol>
        </>}
    </section>;
}
