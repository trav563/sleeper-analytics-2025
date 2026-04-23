import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { displayTeamName } from '../../../utils/nflData';
import { Swords } from 'lucide-react';
import { SegmentedTabs } from '../../../components/ui/SegmentedTabs';

const RivalryMatrix = ({ currentUserId, users, selectedUser1Id, selectedUser2Id, leagueId }) => {
    const { leagueHistory, loadHistory, user } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({});
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('h2h');
    const [user1Id, setUser1Id] = useState(currentUserId);
    const [user2Id, setUser2Id] = useState('');

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

    const matrix = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0 || !user1Id) return [];

        const stats = {};

        leagueHistory.forEach(league => {
            const leagueMatchups = historicalMatchups[league.league_id];
            if (!leagueMatchups) return;

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

    useEffect(() => {
        if (!leagueHistory && leagueId) {
            loadHistory(leagueId, user?.user_id);
        }
    }, [leagueHistory, leagueId, user, loadHistory, historicalMatchups]);

    const Frame = ({ children }) => (
        <section className="bg-bg-1 rounded-xl border border-line shadow-card overflow-hidden">{children}</section>
    );
    const messageBox = (msg) => (
        <Frame>
            <div className="p-8 text-center font-mono text-2xs uppercase tracking-wider text-text-mute">{msg}</div>
        </Frame>
    );

    if (loading) return messageBox('Loading rivalry history…');
    if (!leagueHistory) return messageBox('Loading league history…');
    if (leagueHistory.length === 0) return messageBox('No league history found');

    const user1 = users?.find(u => u.user_id === user1Id);
    const user2 = users?.find(u => u.user_id === user2Id);

    return (
        <Frame>
            <header className="p-4 border-b border-line flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex items-center gap-1.5">
                        <Swords className="w-3 h-3 text-signal-2" aria-hidden="true" />
                        Rivalry Analysis
                    </div>
                    <h3 className="mt-1 font-display text-lg font-semibold text-text">
                        Head-to-Head History
                    </h3>
                </div>
                <SegmentedTabs
                    tabs={[
                        { value: 'h2h', label: 'Head-to-Head' },
                        { value: 'matrix', label: 'Full Matrix' },
                    ]}
                    value={viewMode}
                    onChange={setViewMode}
                />
            </header>

            <div className="p-5">
                {viewMode === 'h2h' ? (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row items-stretch md:items-end justify-center gap-4 md:gap-6">
                            <div className="w-full md:w-64">
                                <label className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">Team A</label>
                                <select
                                    className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                    value={user1Id || ''}
                                    onChange={(e) => setUser1Id(e.target.value)}
                                >
                                    <option value="" disabled>Select Team A</option>
                                    {users?.map(u => (
                                        <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="font-display font-bold text-2xl text-text-mute self-center md:self-end md:pb-2">VS</div>

                            <div className="w-full md:w-64">
                                <label className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">Team B</label>
                                <select
                                    className="w-full bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
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
                                <div className="grid grid-cols-3 gap-3 bg-bg-2 rounded-xl p-5 border border-line">
                                    <div className="text-center">
                                        <div className="tnum font-display text-3xl font-bold text-signal">{h2hStats.wins1}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">Wins</div>
                                        <div className="text-sm font-semibold text-text mt-2 truncate px-1">{displayTeamName(user1)}</div>
                                    </div>

                                    <div className="flex flex-col items-center justify-center border-x border-line">
                                        <div className="tnum font-display text-3xl font-bold text-text">{h2hStats.games}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">Total Games</div>
                                    </div>

                                    <div className="text-center">
                                        <div className="tnum font-display text-3xl font-bold text-signal-2">{h2hStats.wins2}</div>
                                        <div className="font-mono text-2xs uppercase tracking-wider text-text-mute mt-1">Wins</div>
                                        <div className="text-sm font-semibold text-text mt-2 truncate px-1">{displayTeamName(user2)}</div>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { label: 'Total Points', a: h2hStats.points1, b: h2hStats.points2 },
                                        { label: 'Avg Score', a: h2hStats.points1 / h2hStats.games, b: h2hStats.points2 / h2hStats.games },
                                    ].map((row) => (
                                        <div key={row.label} className="bg-bg-2 rounded-md p-3 border border-line">
                                            <div className="flex justify-between text-sm mb-2">
                                                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">{row.label}</span>
                                                <span className="tnum text-text-dim">
                                                    <span className="text-signal">{row.a.toFixed(1)}</span>
                                                    <span className="text-text-mute"> vs </span>
                                                    <span className="text-signal-2">{row.b.toFixed(1)}</span>
                                                </span>
                                            </div>
                                            <div className="w-full bg-bg-3 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="bg-signal h-1.5"
                                                    style={{ width: `${(row.a / (row.a + row.b || 1)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <h4 className="font-mono text-2xs uppercase tracking-wider text-text-mute mb-3">Matchup History</h4>
                                    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                                        {h2hStats.history.map((game, i) => (
                                            <div
                                                key={i}
                                                className="grid items-center gap-2 p-2.5 bg-bg-2 rounded-md text-sm border border-line"
                                                style={{ gridTemplateColumns: '90px 1fr auto 1fr' }}
                                            >
                                                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute tnum">
                                                    {game.season} W{game.week}
                                                </div>
                                                <div className={`tnum text-right ${game.winner === user1Id ? 'text-signal font-bold' : 'text-text-dim'}`}>
                                                    {game.score1.toFixed(1)}
                                                </div>
                                                <div className="text-text-mute px-1" aria-hidden="true">·</div>
                                                <div className={`tnum ${game.winner === user2Id ? 'text-signal-2 font-bold' : 'text-text-dim'}`}>
                                                    {game.score2.toFixed(1)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-10 font-mono text-2xs uppercase tracking-wider text-text-mute">
                                Select two teams to view head-to-head history
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div className="mb-4">
                            <label className="block font-mono text-2xs uppercase tracking-wider text-text-mute mb-1">View perspective for</label>
                            <select
                                className="bg-bg-2 border border-line text-text rounded-md px-3 min-h-[40px] text-sm focus:outline-none focus:ring-1 focus:ring-signal focus:border-signal transition-colors duration-fast"
                                value={user1Id || ''}
                                onChange={(e) => setUser1Id(e.target.value)}
                            >
                                {users?.map(u => (
                                    <option key={u.user_id} value={u.user_id}>{displayTeamName(u)}</option>
                                ))}
                            </select>
                        </div>
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="font-mono text-2xs uppercase tracking-wider text-text-mute bg-bg-2">
                                    <th className="px-3 py-2.5">Opponent</th>
                                    <th className="px-3 py-2.5 text-center">Lifetime</th>
                                    {leagueHistory.map(l => (
                                        <th key={l.season} className="px-3 py-2.5 text-center tnum">{l.season}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {matrix.map(opp => (
                                    <tr key={opp.id} className="border-b border-line hover:bg-bg-2/60 transition-colors duration-fast">
                                        <td className="px-3 py-3 font-semibold text-text">{opp.name}</td>
                                        <td className="px-3 py-3 text-center tnum font-bold text-signal">
                                            {opp.totalWins}-{opp.totalLosses}
                                        </td>
                                        {leagueHistory.map(l => {
                                            const rec = opp.years[l.season];
                                            return (
                                                <td key={l.season} className="px-3 py-3 text-center tnum text-text-dim">
                                                    {rec ? `${rec.wins}-${rec.losses}` : <span className="text-text-mute">—</span>}
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
        </Frame>
    );
};

export default RivalryMatrix;
