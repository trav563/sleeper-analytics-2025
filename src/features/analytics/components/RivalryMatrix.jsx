import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { displayTeamName } from '../../../utils/nflData';
import { Users, Grid, Trophy, Swords } from 'lucide-react';

const RivalryMatrix = ({ currentUserId, users, selectedUser1Id, selectedUser2Id }) => {
    const { leagueHistory } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({}); // league_id -> matchups
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('h2h'); // 'h2h' or 'matrix'
    const [user1Id, setUser1Id] = useState(currentUserId);
    const [user2Id, setUser2Id] = useState('');

    // Sync with props if provided
    useEffect(() => {
        if (selectedUser1Id) {
            setUser1Id(selectedUser1Id);
        }
        if (selectedUser2Id) {
            setUser2Id(selectedUser2Id);
            setViewMode('h2h');
        }
    }, [selectedUser1Id, selectedUser2Id]);

    useEffect(() => {
        if (currentUserId && !user1Id && !selectedUser1Id) {
            setUser1Id(currentUserId);
        }
    }, [currentUserId, user1Id, selectedUser1Id]);

    useEffect(() => {
        async function fetchAllHistory() {
            if (!leagueHistory || leagueHistory.length === 0) return;
            if (Object.keys(historicalMatchups).length > 0) return;

            setLoading(true);
            const newHistory = {};

            try {
                const promises = leagueHistory.map(async (league) => {
                    // Fetch weeks 1-15 for regular season history
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
    }, [leagueHistory, historicalMatchups]);

    // --- Matrix Logic ---
    const matrix = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0 || !user1Id) return [];

        const stats = {};

        leagueHistory.forEach(league => {
            const leagueMatchups = historicalMatchups[league.league_id];
            if (!leagueMatchups) return;

            // Find roster ID for user1 in this league
            const roster1 = Object.values(league.rosters || {}).find(r => r.owner_id === user1Id);
            if (!roster1) return;

            leagueMatchups.forEach(weekMatchups => {
                if (!weekMatchups) return;

                const match1 = weekMatchups.find(m => m.roster_id === roster1.roster_id);
                if (!match1 || !match1.matchup_id) return;

                const match2 = weekMatchups.find(m => m.matchup_id === match1.matchup_id && m.roster_id !== roster1.roster_id);
                if (!match2) return;

                const roster2 = Object.values(league.rosters || {}).find(r => r.roster_id === match2.roster_id);
                if (!roster2 || !roster2.owner_id) return;

                const opponentId = roster2.owner_id;

                if (!stats[opponentId]) {
                    const opponentUser = users?.find(u => u.user_id === opponentId);
                    stats[opponentId] = {
                        id: opponentId,
                        name: displayTeamName(opponentUser) || `User ${opponentId}`,
                        totalWins: 0,
                        totalLosses: 0,
                        years: {}
                    };
                }

                if (match1.points > match2.points) {
                    stats[opponentId].totalWins++;
                    if (!stats[opponentId].years[league.season]) stats[opponentId].years[league.season] = { wins: 0, losses: 0 };
                    stats[opponentId].years[league.season].wins++;
                } else if (match1.points < match2.points) {
                    stats[opponentId].totalLosses++;
                    if (!stats[opponentId].years[league.season]) stats[opponentId].years[league.season] = { wins: 0, losses: 0 };
                    stats[opponentId].years[league.season].losses++;
                }
            });
        });

        return Object.values(stats).sort((a, b) => (b.totalWins + b.totalLosses) - (a.totalWins + a.totalLosses));
    }, [leagueHistory, historicalMatchups, user1Id, users]);

    // --- Head-to-Head Logic ---
    const h2hStats = useMemo(() => {
        if (!user1Id || !user2Id || Object.keys(historicalMatchups).length === 0) return null;

        let wins1 = 0;
        let wins2 = 0;
        let points1 = 0;
        let points2 = 0;
        let games = 0;
        const history = [];

        leagueHistory.forEach(league => {
            const leagueMatchups = historicalMatchups[league.league_id];
            if (!leagueMatchups) return;

            const roster1 = Object.values(league.rosters || {}).find(r => r.owner_id === user1Id);
            const roster2 = Object.values(league.rosters || {}).find(r => r.owner_id === user2Id);

            if (!roster1 || !roster2) return;

            leagueMatchups.forEach((weekMatchups, index) => {
                if (!weekMatchups) return;

                const match1 = weekMatchups.find(m => m.roster_id === roster1.roster_id);
                const match2 = weekMatchups.find(m => m.roster_id === roster2.roster_id);

                if (match1 && match2 && match1.matchup_id === match2.matchup_id) {
                    // Skip if both teams scored 0 (likely bye week or unplayed)
                    if (match1.points === 0 && match2.points === 0) return;

                    games++;
                    points1 += match1.points;
                    points2 += match2.points;

                    const winner = match1.points > match2.points ? user1Id : user2Id;
                    if (winner === user1Id) wins1++;
                    else wins2++;

                    history.push({
                        season: league.season,
                        week: index + 1,
                        score1: match1.points,
                        score2: match2.points,
                        winner
                    });
                }
            });
        });

        return { wins1, wins2, points1, points2, games, history };
    }, [user1Id, user2Id, historicalMatchups, leagueHistory]);

    if (loading) return <div className="p-8 text-center text-gray-400">Loading Rivalry History...</div>;

    const user1 = users?.find(u => u.user_id === user1Id);
    const user2 = users?.find(u => u.user_id === user2Id);

    return (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Swords className="w-5 h-5 text-red-400" />
                        Rivalry Analysis
                    </h3>
                    <p className="text-xs text-slate-400">Compare head-to-head records across all seasons</p>
                </div>
                <div className="flex bg-slate-700 rounded-lg p-1">
                    <button
                        onClick={() => setViewMode('h2h')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'h2h' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Head-to-Head
                    </button>
                    <button
                        onClick={() => setViewMode('matrix')}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'matrix' ? 'bg-slate-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                    >
                        Full Matrix
                    </button>
                </div>
            </div>

            <div className="p-6">
                {viewMode === 'h2h' ? (
                    <div className="space-y-8">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                            {/* Team 1 Selector */}
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Team A</label>
                                <select
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-2.5"
                                    value={user1Id || ''}
                                    onChange={(e) => setUser1Id(e.target.value)}
                                >
                                    <option value="" disabled>Select Team A</option>
                                    {users?.map(u => (
                                        <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="text-2xl font-bold text-slate-500">VS</div>

                            {/* Team 2 Selector */}
                            <div className="w-full md:w-64">
                                <label className="block text-xs font-medium text-slate-400 mb-1">Team B</label>
                                <select
                                    className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg p-2.5"
                                    value={user2Id || ''}
                                    onChange={(e) => setUser2Id(e.target.value)}
                                >
                                    <option value="" disabled>Select Team B</option>
                                    {users?.filter(u => u.user_id !== user1Id).map(u => (
                                        <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {h2hStats ? (
                            <div className="animate-fade-in">
                                {/* Tale of the Tape */}
                                <div className="grid grid-cols-3 gap-4 bg-slate-900/50 rounded-xl p-6 border border-slate-700">
                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-blue-400">{h2hStats.wins1}</div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Wins</div>
                                        <div className="text-sm font-medium text-white mt-2 truncate px-2">{displayTeamName(user1)}</div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center border-x border-slate-700/50">
                                        <div className="text-4xl font-black text-white">{h2hStats.games}</div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">Total Games</div>
                                    </div>

                                    <div className="text-center">
                                        <div className="text-3xl font-bold text-red-400">{h2hStats.wins2}</div>
                                        <div className="text-xs text-slate-400 uppercase tracking-wider mt-1">Wins</div>
                                        <div className="text-sm font-medium text-white mt-2 truncate px-2">{displayTeamName(user2)}</div>
                                    </div>
                                </div>

                                {/* Stats Comparison */}
                                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-700/30 rounded-lg p-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-400">Total Points</span>
                                            <span className="text-white font-mono">{(h2hStats.points1).toFixed(1)} vs {(h2hStats.points2).toFixed(1)}</span>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${(h2hStats.points1 / (h2hStats.points1 + h2hStats.points2)) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-700/30 rounded-lg p-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-slate-400">Avg Score</span>
                                            <span className="text-white font-mono">{(h2hStats.points1 / h2hStats.games).toFixed(1)} vs {(h2hStats.points2 / h2hStats.games).toFixed(1)}</span>
                                        </div>
                                        <div className="w-full bg-slate-700 rounded-full h-2">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full"
                                                style={{ width: `${((h2hStats.points1 / h2hStats.games) / ((h2hStats.points1 / h2hStats.games) + (h2hStats.points2 / h2hStats.games))) * 100}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                {/* History List */}
                                <div className="mt-8">
                                    <h4 className="text-sm font-semibold text-slate-300 mb-4">Matchup History</h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                        {h2hStats.history.map((game, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg text-sm">
                                                <div className="text-slate-400 w-24">{game.season} W{game.week}</div>
                                                <div className={`font-mono ${game.winner === user1Id ? 'text-blue-400 font-bold' : 'text-slate-300'}`}>
                                                    {game.score1.toFixed(1)}
                                                </div>
                                                <div className="text-slate-600 px-2">-</div>
                                                <div className={`font-mono ${game.winner === user2Id ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                                                    {game.score2.toFixed(1)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-slate-500">
                                Select two teams to view their head-to-head history
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="mb-4">
                            <label className="block text-xs font-medium text-slate-400 mb-1">View Perspective For:</label>
                            <select
                                className="bg-slate-700 border border-slate-600 text-white rounded-lg p-2 text-sm"
                                value={user1Id || ''}
                                onChange={(e) => setUser1Id(e.target.value)}
                            >
                                {users?.map(u => (
                                    <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                ))}
                            </select>
                        </div>
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
                )}
            </div>
        </div>
    );
};

export default RivalryMatrix;
