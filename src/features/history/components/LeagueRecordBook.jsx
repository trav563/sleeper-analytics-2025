import { lastCompletedWeek } from '../../../utils/seasonState';
import { useState, useEffect, useMemo } from 'react';
import { useSleeper } from '../../../context/SleeperContext';
import { fetchLeagueMatchups, fetchLeagueUsers } from '../../../utils/sleeper';
import { Trophy, ArrowDown, TrendingUp, Minimize2, Loader2 } from 'lucide-react';
import { avatarUrl } from '../../../utils/nflData';
import { Pip } from '../../../components/ui/Pip';
import { Skeleton } from '../../../components/ui/Skeleton';
import { buildRecordBook } from '../../../utils/leagueRecordBook';
import { toSeasonViews } from '../seasonViews';
import PerfectWeeksPanel from './PerfectWeeksPanel';

/**
 * A runner-up: rank, value, who, and when. The name wraps rather than
 * truncating — a closest-matchup row names two teams, and clipping the second
 * one loses the half of the record that makes it a matchup.
 */
const RunnerUp = ({ rank, record }) => (
    <li className="flex items-baseline gap-2 py-1 text-xs">
        <span className="tnum font-mono text-2xs text-text-mute w-3 shrink-0">{rank}</span>
        <span className="tnum font-mono text-text shrink-0">{record.value}</span>
        <span className="text-text-dim flex-1 min-w-0 leading-snug">{record.teamName}</span>
        <span className="shrink-0 text-right">
            <span className="tnum font-mono text-2xs text-text-mute block">
                {record.year} <span className="text-text-mute">·</span> W{record.week}
            </span>
            {record.sub && (
                <span className="tnum font-mono text-2xs text-text-dim block leading-snug">{record.sub}</span>
            )}
        </span>
    </li>
);

const RecordCard = ({ title, icon: Icon, records, tone = 'text-text-dim' }) => {
    const [leader, ...runnersUp] = records || [];
    return (
        <section className="rounded-xl bg-bg-1 border border-line p-4 shadow-card">
            <header className="flex justify-between items-center mb-3">
                <h3 className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    {title}
                </h3>
                <Icon className={`w-4 h-4 ${tone}`} aria-hidden="true" />
            </header>
            {leader ? (
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        {leader.avatar ? (
                            <img
                                src={avatarUrl(leader.avatar)}
                                alt=""
                                className="w-10 h-10 rounded-full ring-1 ring-line shrink-0"
                            />
                        ) : (
                            <Pip seed={leader.teamName} name={leader.teamName} size={40} />
                        )}
                        <div className="min-w-0">
                            <div className="tnum font-display text-xl font-bold text-text leading-none">{leader.value}</div>
                            <div className="text-xs text-text-dim line-clamp-2 leading-tight mt-1" title={leader.teamName}>
                                {leader.teamName}
                            </div>
                        </div>
                    </div>
                    <div className="font-mono text-2xs uppercase tracking-wider text-text-mute flex justify-between">
                        <span>{leader.detail}</span>
                        <span className="tnum">
                            {leader.year} <span className="text-text-mute">·</span> W{leader.week}
                        </span>
                    </div>
                    {runnersUp.length > 0 && (
                        <ol className="mt-3 pt-2 border-t border-line">
                            {runnersUp.map((record, i) => (
                                <RunnerUp key={`${record.year}-${record.week}-${record.teamName}`} rank={i + 2} record={record} />
                            ))}
                        </ol>
                    )}
                </div>
            ) : (
                <div className="text-center text-text-mute py-4 text-sm">No data available</div>
            )}
        </section>
    );
};

const LeagueRecordBook = ({ users, state, leagueId, players }) => {
    const { leagueHistory, error: historyError, loadHistory } = useSleeper();
    const [historicalMatchups, setHistoricalMatchups] = useState({}); // league_id -> matchups
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [retry, setRetry] = useState(0);

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
            setError(null);
            const newHistory = {};

            try {
                const promises = leagueHistory.map(async (league) => {
                    // 18 covers every modern Sleeper season incl. late playoff weeks;
                    // unplayed weeks just come back empty.
                    const weeks = Array.from({ length: lastCompletedWeek(league, state) }, (_, i) => i + 1);
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
                if (!signal.aborted) setError("The record book could not load. Please retry.");
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        }

        fetchAllHistory();
        return () => controller.abort();
    }, [leagueHistory, state, retry]);

    const records = useMemo(() => {
        if (!leagueHistory || Object.keys(historicalMatchups).length === 0) return null;
        return buildRecordBook(toSeasonViews(leagueHistory, historicalMatchups, users));
    }, [leagueHistory, historicalMatchups, users]);

    if (error || historyError) return <section className="rounded-xl border border-line p-5" role="alert"><h2 className="text-xl font-bold">League Record Book</h2><p className="my-3">{error || historyError}</p><button className="min-h-11 text-signal" onClick={() => error ? setRetry(n => n + 1) : loadHistory(leagueId)}>Retry history</button></section>;
    if (loading || !leagueHistory) return (
        <div className="space-y-4" aria-busy="true">
            <div className="flex items-center gap-2.5">
                <Loader2 className="w-5 h-5 text-signal animate-spin" aria-hidden="true" />
                <span className="font-mono text-2xs uppercase tracking-wider text-text-mute">
                    Compiling League Record Book…
                </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="rounded-xl bg-bg-1 border border-line p-4 shadow-card">
                        <Skeleton className="h-3 w-24 mb-4" />
                        <div className="flex items-center gap-3 mb-3">
                            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-16" />
                                <Skeleton className="h-3 w-28" />
                            </div>
                        </div>
                        <Skeleton className="h-3 w-full" />
                    </div>
                ))}
            </div>
            <div className="rounded-xl bg-bg-1 border border-line p-4 shadow-card space-y-3">
                <Skeleton className="h-4 w-32" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-3 w-32" />
                            <Skeleton className="h-3 w-40" />
                        </div>
                    </div>
                ))}
            </div>
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
                    records={records?.highestScore}
                    tone="text-good"
                />
                <RecordCard
                    title="All-Time Low Score"
                    icon={ArrowDown}
                    records={records?.lowestScore}
                    tone="text-bad"
                />
                <RecordCard
                    title="Longest Win Streak"
                    icon={Trophy}
                    records={records?.longestStreak}
                    tone="text-signal"
                />
                <RecordCard
                    title="Closest Matchup"
                    icon={Minimize2}
                    records={records?.closestMatch}
                    tone="text-text-dim"
                />
            </div>

            <PerfectWeeksPanel
                leagueHistory={leagueHistory}
                historicalMatchups={historicalMatchups}
                users={users}
                players={players}
            />
        </div>
    );
};

export default LeagueRecordBook;
