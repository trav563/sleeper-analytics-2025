import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { LiveDot } from '../../../components/ui/LiveDot';
import { useGameLiveDetails } from '../hooks/useGameLiveDetails';

const ROSTER_HUE = (rosterId) => (Number(rosterId || 0) * 47) % 360;

/** Horizontal-scroll snapshot of every matchup this week. */
const LeaguePulse = ({ league, week, viewMatchups, rosters, users, players }) => {
    const navigate = useNavigate();
    const { details: liveDetails } = useGameLiveDetails(week);

    const pairs = useMemo(() => {
        if (!Array.isArray(viewMatchups) || !rosters) return [];
        const byId = new Map();
        viewMatchups.forEach((m) => {
            if (m.matchup_id == null) return;
            if (!byId.has(m.matchup_id)) byId.set(m.matchup_id, []);
            byId.get(m.matchup_id).push(m);
        });
        return Array.from(byId.values())
            .filter((p) => p.length === 2)
            .map(([a, b]) => {
                const ar = rosters.find((r) => r.roster_id === a.roster_id);
                const br = rosters.find((r) => r.roster_id === b.roster_id);
                const au = users?.find((u) => u.user_id === ar?.owner_id);
                const bu = users?.find((u) => u.user_id === br?.owner_id);
                // Determine status: any live starter on either side?
                const isLive = [...(a.starters || []), ...(b.starters || [])].some((pid) => {
                    const t = players?.[pid]?.team;
                    const s = t ? liveDetails?.[t]?.statusName : null;
                    return s === 'STATUS_IN_PROGRESS' || s === 'STATUS_HALFTIME';
                });
                const margin = Math.abs((a.points || 0) - (b.points || 0));
                return { a, b, ar, br, au, bu, isLive, isClose: margin < 5 && (a.points || 0) > 0 };
            });
    }, [viewMatchups, rosters, users, players, liveDetails]);

    if (pairs.length === 0) return null;

    const liveCount = pairs.filter((p) => p.isLive).length;

    return (
        <section className="bg-bg-1 rounded-xl border border-line p-4 shadow-card">
            <header className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-display text-md font-semibold text-text">League Pulse</h3>
                    {liveCount > 0 && (
                        <>
                            <LiveDot />
                            <span className="font-mono text-2xs uppercase tracking-wider font-bold text-signal-2">
                                <span className="tnum">{liveCount}</span> Live
                            </span>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => navigate(`/league/${league?.league_id}/matchup`)}
                    className="font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast"
                >
                    Week {week} ›
                </button>
            </header>

            <div
                className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
                style={{ scrollbarWidth: 'none' }}
            >
                {pairs.map((p, i) => {
                    const aWin = (p.a.points || 0) > (p.b.points || 0);
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => navigate(`/league/${league?.league_id}/matchup`)}
                            className={`shrink-0 min-w-[210px] rounded-md p-2.5 text-left border transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                                p.isClose
                                    ? 'bg-signal/5 border-signal/40'
                                    : 'bg-bg-2 border-line hover:border-line-strong'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className={`font-mono text-2xs uppercase tracking-wider font-bold ${
                                    p.isClose ? 'text-signal' : p.isLive ? 'text-signal-2' : 'text-text-mute'
                                }`}>
                                    {p.isClose ? '◉ Close' : p.isLive ? '● Live' : 'Soon'}
                                </span>
                            </div>
                            <PairRow roster={p.ar} user={p.au} score={p.a.points || 0} winning={aWin} />
                            <PairRow roster={p.br} user={p.bu} score={p.b.points || 0} winning={!aWin} />
                        </button>
                    );
                })}
            </div>
        </section>
    );
};

const PairRow = ({ roster, user, score, winning }) => (
    <div className="grid grid-cols-[20px_1fr_auto] gap-2 items-center py-0.5">
        {user?.avatar ? (
            <img src={avatarUrl(user.avatar)} alt="" className="w-5 h-5 rounded-full ring-1 ring-line" />
        ) : (
            <Pip seed={roster?.roster_id} name={displayTeamName(user)} size={20} />
        )}
        <span className={`text-xs truncate ${winning ? 'text-text font-semibold' : 'text-text-dim'}`}>
            {displayTeamName(user)}
        </span>
        <span className={`tnum text-sm font-bold tracking-tight ${winning ? 'text-signal' : 'text-text'}`}>
            {score.toFixed(1)}
        </span>
    </div>
);

export default LeaguePulse;
