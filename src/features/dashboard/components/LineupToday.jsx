import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiveDot } from '../../../components/ui/LiveDot';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';

/** Compact "Today's Lineup" card — first 5 starters with live highlighting. */
const LineupToday = ({ league, week, roster, players, viewMatchups, slotLabels }) => {
    const navigate = useNavigate();
    const { details: liveDetails } = useGameLiveDetails(week);

    const myMatchup = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !roster) return null;
        return viewMatchups.find((m) => m.roster_id === roster.roster_id) || null;
    }, [viewMatchups, roster]);

    const rows = useMemo(() => {
        if (!roster?.starters) return [];
        return roster.starters.slice(0, 5).map((pid, i) => {
            const slot = slotLabels?.[i] || '?';
            const player = pid && pid !== '0' ? players?.[pid] : null;
            const team = player?.team;
            const status = team ? liveDetails?.[team]?.statusName : null;
            const live = status === 'STATUS_IN_PROGRESS' || status === 'STATUS_HALFTIME';
            const pts = myMatchup?.players_points?.[pid] ?? 0;
            return { slot, pid, player, live, pts, gameInfo: liveDetails?.[team] };
        });
    }, [roster, players, liveDetails, myMatchup, slotLabels]);

    if (!roster) return null;

    const totalSet = roster.starters?.filter((pid) => pid && pid !== '0').length || 0;
    const totalSlots = roster.starters?.length || 0;

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="px-4 pt-3 pb-2 border-b border-line flex items-center justify-between">
                <h3 className="font-display text-md font-semibold text-text">Today's Lineup</h3>
                <button
                    type="button"
                    onClick={() => navigate(`/league/${league?.league_id}/team/${roster.roster_id}`)}
                    className="font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast"
                >
                    <span className="tnum">{totalSet}</span> / <span className="tnum">{totalSlots}</span> set ›
                </button>
            </header>

            {rows.map((row, i) => {
                if (!row.player) {
                    return (
                        <div key={i} className="grid grid-cols-[36px_1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-line/60">
                            <span className="font-mono text-2xs font-bold uppercase tracking-wider text-text-mute bg-bg-2 px-2 py-0.5 rounded-sm text-center">
                                {row.slot}
                            </span>
                            <span className="text-sm text-text-mute italic">Empty</span>
                            <span className="tnum text-sm text-text-mute">—</span>
                        </div>
                    );
                }
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => navigate(`/league/${league?.league_id}/player/${row.pid}`)}
                        className={`w-full text-left grid grid-cols-[36px_1fr_auto] gap-3 items-center px-4 py-2.5 border-t border-line/60 hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                            row.live ? 'bg-gradient-to-r from-signal-2/8 to-transparent' : ''
                        }`}
                    >
                        <span className={`font-mono text-2xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm text-center ${
                            row.live ? 'text-signal bg-signal/15' : 'text-text-dim bg-bg-2'
                        }`}>
                            {row.slot}
                        </span>
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-text truncate">
                                {row.player.first_name?.[0]}. {row.player.last_name}
                            </div>
                            <div className={`font-mono text-2xs uppercase tracking-wider mt-0.5 inline-flex items-center gap-1 ${row.live ? 'text-signal-2' : 'text-text-mute'}`}>
                                {row.live && <LiveDot />}
                                {row.player.team || 'FA'}
                                {row.gameInfo?.displayClock && row.live && (
                                    <span className="tnum"> · Q{row.gameInfo.period} {row.gameInfo.displayClock}</span>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`tnum text-md font-extrabold tracking-tight ${row.pts > 0 ? 'text-text' : 'text-text-mute'}`}>
                                {row.pts.toFixed(1)}
                            </div>
                        </div>
                    </button>
                );
            })}

            {totalSlots > 5 && (
                <button
                    type="button"
                    onClick={() => navigate(`/league/${league?.league_id}/team/${roster.roster_id}`)}
                    className="w-full text-center px-4 py-2.5 font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal hover:bg-bg-2/60 border-t border-line/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal"
                >
                    + <span className="tnum">{totalSlots - 5}</span> more · view full lineup
                </button>
            )}
        </section>
    );
};

export default LineupToday;
