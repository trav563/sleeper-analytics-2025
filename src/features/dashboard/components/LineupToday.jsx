import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerHeadshot } from '../../../components/ui/PlayerHeadshot';
import { useWeekProjections } from '../../league/hooks/useWeekProjections';
import { gamePhase, starterPoints } from '../../../lib/liveProjection';
import { LiveDot } from '../../../components/ui/LiveDot';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';

/** Week-specific lineup card with live highlighting when games are in progress. */
const LineupToday = ({ league, week, roster, players, viewMatchups, slotLabels, allowRosterFallback = false }) => {
    const navigate = useNavigate();
    const { projectionFor } = useWeekProjections(league?.season, week, league?.scoring_settings);
    const { details: liveDetails } = useGameLiveDetails(week, league?.season);

    const myMatchup = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !roster) return null;
        return viewMatchups.find((m) => m.roster_id === roster.roster_id) || null;
    }, [viewMatchups, roster]);

    const starters = useMemo(() => myMatchup?.starters ?? (allowRosterFallback ? roster?.starters : []) ?? [], [myMatchup, allowRosterFallback, roster]);
    const rows = useMemo(() => {
        return starters.map((pid, i) => {
            const slot = slotLabels?.[i] || '?';
            const player = pid && pid !== '0' ? players?.[pid] : null;
            const team = player?.team;
            const status = team ? liveDetails?.[team]?.statusName : null;
            const phase = gamePhase({ statusName: status });
            const live = phase === 'LIVE';
            const pts = phase === 'SOON' ? projectionFor(pid) : starterPoints(myMatchup, i);
            return { slot, pid, player, live, pts, projected: phase === 'SOON', gameInfo: liveDetails?.[team] };
        });
    }, [starters, players, liveDetails, myMatchup, slotLabels, projectionFor]);

    if (!roster) return null;

    const totalSet = starters.filter((pid) => pid && pid !== '0').length || 0;
    const totalSlots = starters.length || 0;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="px-4 pt-3 pb-2 border-b border-line flex items-center justify-between">
                <h3 className="font-display text-md font-semibold text-text">Week {week} lineup</h3>
                <button
                    type="button"
                    onClick={() => navigate(`/league/${league?.league_id}/team/${roster.roster_id}`)}
                    className="min-h-11 px-2 font-mono text-xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast"
                >
                    <span className="tnum">{totalSet}</span> / <span className="tnum">{totalSlots}</span> set ›
                </button>
            </header>

            {!rows.length && <p className="p-4 text-sm text-text-mute">Lineup unavailable for this week.</p>}
            {rows.map((row, i) => {
                if (!row.player) {
                    return (
                        <div key={i} className="grid grid-cols-[36px_28px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-2.5 border-t border-line/60">
                            <span className="font-mono text-xs font-bold uppercase tracking-wider text-text-mute bg-bg-2 px-2 py-0.5 rounded-sm text-center">
                                {row.slot}
                            </span>
                            <span className="text-sm text-text-mute italic col-span-2">Empty</span>
                            <span className="tnum text-sm text-text-mute">—</span>
                        </div>
                    );
                }
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => navigate(`/league/${league?.league_id}/player/${row.pid}`)}
                        className={`w-full text-left grid grid-cols-[36px_28px_minmax(0,1fr)_auto] gap-3 items-center px-4 py-2.5 border-t border-line/60 hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                            row.live ? 'bg-gradient-to-r from-signal-2/8 to-transparent' : ''
                        }`}
                    >
                        <span className={`font-mono text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm text-center ${
                            row.live ? 'text-signal bg-signal/15' : 'text-text-dim bg-bg-2'
                        }`}>
                            {row.slot}
                        </span>
                        <PlayerHeadshot playerId={row.pid} name={`${row.player.first_name} ${row.player.last_name}`} size={28} />
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-text truncate">
                                {row.player.first_name?.[0]}. {row.player.last_name}
                            </div>
                            <div className={`font-mono text-xs uppercase tracking-wider mt-0.5 inline-flex items-center gap-1 ${row.live ? 'text-signal-2' : 'text-text-mute'}`}>
                                {row.live && <LiveDot />}
                                {row.player.team || 'FA'}
                                {row.gameInfo?.displayClock && row.live && (
                                    <span className="tnum"> · Q{row.gameInfo.period} {row.gameInfo.displayClock}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`tnum text-md font-extrabold tracking-tight ${row.pts > 0 ? 'text-text' : 'text-text-mute'}`}>
                                {row.projected && <span className="text-xs text-text-dim font-normal mr-1">Proj</span>}{Number.isFinite(row.pts) ? row.pts.toFixed(1) : '—'}
                            </div>
                        </div>
                    </button>
                );
            })}

            <button
                type="button"
                onClick={() => navigate(`/league/${league?.league_id}/team/${roster.roster_id}`)}
                className="w-full min-h-11 text-center px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-text-dim hover:text-signal hover:bg-bg-2/60 border-t border-line/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
            >
                Bench, taxi & IR · view full team ›
            </button>
        </section>
    );
};

export default LineupToday;
