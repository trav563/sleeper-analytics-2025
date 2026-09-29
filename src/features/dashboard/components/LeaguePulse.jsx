import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';
import { matchupStatus } from '../../../lib/matchupStatus';

const LeaguePulse = ({ league, week, viewMatchups, rosters, users, players, completedWeek = 0 }) => {
    const { details: liveDetails, error, isLoading } = useGameLiveDetails(week, league?.season);
    const pairs = useMemo(() => {
        const byId = new Map();
        for (const matchup of viewMatchups || []) {
            if (matchup.matchup_id == null) continue;
            if (!byId.has(matchup.matchup_id)) byId.set(matchup.matchup_id, []);
            byId.get(matchup.matchup_id).push(matchup);
        }
        return [...byId.values()].filter(pair => pair.length === 2).map(([a, b]) => ({
            a, b,
            status: matchupStatus({ matchups: [a, b], players, games: liveDetails, week, completedWeek }),
            close: Math.abs((a.points || 0) - (b.points || 0)) < 5 && Math.max(a.points || 0, b.points || 0) > 0,
        }));
    }, [viewMatchups, players, liveDetails, week, completedWeek]);
    if (!pairs.length) return null;
    return <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
        <header className="flex items-center justify-between gap-2 mb-3">
            <h3 className="font-display text-md font-semibold">League Pulse</h3>
            <Link to={`/league/${league?.league_id}/matchup/${week}`} className="inline-flex min-h-11 items-center text-xs text-text-dim hover:text-signal">Week {week} matchups</Link>
        </header>
        {error && <p role="status" className="text-xs text-text-dim mb-3">Game status could not refresh. Showing the last available update.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pairs.slice(0, 6).map(({ a, b, status, close }) => <article key={a.matchup_id} className="rounded-md p-2.5 bg-bg-2 border border-line">
                <div className="flex flex-wrap items-center gap-2 mb-1 text-xs font-semibold">
                    {status === 'Live' && <LiveDot />}
                    <span className={status === 'Live' ? 'text-signal-2' : 'text-text-dim'}>{isLoading && status === 'Unavailable' ? 'Checking status…' : status === 'Unavailable' ? 'Status unavailable' : status}</span>
                    {close && ['Live', 'In progress'].includes(status) && <span className="text-signal">Close game</span>}
                </div>
                {[a, b].map(m => {
                    const roster = rosters?.find(r => r.roster_id === m.roster_id);
                    const owner = users?.find(u => u.user_id === roster?.owner_id);
                    const name = displayTeamName(owner) || `Team ${m.roster_id}`;
                    return <div key={m.roster_id} className="flex items-center gap-2">
                        <Link to={`/league/${league?.league_id}/team/${m.roster_id}`} className="min-h-11 min-w-0 flex-1 flex items-center gap-2 text-xs hover:text-signal">
                            {owner?.avatar ? <img src={avatarUrl(owner.avatar)} alt="" className="w-5 h-5 rounded-full shrink-0" /> : <Pip seed={m.roster_id} name={name} size={20} />}
                            <span className="truncate">{name}</span>
                        </Link>
                        <span className={`tnum text-sm font-bold ${m.points > (m === a ? b.points : a.points) ? 'text-signal' : 'text-text'}`}>{Number.isFinite(m.points) ? m.points.toFixed(1) : '—'}</span>
                    </div>;
                })}
                <Link to={`/league/${league?.league_id}/matchup/${week}?roster=${a.roster_id}`} className="inline-flex min-h-11 items-center text-xs font-semibold text-text-dim hover:text-signal"
                    aria-label={`View Week ${week} matchup for ${displayTeamName(users?.find(u => u.user_id === rosters?.find(r => r.roster_id === a.roster_id)?.owner_id))}`}>
                    View matchup
                </Link>
            </article>)}
        </div>
    </section>;
};
export default LeaguePulse;
