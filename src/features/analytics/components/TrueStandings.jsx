import { useMemo } from 'react';
import { useSeasonMatchups } from '../hooks/useSeasonMatchups';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

const TrueStandings = ({ leagueId, currentWeek, rosters, users }) => {
    const { seasonMatchups, loading, error } = useSeasonMatchups(leagueId, currentWeek);

    const userById = useMemo(() => {
        const map = new Map();
        if (users) users.forEach(u => map.set(u.user_id, u));
        return map;
    }, [users]);

    const stats = useMemo(() => {
        if (loading || !rosters || !seasonMatchups) return [];

        const teamStats = {}; // roster_id -> { wins, losses, allPlayWins, allPlayLosses, pointsFor }

        // Initialize
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

        // Calculate All-Play
        Object.values(seasonMatchups).forEach(weekMatchups => {
            if (!weekMatchups) return;

            // Get all scores for this week
            const scores = weekMatchups.map(m => ({
                roster_id: m.roster_id,
                points: m.points
            })).sort((a, b) => b.points - a.points);

            // Compare each team against every other team
            scores.forEach(teamA => {
                if (!teamStats[teamA.roster_id]) return; // Should exist

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

        // Format for table
        return Object.values(teamStats).map(stat => {
            const owner = userById.get(stat.ownerId);
            const actualWinPct = (stat.wins + stat.ties * 0.5) / (stat.wins + stat.losses + stat.ties || 1);
            const allPlayWinPct = (stat.allPlayWins + stat.allPlayTies * 0.5) / (stat.allPlayWins + stat.allPlayLosses + stat.allPlayTies || 1);

            // Luck Index: Difference in wins (Actual Wins - Expected Wins based on All-Play)
            // Expected Wins = All-Play Win % * Total Games Played (Wins + Losses + Ties)
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
        }).sort((a, b) => b.allPlayWins - a.allPlayWins); // Sort by All-Play Wins

    }, [seasonMatchups, rosters, userById, loading]);

    if (loading) return <div className="p-4 text-center text-gray-400">Loading True Standings...</div>;
    if (error) return <div className="p-4 text-center text-red-400">Failed to load data</div>;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">True Standings (All-Play)</h3>
                <p className="text-xs text-slate-400">Comparing every team against every other team each week.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                        <tr>
                            <th className="px-4 py-3">Team</th>
                            <th className="px-4 py-3 text-center">Actual</th>
                            <th className="px-4 py-3 text-center">All-Play</th>
                            <th className="px-4 py-3 text-center">Luck Index (Wins)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((team, idx) => (
                            <tr key={team.rosterId} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                                    <img src={team.avatar} alt="" className="w-6 h-6 rounded-full" />
                                    {team.name}
                                </td>
                                <td className="px-4 py-3 text-center">{team.actualRecord}</td>
                                <td className="px-4 py-3 text-center">{team.allPlayRecord}</td>
                                <td className={`px-4 py-3 text-center font-bold ${parseFloat(team.luckIndex) > 0 ? 'text-green-400' : parseFloat(team.luckIndex) < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {parseFloat(team.luckIndex) > 0 ? '+' : ''}{team.luckIndex}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TrueStandings;
