import { useNavigate } from 'react-router-dom';
import { Pip } from '../../../components/ui/Pip';
import { Trend } from '../../../components/ui/Trend';
import { usePowerRankings } from '../../analytics/hooks/usePowerRankings';

/** Top-5 standings preview with deep-link to full Standings page. */
const StandingsStrip = ({ league, rosters, users, seasonMatchups, currentUserId }) => {
    const navigate = useNavigate();
    const { rankings } = usePowerRankings(seasonMatchups, rosters, users);
    const top5 = rankings.slice(0, 5);

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-line">
                <h3 className="font-display text-md font-semibold text-text">Standings</h3>
                <button
                    type="button"
                    onClick={() => navigate(`/league/${league?.league_id}/standings`)}
                    className="font-mono text-2xs uppercase tracking-wider text-text-dim hover:text-signal transition-colors duration-fast"
                >
                    Power ›
                </button>
            </header>

            {top5.length === 0 ? (
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute py-6 text-center">
                    Standings appear once games are played.
                </div>
            ) : (
                top5.map((row, i) => {
                    const isMe = row.ownerId === currentUserId;
                    return (
                        <button
                            key={row.rosterId}
                            type="button"
                            onClick={() => navigate(`/league/${league?.league_id}/team/${row.rosterId}`)}
                            className={`w-full text-left grid grid-cols-[24px_28px_1fr_44px_44px_36px] gap-2 items-center px-4 py-2.5 border-t border-line/60 hover:bg-bg-2/60 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ${
                                isMe ? 'bg-bg-2/40' : ''
                            }`}
                        >
                            <span className={`tnum text-xs font-bold text-center ${
                                i < 3 ? 'text-signal' : 'text-text-mute'
                            }`}>
                                {i + 1}
                            </span>
                            {row.avatar ? (
                                <img src={row.avatar} alt="" className="w-6 h-6 rounded-full ring-1 ring-line" />
                            ) : (
                                <Pip seed={row.rosterId} name={row.name} size={24} ring={isMe} />
                            )}
                            <span className={`text-xs truncate ${isMe ? 'text-text font-bold' : 'text-text font-semibold'}`}>
                                {row.name}
                            </span>
                            <span className="tnum text-xs text-text-dim text-right">{row.record}</span>
                            <span className="tnum text-xs text-text-dim text-right">{row.pf.toFixed(0)}</span>
                            <div className="text-right">
                                <Trend v={row.rankChange} />
                            </div>
                        </button>
                    );
                })
            )}
        </section>
    );
};

export default StandingsStrip;
