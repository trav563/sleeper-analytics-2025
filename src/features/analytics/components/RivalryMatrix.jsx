import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

const RivalryMatrix = ({ currentUserId }) => {
    const { leagueHistory } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({}); // league_id -> matchups
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function fetchAllHistory() {
            if (!leagueHistory || leagueHistory.length === 0) return;

            // Avoid re-fetching if already loaded
            if (Object.keys(historicalMatchups).length > 0) return;

            setLoading(true);
            const newHistory = {};

            try {
                const promises = leagueHistory.map(async (league) => {
                    // We need matchups for all weeks. 
                    // Sleeper API requires week. We need to know how many weeks in a season.
                    // Usually 14-17. Let's assume 17 to be safe, or check settings.
                    // `league` object in history has settings? Yes, if we stored full object.
                    // My service stored: season, league_id, name, roster, rosters, draft_id.
                    // It didn't store 'settings'.
                    // I'll assume standard 1-16 weeks for regular season.
                    // Fetching 16 weeks for 5 years = 80 calls. Might be heavy.
                    // Optimization: Just fetch weeks 1-14 (regular season) or check if we can get all.
                    // Sleeper doesn't have "all matchups" endpoint.
                    // Let's fetch weeks 1-15 for now.
                    const weeks = Array.from({ length: 15 }, (_, i) => i + 1);
                    const weekPromises = weeks.map(w => fetchLeagueMatchups(league.league_id, w));
                    const weeksData = await Promise.all(weekPromises);
                    newHistory[league.league_id] = weeksData;
                });

                await Promise.all(promises);
                setHistoricalMatchups(newHistory);
            } catch (e) {
                console.error("Failed to fetch historical matchups", e);
            } finally {
                setLoading(false);
            }
        }

        fetchAllHistory();
    }, [leagueHistory]);

    const matrix = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0) return [];

        const stats = {}; // opponent_id -> { name, avatar, totalWins, totalLosses, years: { year: { wins, losses } } }

        leagueHistory.forEach(league => {
            const leagueMatchups = historicalMatchups[league.league_id];
            if (!leagueMatchups) return;

            const myRoster = league.roster;
            if (!myRoster) return;

            const rostersByOwner = league.rosters || {};

            leagueMatchups.forEach(weekMatchups => {
                if (!weekMatchups) return;

                // Find my matchup
                const myMatch = weekMatchups.find(m => m.roster_id === myRoster.roster_id);
                if (!myMatch || !myMatch.matchup_id) return;

                // Find opponent
                const opponentMatch = weekMatchups.find(m => m.matchup_id === myMatch.matchup_id && m.roster_id !== myRoster.roster_id);
                if (!opponentMatch) return;

                // Find opponent user
                const opponentRoster = Object.values(rostersByOwner).find(r => r.roster_id === opponentMatch.roster_id);
                if (!opponentRoster || !opponentRoster.owner_id) return;

                const opponentId = opponentRoster.owner_id;

                if (!stats[opponentId]) {
                    stats[opponentId] = {
                        id: opponentId,
                        name: `User ${opponentId}`, // Placeholder, ideally we have user data
                        // We don't have opponent user object stored in history, only rosters.
                        // Rosters don't have names directly, usually need 'users' array.
                        // My service fetched 'rosters' but not 'users' for history.
                        // I'll use roster_id or try to find name if available.
                        // Actually, `fetchLeagueRosters` returns roster objects which might not have display names.
                        // I might need to fetch users for history too if I want names.
                        // For now, I'll use "Opponent" or look for cached users.
                        avatar: null,
                        totalWins: 0,
                        totalLosses: 0,
                        years: {}
                    };
                }

                // Determine Winner
                if (myMatch.points > opponentMatch.points) {
                    stats[opponentId].totalWins++;
                    if (!stats[opponentId].years[league.season]) stats[opponentId].years[league.season] = { wins: 0, losses: 0 };
                    stats[opponentId].years[league.season].wins++;
                } else if (myMatch.points < opponentMatch.points) {
                    stats[opponentId].totalLosses++;
                    if (!stats[opponentId].years[league.season]) stats[opponentId].years[league.season] = { wins: 0, losses: 0 };
                    stats[opponentId].years[league.season].losses++;
                }
            });
        });

        return Object.values(stats).sort((a, b) => (b.totalWins + b.totalLosses) - (a.totalWins + a.totalLosses));
    }, [leagueHistory, historicalMatchups]);

    if (loading) return <div className="p-8 text-center text-gray-400">Loading Rivalry History...</div>;

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white">Rivalry Matrix</h3>
                <p className="text-xs text-slate-400">Lifetime Head-to-Head Records</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-300">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-800">
                        <tr>
                            <th className="px-4 py-3">Opponent</th>
                            <th className="px-4 py-3 text-center">Lifetime</th>
                            {leagueHistory.map(l => (
                                <th key={l.season} className="px-4 py-3 text-center">{l.season}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {matrix.map(opp => (
                            <tr key={opp.id} className="border-b border-slate-700 hover:bg-slate-700/50">
                                <td className="px-4 py-3 font-medium text-white">
                                    {opp.name}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-blue-400">
                                    {opp.totalWins}-{opp.totalLosses}
                                </td>
                                {leagueHistory.map(l => {
                                    const rec = opp.years[l.season];
                                    return (
                                        <td key={l.season} className="px-4 py-3 text-center text-slate-500">
                                            {rec ? `${rec.wins}-${rec.losses}` : '-'}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RivalryMatrix;
