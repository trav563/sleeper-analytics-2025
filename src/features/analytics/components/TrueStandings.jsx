import { useMemo, useState } from 'react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

const TrueStandings = ({ leagueId, currentWeek, rosters, users, weeklyMatchups, league }) => {
    // Deprecated hook usage in favor of passed props for performance
    // const { seasonMatchups, loading, error } = useSeasonMatchups(leagueId, currentWeek);

    const userById = useMemo(() => {
        const map = new Map();
        if (users) users.forEach(u => map.set(u.user_id, u));
        return map;
    }, [users]);

    const stats = useMemo(() => {
        if (!rosters || !weeklyMatchups) return [];

        const isMedianEnabled = league?.settings?.league_average_match === 1;

        const teamStats = {};

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
                allPlayTies: 0,
                // Advanced Luck Stats
                calcActualWins: 0,
                calcExpectedWins: 0
            };
        });

        // Calculate Stats
        weeklyMatchups.forEach(weekData => {
            const matchups = weekData.matchups || [];
            if (matchups.length === 0) return;

            // 1. Calculate Weekly Median
            const scores = matchups.map(m => m.points || 0).sort((a, b) => b - a);
            let medianScore = 0;
            if (scores.length > 0) {
                const mid = Math.floor(scores.length / 2);
                if (scores.length % 2 === 0) {
                    medianScore = (scores[mid - 1] + scores[mid]) / 2;
                } else {
                    medianScore = scores[mid];
                }
            }

            // Map roster -> points
            const teamPoints = {};
            const matchupMap = {};
            matchups.forEach(m => {
                teamPoints[m.roster_id] = m.points;
                if (!matchupMap[m.matchup_id]) matchupMap[m.matchup_id] = [];
                matchupMap[m.matchup_id].push(m.roster_id);
            });

            // Iterate Teams for this Week
            matchups.forEach(teamA => {
                const myId = teamA.roster_id;
                const myPoints = teamA.points || 0;
                if (!teamStats[myId]) return;

                // --- True Standings (All-Play) Calculation ---
                matchups.forEach(teamB => {
                    if (myId === teamB.roster_id) return;
                    // Note: This matches standard All-Play definition (record vs everyone else)
                    if (myPoints > (teamB.points || 0)) {
                        teamStats[myId].allPlayWins++;
                    } else if (myPoints < (teamB.points || 0)) {
                        teamStats[myId].allPlayLosses++;
                    } else {
                        teamStats[myId].allPlayTies++;
                    }
                });

                // --- Luck Calculation (Median-Aware) ---
                // Part A: Expected Wins
                // H2H Expectation
                let beatenCount = 0;
                let validOpponents = 0;
                matchups.forEach(opp => {
                    if (opp.roster_id !== myId) {
                        validOpponents++;
                        if (myPoints > (opp.points || 0)) beatenCount++;
                    }
                });
                if (validOpponents > 0) {
                    teamStats[myId].calcExpectedWins += (beatenCount / validOpponents);
                }
                // Median Expectation
                if (isMedianEnabled && myPoints > medianScore) {
                    teamStats[myId].calcExpectedWins += 1.0;
                }

                // Part B: Actual Wins
                const opponentId = matchupMap[teamA.matchup_id]?.find(id => id !== myId);
                const opponentPoints = opponentId ? (teamPoints[opponentId] || 0) : 0;

                // H2H Actual
                if (opponentId) {
                    if (myPoints > opponentPoints) {
                        teamStats[myId].calcActualWins += 1.0;
                    } else if (myPoints === opponentPoints) {
                        teamStats[myId].calcActualWins += 0.5;
                    }
                }
                // Median Actual
                if (isMedianEnabled && myPoints > medianScore) {
                    teamStats[myId].calcActualWins += 1.0;
                }
            });
        });

        // Format for table
        return Object.values(teamStats).map(stat => {
            const owner = userById.get(stat.ownerId);
            const luckIndex = stat.calcActualWins - stat.calcExpectedWins;

            return {
                ...stat,
                name: displayTeamName(owner),
                avatar: avatarUrl(owner?.avatar),
                actualRecord: `${stat.wins}-${stat.losses}${stat.ties > 0 ? `-${stat.ties}` : ''}`,
                allPlayRecord: `${stat.allPlayWins}-${stat.allPlayLosses}${stat.allPlayTies > 0 ? `-${stat.allPlayTies}` : ''}`,
                luckIndex: luckIndex // Keep as number for sorting/display logic
            };
        }).sort((a, b) => b.allPlayWins - a.allPlayWins); // Sort by All-Play Wins

    }, [weeklyMatchups, rosters, userById, league]);

    const [showTooltip, setShowTooltip] = useState(false);

    if (!weeklyMatchups || !rosters) return <div className="p-4 text-center text-gray-400">Loading True Standings...</div>;

    // Find max luck magnitude for scaling bar width
    const maxLuck = Math.max(...stats.map(s => Math.abs(s.luckIndex)), 1);

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
                            <th className="px-2 sm:px-4 py-3">Team</th>
                            <th className="px-2 sm:px-4 py-3 text-center">
                                <span className="md:hidden">Rec</span>
                                <span className="hidden md:inline">Actual</span>
                            </th>
                            <th className="px-2 sm:px-4 py-3 text-center">
                                <span className="md:hidden">AP</span>
                                <span className="hidden md:inline">All-Play</span>
                            </th>
                            <th className="px-2 sm:px-4 py-3 text-center relative w-[140px] sm:w-[180px]">
                                <button
                                    className="flex items-center justify-center gap-1 mx-auto focus:outline-none"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTooltip(!showTooltip);
                                    }}
                                >
                                    <span>Luck Index</span>
                                    <span className="text-slate-500">?</span>
                                </button>
                                <div
                                    className={`absolute top-full right-0 mt-2 px-3 py-2 bg-slate-900 text-xs text-white rounded-lg shadow-xl transition-opacity w-56 z-10 border border-slate-700 normal-case font-normal ${showTooltip ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none md:group-hover:opacity-100'}`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    Difference between Actual Wins and Expected Wins.
                                    <br />Green = Lucky (More wins than expected).
                                    <br />Red = Unlucky (Fewer wins than expected).
                                    <div className="absolute bottom-full right-8 border-4 border-transparent border-b-slate-900"></div>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats.map((team, idx) => (
                            <tr key={team.rosterId} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-2 sm:px-4 py-3 font-medium text-white flex items-center gap-2">
                                    <img src={team.avatar} alt="" className="w-6 h-6 rounded-full flex-shrink-0" />
                                    <span className="truncate max-w-[100px] sm:max-w-none">{team.name}</span>
                                </td>
                                <td className="px-2 sm:px-4 py-3 text-center">{team.actualRecord}</td>
                                <td className="px-2 sm:px-4 py-3 text-center">{team.allPlayRecord}</td>
                                <td className="px-2 sm:px-4 py-3 text-center">
                                    <div className="flex items-center justify-center h-full relative w-full">
                                        {/* Value Overlay */}
                                        <span className={`relative z-10 text-xs font-bold ${team.luckIndex > 0 ? 'text-green-300' : team.luckIndex < 0 ? 'text-red-300' : 'text-slate-400'}`}>
                                            {team.luckIndex > 0 ? '+' : ''}{team.luckIndex.toFixed(2)}
                                        </span>

                                        {/* Bar Background Center Line */}
                                        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-600/50"></div>

                                        {/* Bar */}
                                        {team.luckIndex !== 0 && (
                                            <div
                                                className={`absolute h-4 rounded-sm opacity-20 ${team.luckIndex > 0 ? 'bg-green-500 left-1/2 rounded-l-none' : 'bg-red-500 right-1/2 rounded-r-none'}`}
                                                style={{
                                                    width: `${(Math.abs(team.luckIndex) / maxLuck) * 45}%` // Cap at 45% width from center
                                                }}
                                            />
                                        )}
                                    </div>
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
