import { useMemo, useState } from 'react';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';

const TrueStandings = ({ leagueId, currentWeek, rosters, users }) => {
    const { seasonMatchups, loading, error } = useSeasonMatchups(leagueId, currentWeek);

    const userById = useMemo(() => {
        const map = new Map();
        if (users) users.forEach(u => map.set(u.user_id, u));
        return map;
    }, [users]);

    const stats = useMemo(() => {
        if (loading || !rosters || !seasonMatchups) return [];

        const teamStats = {};

        rosters.forEach(r => {
            teamStats[r.roster_id] = {
                rosterId: r.roster_id,
                ownerId: r.owner_id,
                wins: r.settings.wins,
                losses: r.settings.losses,
                ties: r.settings.ties,
                fpts: r.settings.fpts + (r.settings.fpts_decimal || 0) / 100,
                allPlayWins: 0,
                allPlayLosses: 0,
                allPlayTies: 0
            };
        });

        Object.values(seasonMatchups).forEach(weekMatchups => {
            if (!weekMatchups) return;

            const scores = weekMatchups.map(m => ({
                roster_id: m.roster_id,
                points: m.points
            })).sort((a, b) => b.points - a.points);

            scores.forEach(teamA => {
                if (!teamStats[teamA.roster_id]) return;

                scores.forEach(teamB => {
                    if (teamA.roster_id === teamB.roster_id) return;

                    if (teamA.points > teamB.points) {
                        teamStats[teamA.roster_id].allPlayWins++;
                    } else if (teamA.points < teamB.points) {
                        teamStats[teamA.roster_id].allPlayLosses++;
                    } else {
                        teamStats[teamA.roster_id].allPlayTies++;
                    }
                });
            });
        });

        return Object.values(teamStats).map(stat => {
            const owner = userById.get(stat.ownerId);
            const allPlayWinPct = (stat.allPlayWins + stat.allPlayTies * 0.5) / (stat.allPlayWins + stat.allPlayLosses + stat.allPlayTies || 1);
            const totalGames = stat.wins + stat.losses + stat.ties;
            const expectedWins = allPlayWinPct * totalGames;
            const luckIndex = stat.wins - expectedWins;

            return {
                ...stat,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                actualRecord: `${stat.wins}-${stat.losses}${stat.ties > 0 ? `-${stat.ties}` : ''}`,
                allPlayRecord: `${stat.allPlayWins}-${stat.allPlayLosses}${stat.allPlayTies > 0 ? `-${stat.allPlayTies}` : ''}`,
                luckIndex: luckIndex.toFixed(2)
            };
        }).sort((a, b) => b.allPlayWins - a.allPlayWins);
    }, [seasonMatchups, rosters, userById, loading]);

    const [showTooltip, setShowTooltip] = useState(false);

    if (loading) return (
        <section className="bg-bg-1 rounded-xl border border-line p-6 shadow-card">
            <div className="font-mono text-2xs uppercase tracking-wider text-text-mute text-center">
                Loading True Standings…
            </div>
        </section>
    );
    if (error) return (
        <section className="bg-bg-1 rounded-xl border border-line p-6 shadow-card">
            <div className="font-mono text-2xs uppercase tracking-wider text-bad text-center">
                Failed to load data
            </div>
        </section>
    );

    return (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">
            <header className="p-4 border-b border-line">
                <h3 className="font-display text-lg font-semibold text-text">True Standings</h3>
                <p className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">
                    All-play · every team vs every other team each week
                </p>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead>
                        <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                            <th className="px-3 py-2.5">Team</th>
                            <th className="px-3 py-2.5 text-center">
                                <span className="md:hidden">Rec</span>
                                <span className="hidden md:inline">Actual</span>
                            </th>
                            <th className="px-3 py-2.5 text-center">
                                <span className="md:hidden">AP</span>
                                <span className="hidden md:inline">All-Play</span>
                            </th>
                            <th className="px-3 py-2.5 text-center relative">
                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center gap-1 mx-auto focus:outline-none uppercase tracking-wider"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTooltip(!showTooltip);
                                    }}
                                >
                                    <span className="md:hidden">Luck</span>
                                    <span className="hidden md:inline">Luck</span>
                                    <span className="text-text-mute" aria-hidden="true">?</span>
                                </button>
                                <div
                                    className={`absolute top-full right-0 mt-2 px-3 py-2 bg-bg-1 text-xs text-text rounded-md shadow-pop transition-opacity w-52 z-10 border border-line normal-case tracking-normal ${
                                        showTooltip ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                                    }`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Difference between Actual Wins and Expected Wins (based on All-Play record).
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((team) => {
                            const luck = parseFloat(team.luckIndex);
                            const luckColor = luck > 0 ? 'text-good' : luck < 0 ? 'text-bad' : 'text-text-mute';
                            return (
                                <tr key={team.rosterId} className="border-b border-line hover:bg-bg-2/60 transition-colors duration-fast">
                                    <td className="px-3 py-3 text-text">
                                        <div className="flex items-center gap-2">
                                            {team.avatar ? (
                                                <img src={team.avatar} alt="" loading="lazy" className="w-6 h-6 rounded-full ring-1 ring-line shrink-0" />
                                            ) : (
                                                <Pip seed={team.ownerId ?? team.rosterId} name={team.name} size={24} />
                                            )}
                                            <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-none">{team.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim">{team.actualRecord}</td>
                                    <td className="px-3 py-3 text-center tnum text-text-dim">{team.allPlayRecord}</td>
                                    <td className={`px-3 py-3 text-center tnum font-bold ${luckColor}`}>
                                        {luck > 0 ? '+' : ''}{team.luckIndex}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default TrueStandings;
