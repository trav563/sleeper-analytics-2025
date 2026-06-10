import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups } from '../../../utils/sleeper';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/Card';
import { Trophy, ArrowDown, TrendingUp, TrendingDown, Minimize2, Loader2 } from 'lucide-react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';

const RecordCard = ({ title, icon: Icon, record, color }) => (
    <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-2 border-b border-slate-700/50">
            <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                    {title}
                </CardTitle>
                <div className={`p-1.5 rounded-lg ${color}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </CardHeader>
        <CardContent className="pt-6">
            {record ? (
                <div>
                    <div className="flex items-center gap-3 mb-4">
                        <img
                            src={avatarUrl(record.avatar)}
                            alt={record.teamName}
                            className="w-10 h-10 rounded-full border border-slate-600"
                        />
                        <div>
                            <div className="font-bold text-white text-lg leading-tight">{record.value}</div>
                            <div className="text-xs text-slate-400 line-clamp-2 leading-tight" title={record.teamName}>{record.teamName}</div>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between">
                        <span>{record.detail}</span>
                        <span>{record.year} W{record.week}</span>
                    </div>
                </div>
            ) : (
                <div className="text-center text-slate-500 py-4 text-sm">No Data Available</div>
            )}
        </CardContent>
    </Card>
);

const LeagueRecordBook = ({ users }) => {
    const { leagueHistory } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({}); // league_id -> matchups
    const [loading, setLoading] = useState(false);

    // Fetch matchups for all historical leagues
    useEffect(() => {
        async function fetchAllHistory() {
            if (!leagueHistory || leagueHistory.length === 0) return;
            // Avoid re-fetching if we already have data
            if (Object.keys(historicalMatchups).length > 0) return;

            setLoading(true);
            const newHistory = {};

            try {
                const promises = leagueHistory.map(async (league) => {
                    // Fetch weeks A (regular season only? usually 1-14 or 15. Let's do 1-16 to be safe or 1-15)
                    // The user prompt didn't specify regular season only, but usually records imply that.
                    // Let's fetch 1-16 to cover most fantasy seasons.
                    const weeks = Array.from({ length: 16 }, (_, i) => i + 1);
                    const weekPromises = weeks.map(w => fetchLeagueMatchups(league.league_id, w));
                    const weeksData = await Promise.all(weekPromises);
                    newHistory[league.league_id] = weeksData;
                });

                await Promise.all(promises);
                setHistoricalMatchups(newHistory);
            } catch (e) {
                console.error("Failed to fetch historical matchups for records", e);
            } finally {
                setLoading(false);
            }
        }

        fetchAllHistory();
    }, [leagueHistory]);

    const records = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0) return null;

        let highestScore = { value: -Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Points' };
        let lowestScore = { value: Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Points' };
        let closestMatch = { value: Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Diff' };

        // Streaks: We need to track current run for each owner across seasons potentially
        // But owner IDs might change if they are different accounts? Assuming Sleeper owner_id is consistent.
        // We will track by roster.owner_id
        let streakTracker = {}; // ownerId -> currentWinStreak
        let longestStreak = { value: 0, teamName: '', avatar: null, year: '', week: '', detail: 'Wins' };

        // Process chronologically (Oldest to Newest)
        const sortedHistory = [...leagueHistory].sort((a, b) => a.season - b.season);

        sortedHistory.forEach(league => {
            const leagueMatchups = historicalMatchups[league.league_id];
            if (!leagueMatchups) return;
            const rosters = league.rosters || {};

            // Flatten weeks
            leagueMatchups.forEach((weekMs, weekIdx) => {
                if (!weekMs || weekMs.length === 0) return;
                const weekNum = weekIdx + 1;

                // Process each matchup pair
                // Sleeper returns array of team-matchup objects. Group by matchup_id
                const matchupsById = {};
                weekMs.forEach(m => {
                    if (!matchupsById[m.matchup_id]) matchupsById[m.matchup_id] = [];
                    matchupsById[m.matchup_id].push(m);
                });

                Object.values(matchupsById).forEach(pair => {
                    if (pair.length !== 2) return; // Ignore incomplete matchups
                    const [m1, m2] = pair;

                    // Skip unplayed games (both zero)
                    if (m1.points === 0 && m2.points === 0) return;

                    // 1. High/Low Scores
                    [m1, m2].forEach(m => {
                        // Ignore zero scores (likely unset/bye) for lowest score record
                        if (m.points > highestScore.value) {
                            const r = Object.values(rosters).find(r => r.roster_id === m.roster_id);
                            const u = users?.find(user => user.user_id === r?.owner_id);
                            highestScore = {
                                value: m.points.toFixed(2),
                                teamName: displayTeamName(u),
                                avatar: u?.avatar,
                                year: league.season,
                                week: weekNum,
                                detail: 'Points'
                            };
                        }
                        if (m.points > 0 && m.points < lowestScore.value) {
                            // Tanking Check / Legitimacy Filter
                            // Filter out teams that didn't set a lineup (Tanking)
                            const starters = m.starters || [];
                            const starterPoints = m.starters_points || [];

                            // Criterion A: Empty Slots (0 or '0' in starters array usually implies empty slot)
                            const emptySlotsCount = starters.filter(p => !p || p === '0' || p === 0).length;

                            // Criterion B: Zero Point Scorers (Players who played but got 0, or inactive players left in lineup)
                            // Strictly count 0.0 scores.
                            const zeroPointScorers = starterPoints.filter(p => p === 0).length;

                            // Thresholds: > 2 empty slots OR > 3 zero point scorers = DISQUALIFY
                            const isTanking = emptySlotsCount > 2 || zeroPointScorers > 3;

                            if (!isTanking) {
                                const r = Object.values(rosters).find(r => r.roster_id === m.roster_id);
                                const u = users?.find(user => user.user_id === r?.owner_id);
                                lowestScore = {
                                    value: m.points.toFixed(2),
                                    teamName: displayTeamName(u),
                                    avatar: u?.avatar,
                                    year: league.season,
                                    week: weekNum,
                                    detail: 'Points'
                                };
                            }
                        }
                    });

                    // 2. Closest Matchup
                    const diff = Math.abs(m1.points - m2.points);
                    if (diff < closestMatch.value) {
                        // Display the winner or the first team
                        const r1 = Object.values(rosters).find(r => r.roster_id === m1.roster_id);
                        const r2 = Object.values(rosters).find(r => r.roster_id === m2.roster_id);
                        const u1 = users?.find(user => user.user_id === r1?.owner_id);
                        const u2 = users?.find(user => user.user_id === r2?.owner_id);

                        closestMatch = {
                            value: diff.toFixed(2),
                            teamName: `${displayTeamName(u1)} vs ${displayTeamName(u2)}`,
                            avatar: u1?.avatar,
                            year: league.season,
                            week: weekNum,
                            detail: `Diff (${m1.points.toFixed(1)} - {m2.points.toFixed(1)})` // Fixed syntax below
                        };
                        // Fix detail string interpolation
                        closestMatch.detail = `Diff (${Math.max(m1.points, m2.points).toFixed(1)} - ${Math.min(m1.points, m2.points).toFixed(1)})`;
                    }

                    // 3. Win Streaks
                    // Update tracker
                    const updateStreak = (winnerMatch, loserMatch) => {
                        const wRoster = Object.values(rosters).find(r => r.roster_id === winnerMatch.roster_id);
                        const lRoster = Object.values(rosters).find(r => r.roster_id === loserMatch.roster_id);
                        if (wRoster?.owner_id) {
                            streakTracker[wRoster.owner_id] = (streakTracker[wRoster.owner_id] || 0) + 1;
                            if (streakTracker[wRoster.owner_id] > longestStreak.value) {
                                const u = users?.find(user => user.user_id === wRoster.owner_id);
                                longestStreak = {
                                    value: streakTracker[wRoster.owner_id],
                                    teamName: displayTeamName(u),
                                    avatar: u?.avatar,
                                    year: league.season, // Year streak reached this height
                                    week: weekNum,
                                    detail: 'Consecutive Wins'
                                };
                            }
                        }
                        if (lRoster?.owner_id) {
                            streakTracker[lRoster.owner_id] = 0;
                        }
                    };

                    if (m1.points > m2.points) updateStreak(m1, m2);
                    else if (m2.points > m1.points) updateStreak(m2, m1);
                    // Ties usually count as streak breakers or ignored? Let's say break.
                    else {
                        const r1 = Object.values(rosters).find(r => r.roster_id === m1.roster_id);
                        const r2 = Object.values(rosters).find(r => r.roster_id === m2.roster_id);
                        if (r1?.owner_id) streakTracker[r1.owner_id] = 0;
                        if (r2?.owner_id) streakTracker[r2.owner_id] = 0;
                    }

                });
            });
        });

        // Format outputs
        return { highestScore, lowestScore, closestMatch, longestStreak };
    }, [leagueHistory, historicalMatchups, users]);

    if (!leagueHistory) return null;
    if (loading) return (
        <div className="flex items-center justify-center p-8 bg-slate-800/50 rounded-xl border border-slate-700">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin mr-2" />
            <span className="text-slate-400">Compiling League Record Book...</span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                <h2 className="text-2xl font-bold text-white">League Record Book</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RecordCard
                    title="All-Time High Score"
                    icon={TrendingUp}
                    record={records?.highestScore}
                    color="text-green-400 bg-green-500/10"
                />
                <RecordCard
                    title="All-Time Low Score"
                    icon={TrendingDown}
                    record={records?.lowestScore}
                    color="text-red-400 bg-red-500/10"
                />
                <RecordCard
                    title="Longest Win Streak"
                    icon={Trophy}
                    record={records?.longestStreak}
                    color="text-yellow-400 bg-yellow-500/10"
                />
                <RecordCard
                    title="Closest Matchup"
                    icon={Minimize2}
                    record={records?.closestMatch}
                    color="text-blue-400 bg-blue-500/10"
                />
            </div>
        </div>
    );
};

export default LeagueRecordBook;
