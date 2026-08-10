import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups, fetchLeagueUsers } from '../../../utils/sleeper';
import { Trophy, ArrowDown, TrendingUp, Minimize2, Loader2 } from 'lucide-react';
import { displayTeamName, avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';

const RecordCard = ({ title, icon: Icon, record, tone = 'text-text-dim' }) => (
    <section className="rounded-xl bg-bg-1 border border-line p-4 shadow-card">
        <header className="flex justify-between items-center mb-3">
            <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                {title}
            </h3>
            <Icon className={`w-4 h-4 ${tone}`} aria-hidden="true" />
        </header>
        {record ? (
            <div>
                <div className="flex items-center gap-3 mb-3">
                    {record.avatar ? (
                        <img
                            src={avatarUrl(record.avatar)}
                            alt=""
                            className="w-10 h-10 rounded-full ring-1 ring-line shrink-0"
                        />
                    ) : (
                        <Pip seed={record.teamName} name={record.teamName} size={40} />
                    )}
                    <div className="min-w-0">
                        <div className="tnum font-display text-xl font-bold text-text leading-none">{record.value}</div>
                        <div className="text-xs text-text-dim line-clamp-2 leading-tight mt-1" title={record.teamName}>
                            {record.teamName}
                        </div>
                    </div>
                </div>
                <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex justify-between">
                    <span>{record.detail}</span>
                    <span className="tnum">
                        {record.year} <span className="text-text-mute">·</span> W{record.week}
                    </span>
                </div>
            </div>
        ) : (
            <div className="text-center text-text-mute py-4 text-sm">No data available</div>
        )}
    </section>
);

const LeagueRecordBook = ({ users }) => {
    const { leagueHistory } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({}); // league_id -> matchups
    const [loading, setLoading] = useState(false);

    // Fetch matchups (and that season's users, for departed managers) for all
    // historical leagues. Refetches whenever the active league chain changes so
    // a league switch never shows the previous league's records.
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        async function fetchAllHistory() {
            if (!leagueHistory || leagueHistory.length === 0) return;

            setHistoricalMatchups({});
            setLoading(true);
            const newHistory = {};

            try {
                const promises = leagueHistory.map(async (league) => {
                    // 18 covers every modern Sleeper season incl. late playoff weeks;
                    // unplayed weeks just come back empty.
                    const weeks = Array.from({ length: 18 }, (_, i) => i + 1);
                    const weekPromises = weeks.map(w => fetchLeagueMatchups(league.league_id, w, false, { signal }));
                    const [weeksData, seasonUsers] = await Promise.all([
                        Promise.all(weekPromises),
                        fetchLeagueUsers(league.league_id, { signal }).catch(() => []),
                    ]);
                    newHistory[league.league_id] = { weeks: weeksData, users: seasonUsers };
                });

                await Promise.all(promises);
                if (!signal.aborted) setHistoricalMatchups(newHistory);
            } catch (e) {
                if (!signal.aborted) console.error("Failed to fetch historical matchups for records", e);
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        }

        fetchAllHistory();
        return () => controller.abort();
    }, [leagueHistory]);

    const records = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0) return null;

        let highestScore = { value: -Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Points' };
        let lowestScore = { value: Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Points' };
        let closestMatch = { value: Infinity, teamName: '', avatar: null, year: '', week: '', detail: 'Diff' };

        let streakTracker = {}; // ownerId -> currentWinStreak
        let longestStreak = { value: 0, teamName: '', avatar: null, year: '', week: '', detail: 'Wins' };

        const sortedHistory = [...leagueHistory].sort((a, b) => a.season - b.season);

        sortedHistory.forEach(league => {
            const entry = historicalMatchups[league.league_id];
            if (!entry) return;
            const leagueMatchups = entry.weeks;
            const rosters = league.rosters || {};
            // Prefer current-league users (freshest names); fall back to that
            // season's users so departed managers still resolve.
            const seasonUsers = entry.users || [];
            const findUser = (ownerId) =>
                users?.find(u => u.user_id === ownerId) || seasonUsers.find(u => u.user_id === ownerId);

            leagueMatchups.forEach((weekMs, weekIdx) => {
                if (!weekMs || weekMs.length === 0) return;
                const weekNum = weekIdx + 1;

                const matchupsById = {};
                weekMs.forEach(m => {
                    if (!matchupsById[m.matchup_id]) matchupsById[m.matchup_id] = [];
                    matchupsById[m.matchup_id].push(m);
                });

                Object.values(matchupsById).forEach(pair => {
                    if (pair.length !== 2) return;
                    const [m1, m2] = pair;

                    if (m1.points === 0 && m2.points === 0) return;

                    [m1, m2].forEach(m => {
                        if (m.points > highestScore.value) {
                            const r = Object.values(rosters).find(r => r.roster_id === m.roster_id);
                            const u = findUser(r?.owner_id);
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
                            const r = Object.values(rosters).find(r => r.roster_id === m.roster_id);
                            const u = findUser(r?.owner_id);
                            lowestScore = {
                                value: m.points.toFixed(2),
                                teamName: displayTeamName(u),
                                avatar: u?.avatar,
                                year: league.season,
                                week: weekNum,
                                detail: 'Points'
                            };
                        }
                    });

                    const diff = Math.abs(m1.points - m2.points);
                    if (diff < closestMatch.value) {
                        const r1 = Object.values(rosters).find(r => r.roster_id === m1.roster_id);
                        const r2 = Object.values(rosters).find(r => r.roster_id === m2.roster_id);
                        const u1 = findUser(r1?.owner_id);
                        const u2 = findUser(r2?.owner_id);

                        closestMatch = {
                            value: diff.toFixed(2),
                            teamName: `${displayTeamName(u1)} vs ${displayTeamName(u2)}`,
                            avatar: u1?.avatar,
                            year: league.season,
                            week: weekNum,
                            detail: `Diff (${Math.max(m1.points, m2.points).toFixed(1)} - ${Math.min(m1.points, m2.points).toFixed(1)})`
                        };
                    }

                    const updateStreak = (winnerMatch, loserMatch) => {
                        const wRoster = Object.values(rosters).find(r => r.roster_id === winnerMatch.roster_id);
                        const lRoster = Object.values(rosters).find(r => r.roster_id === loserMatch.roster_id);
                        if (wRoster?.owner_id) {
                            streakTracker[wRoster.owner_id] = (streakTracker[wRoster.owner_id] || 0) + 1;
                            if (streakTracker[wRoster.owner_id] > longestStreak.value) {
                                const u = findUser(wRoster.owner_id);
                                longestStreak = {
                                    value: streakTracker[wRoster.owner_id],
                                    teamName: displayTeamName(u),
                                    avatar: u?.avatar,
                                    year: league.season,
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
                    else {
                        const r1 = Object.values(rosters).find(r => r.roster_id === m1.roster_id);
                        const r2 = Object.values(rosters).find(r => r.roster_id === m2.roster_id);
                        if (r1?.owner_id) streakTracker[r1.owner_id] = 0;
                        if (r2?.owner_id) streakTracker[r2.owner_id] = 0;
                    }
                });
            });
        });

        return { highestScore, lowestScore, closestMatch, longestStreak };
    }, [leagueHistory, historicalMatchups, users]);

    if (!leagueHistory) return null;
    if (loading) return (
        <div className="flex items-center justify-center p-6 bg-bg-1 rounded-xl border border-line">
            <Loader2 className="w-5 h-5 text-signal animate-spin mr-2" />
            <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                Compiling League Record Book…
            </span>
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2.5">
                <Trophy className="w-5 h-5 text-signal" aria-hidden="true" />
                <h2 className="font-display text-2xl font-bold tracking-snug text-text">League Record Book</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <RecordCard
                    title="All-Time High Score"
                    icon={TrendingUp}
                    record={records?.highestScore}
                    tone="text-good"
                />
                <RecordCard
                    title="All-Time Low Score"
                    icon={ArrowDown}
                    record={records?.lowestScore}
                    tone="text-bad"
                />
                <RecordCard
                    title="Longest Win Streak"
                    icon={Trophy}
                    record={records?.longestStreak}
                    tone="text-signal"
                />
                <RecordCard
                    title="Closest Matchup"
                    icon={Minimize2}
                    record={records?.closestMatch}
                    tone="text-text-dim"
                />
            </div>
        </div>
    );
};

export default LeagueRecordBook;
